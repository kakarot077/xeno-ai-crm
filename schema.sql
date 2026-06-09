-- ─────────────────────────────────────────────────────────────
-- CRM DATABASE SCHEMA
-- Phase 1 — Foundation
-- ─────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS crm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE crm_db;

-- ─────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                VARCHAR(10)  PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL UNIQUE,
  phone             VARCHAR(20),
  city              VARCHAR(60),
  preferred_channel ENUM('WhatsApp','Email','SMS','RCS') DEFAULT 'Email',
  engagement_score  TINYINT UNSIGNED DEFAULT 50,
  status            ENUM('active','at-risk','churned') DEFAULT 'active',
  join_date         DATE,
  tags              JSON,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- orders
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          VARCHAR(20)   PRIMARY KEY,
  customer_id VARCHAR(10)   NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  order_date  DATE          NOT NULL,
  category    VARCHAR(60),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_customer_id (customer_id),
  INDEX idx_order_date  (order_date)
);

-- ─────────────────────────────────────────
-- segments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segments (
  id          VARCHAR(20)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  explanation TEXT,
  filters     JSON         NOT NULL,
  color       VARCHAR(10)  DEFAULT '#4F46E5',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- campaigns
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id             VARCHAR(20)  PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  status         ENUM('draft','launched','active','completed','paused') DEFAULT 'draft',
  segment_id     VARCHAR(20),
  channel        ENUM('WhatsApp','Email','SMS','RCS') NOT NULL,
  goal           TEXT,
  content        JSON,
  audience_count INT UNSIGNED DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at        TIMESTAMP NULL,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- communications
-- (one row per message sent to one customer)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  campaign_id VARCHAR(20)   NOT NULL,
  customer_id VARCHAR(10)   NOT NULL,
  channel     ENUM('WhatsApp','Email','SMS','RCS') NOT NULL,
  message     TEXT,
  status      ENUM('sent','delivered','failed','opened','clicked','converted') DEFAULT 'sent',
  revenue     DECIMAL(10,2) DEFAULT 0,
  sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_campaign (campaign_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status   (status)
);

-- ─────────────────────────────────────────
-- customer_stats VIEW
-- Derives LTV, order counts, recency from
-- the orders table — no denormalisation risk.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW customer_stats AS
  SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.city,
    c.preferred_channel,
    c.engagement_score,
    c.status,
    c.join_date,
    c.tags,
    COALESCE(SUM(o.amount), 0)                             AS ltv,
    COUNT(o.id)                                            AS order_count,
    COALESCE(AVG(o.amount), 0)                             AS avg_order_value,
    COALESCE(DATEDIFF(CURDATE(), MAX(o.order_date)), 9999) AS last_purchase_days,
    MAX(o.order_date)                                      AS last_purchase
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  GROUP BY
    c.id, c.name, c.email, c.phone, c.city,
    c.preferred_channel, c.engagement_score,
    c.status, c.join_date, c.tags;
