# AI-Native Shopper Engagement CRM — Migration & Architecture Plan

> **Scope:** Transform the existing single-file React prototype (`crm_app.jsx`) into a production-style full-stack system suitable for a software engineering take-home assignment.  
> **Principle:** Preserve all existing UI/UX; replace only the underlying data and logic layer.

---

## Table of Contents

1. [Current Architecture Audit](#1-current-architecture-audit)
2. [Target System Architecture](#2-target-system-architecture)
3. [Folder Structure](#3-folder-structure)
4. [MySQL Schema](#4-mysql-schema)
5. [CRM Backend — API Specifications](#5-crm-backend--api-specifications)
6. [Channel Service — API Specifications](#6-channel-service--api-specifications)
7. [AI Layer Contracts](#7-ai-layer-contracts)
8. [Frontend Migration Map](#8-frontend-migration-map)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Environment & Configuration](#10-environment--configuration)

---

## 1. Current Architecture Audit

### What exists in `crm_app.jsx`

| Concern | Current Implementation | Problem |
|---|---|---|
| Customer data | `generateCustomers()` — seeded random generator producing 60 records at module load | Not persistent; regenerates on refresh |
| Segment data | `DEFAULT_SEGMENTS` — hardcoded array in module scope | Not user-owned; state is reset on refresh |
| Campaign data | `INITIAL_CAMPAIGNS` — hardcoded array in module scope | Same issue; metrics are static |
| Segment filtering | `applyFilters()` — pure JS filter over in-memory array | Must move to SQL `WHERE` clause |
| AI (Segment) | `callClaude(SEGMENT_SYSTEM, ...)` — called directly from `AudiencesView` | Exposes API key in the browser |
| AI (Campaign) | `callClaude(CAMPAIGN_SYSTEM, ...)` — called directly from `CampaignsView` | Same; also mixes UI and LLM logic |
| AI (Advisor) | `callClaude(ADVISOR_SYSTEM, ...)` — called directly from `AIAdvisorView` | Same |
| Delivery simulation | `simulateDelivery()` — setTimeout chain inside React component | Fake; not durable; lost on unmount |
| Analytics | Computed from in-memory campaign array (`WEEKLY_DATA`, `CHANNEL_DIST` are hardcoded) | Not derived from real data |
| Orders | Not modelled at all | Needed for LTV, analytics |

### What is worth preserving unchanged

- All design tokens (`T` object, `AI_GRADIENT`)
- All UI component atoms: `Badge`, `Card`, `Btn`, `MetricCard`, `ChannelIcon`, `AIBadge`, `AIThinking`
- All view component structures: `DashboardView`, `CustomersView`, `AudiencesView`, `CampaignsView`, `AnalyticsView`, `AIAdvisorView`
- Sidebar navigation and layout shell
- `applyFilters()` utility can remain in frontend for local segment preview; the authoritative count lives in the DB

---

## 2. Target System Architecture

```
┌─────────────────────────────────┐
│         React Frontend          │  Port 3000
│  (crm_app.jsx — UI preserved)   │
│  fetch() → /api/*               │
└────────────┬────────────────────┘
             │ HTTP/JSON
┌────────────▼────────────────────┐
│       CRM Backend (Express)     │  Port 4000
│  Routes: customers, orders,     │
│  segments, campaigns, analytics,│
│  ai, receipt                    │
└──────┬──────────────────┬───────┘
       │                  │
       │ mysql2           │ fetch()
┌──────▼──────┐   ┌───────▼──────────────┐
│    MySQL    │   │  AI Layer            │
│  (port 3306)│   │  (Claude / Gemini)   │
│  5 tables   │   │  called server-side  │
└─────────────┘   └──────────────────────┘
       │
       │ POST /send
┌──────▼──────────────────────────┐
│    Channel Service (Express)    │  Port 5000
│  Simulates delivery lifecycle   │
│  with randomised async delays   │
└──────┬──────────────────────────┘
       │ POST /receipt (callback)
       ▼
  CRM Backend /receipt endpoint
  → UPDATE communications SET status=...
```

---

## 3. Folder Structure

```
crm-system/
│
├── frontend/                        # Existing React app (Vite)
│   ├── src/
│   │   ├── App.jsx                  # Trimmed: no mock data, no AI calls
│   │   ├── api/
│   │   │   └── client.js            # Centralised fetch wrapper
│   │   ├── views/
│   │   │   ├── DashboardView.jsx
│   │   │   ├── CustomersView.jsx
│   │   │   ├── AudiencesView.jsx
│   │   │   ├── CampaignsView.jsx
│   │   │   ├── AnalyticsView.jsx
│   │   │   └── AIAdvisorView.jsx
│   │   ├── components/
│   │   │   └── ui.jsx               # Badge, Card, Btn, MetricCard, etc.
│   │   └── constants/
│   │       └── tokens.js            # T, AI_GRADIENT — unchanged
│   ├── package.json
│   └── vite.config.js               # proxy /api → localhost:4000
│
├── crm-backend/                     # Express.js — port 4000
│   ├── src/
│   │   ├── index.js                 # App bootstrap, middleware
│   │   ├── db/
│   │   │   ├── connection.js        # mysql2 pool
│   │   │   └── seed.js              # Seeds 60 customers + sample data
│   │   ├── routes/
│   │   │   ├── customers.js
│   │   │   ├── orders.js
│   │   │   ├── segments.js
│   │   │   ├── campaigns.js
│   │   │   ├── analytics.js
│   │   │   ├── ai.js
│   │   │   └── receipt.js
│   │   ├── services/
│   │   │   ├── aiService.js         # Claude / Gemini wrapper
│   │   │   ├── segmentService.js    # filter → SQL translation
│   │   │   └── analyticsService.js  # metric queries
│   │   └── middleware/
│   │       └── errorHandler.js
│   ├── .env
│   └── package.json
│
├── channel-service/                 # Express.js — port 5000
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   └── send.js
│   │   └── services/
│   │       └── simulator.js         # Async delivery lifecycle
│   ├── .env
│   └── package.json
│
├── db/
│   └── schema.sql                   # CREATE TABLE statements
│
└── README.md
```

---

## 4. MySQL Schema

```sql
-- ─────────────────────────────────────────
-- DATABASE
-- ─────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crm_db;

-- ─────────────────────────────────────────
-- customers
-- ─────────────────────────────────────────
CREATE TABLE customers (
  id              VARCHAR(10)  PRIMARY KEY,          -- e.g. 'C001'
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  city            VARCHAR(60),
  preferred_channel ENUM('WhatsApp','Email','SMS','RCS') DEFAULT 'Email',
  engagement_score TINYINT UNSIGNED DEFAULT 50,       -- 0-100
  status          ENUM('active','at-risk','churned') DEFAULT 'active',
  join_date       DATE,
  tags            JSON,                               -- ["fashion","premium","loyal"]
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- orders
-- ─────────────────────────────────────────
CREATE TABLE orders (
  id              VARCHAR(20)  PRIMARY KEY,           -- e.g. 'ORD-00042'
  customer_id     VARCHAR(10)  NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  order_date      DATE NOT NULL,
  category        VARCHAR(60),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Derived fields (ltv, order_count, avg_order_value, last_purchase_days)
-- are computed via SQL views or queries rather than stored as columns,
-- keeping the source of truth in the orders table.

CREATE VIEW customer_stats AS
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
    COALESCE(SUM(o.amount), 0)                        AS ltv,
    COUNT(o.id)                                       AS order_count,
    COALESCE(AVG(o.amount), 0)                        AS avg_order_value,
    COALESCE(DATEDIFF(CURDATE(), MAX(o.order_date)), 9999) AS last_purchase_days,
    MAX(o.order_date)                                 AS last_purchase
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id
  GROUP BY c.id;

-- ─────────────────────────────────────────
-- segments
-- ─────────────────────────────────────────
CREATE TABLE segments (
  id              VARCHAR(20)  PRIMARY KEY,           -- e.g. 'SEG001'
  name            VARCHAR(100) NOT NULL,
  explanation     TEXT,
  filters         JSON NOT NULL,                      -- [{field, operator, value}, ...]
  color           VARCHAR(10)  DEFAULT '#4F46E5',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- campaigns
-- ─────────────────────────────────────────
CREATE TABLE campaigns (
  id              VARCHAR(20)  PRIMARY KEY,           -- e.g. 'CMP001'
  name            VARCHAR(150) NOT NULL,
  status          ENUM('draft','launched','active','completed','paused') DEFAULT 'draft',
  segment_id      VARCHAR(20),
  channel         ENUM('WhatsApp','Email','SMS','RCS') NOT NULL,
  goal            TEXT,
  content         JSON,                               -- {whatsapp:{...}, email:{...}, ...}
  audience_count  INT UNSIGNED DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP NULL,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────
-- communications
-- (one row per message sent to one customer)
-- ─────────────────────────────────────────
CREATE TABLE communications (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
  campaign_id     VARCHAR(20)  NOT NULL,
  customer_id     VARCHAR(10)  NOT NULL,
  channel         ENUM('WhatsApp','Email','SMS','RCS') NOT NULL,
  message         TEXT,
  status          ENUM('sent','delivered','failed','opened','clicked','converted')
                    DEFAULT 'sent',
  revenue         DECIMAL(10,2) DEFAULT 0,
  sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_campaign (campaign_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status   (status)
);
```

### Status progression in `communications`

```
sent → delivered → opened → clicked → converted
         └──────→ failed
```

Each transition is written by the Channel Service callback (`POST /receipt`).

---

## 5. CRM Backend — API Specifications

**Base URL:** `http://localhost:4000`  
**All responses:** `Content-Type: application/json`

---

### 5.1 Customers

#### `GET /customers`
Returns paginated list from the `customer_stats` view.

**Query params:** `search`, `status` (`active|at-risk|churned|all`), `page` (default 1), `limit` (default 20)

**Response:**
```json
{
  "customers": [
    {
      "id": "C001",
      "name": "Priya Sharma",
      "email": "priya.sharma0@gmail.com",
      "phone": "+91 98765 43210",
      "city": "Mumbai",
      "ltv": 42500,
      "orderCount": 8,
      "avgOrderValue": 5312,
      "lastPurchaseDays": 12,
      "lastPurchase": "2025-05-28",
      "preferredChannel": "WhatsApp",
      "tags": ["fashion", "premium", "loyal"],
      "engagementScore": 82,
      "status": "active",
      "joinDate": "2024-01-15"
    }
  ],
  "total": 60,
  "page": 1,
  "pages": 3
}
```

#### `GET /customers/:id`
Returns a single customer with full stats.

---

### 5.2 Orders

#### `GET /orders`
**Query params:** `customerId`, `page`, `limit`

**Response:**
```json
{
  "orders": [
    { "id": "ORD-00001", "customerId": "C001", "amount": 5200, "orderDate": "2025-05-28", "category": "fashion" }
  ],
  "total": 340
}
```

---

### 5.3 Segments

#### `GET /segments`
Returns all saved segments with a live `count` field (re-computed against DB).

**Response:**
```json
{
  "segments": [
    {
      "id": "SEG001",
      "name": "High-Value Inactive",
      "explanation": "Customers with ₹5000+ LTV who haven't purchased in 60 days",
      "filters": [
        { "field": "ltv", "operator": "gt", "value": 5000 },
        { "field": "lastPurchaseDays", "operator": "gt", "value": 60 }
      ],
      "count": 18,
      "color": "#4F46E5",
      "createdAt": "2025-05-20"
    }
  ]
}
```

#### `POST /segments`
Save a manually or AI-generated segment.

**Request:**
```json
{
  "name": "High-Value Inactive",
  "explanation": "...",
  "filters": [...],
  "color": "#4F46E5"
}
```

**Response:** `201` with the saved segment including `id` and `count`.

#### `POST /segments/generate`
AI-powered segment creation from natural language.

**Request:**
```json
{ "prompt": "Customers who spent more than ₹5000 but haven't purchased in 60 days" }
```

**Response:**
```json
{
  "segmentName": "High-Value Inactive",
  "explanation": "Customers with lifetime value above ₹5000 who have not made a purchase in the last 60 days.",
  "filters": [
    { "field": "ltv", "operator": "gt", "value": 5000 },
    { "field": "lastPurchaseDays", "operator": "gt", "value": 60 }
  ],
  "matchingCustomers": [{ "id": "C003", "name": "...", ... }],
  "count": 18
}
```

**Implementation note:** `segmentService.js` converts the `filters` array into a SQL `WHERE` clause on `customer_stats` to compute the live `count` and `matchingCustomers`.

#### `GET /segments/:id/customers`
Returns customers matching a saved segment's filters.

---

### 5.4 Campaigns

#### `GET /campaigns`
Returns all campaigns with aggregated stats from the `communications` table.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "CMP001",
      "name": "Summer Reactivation",
      "status": "completed",
      "segmentId": "SEG001",
      "segmentName": "High-Value Inactive",
      "channel": "WhatsApp",
      "audienceCount": 18,
      "stats": {
        "sent": 18,
        "delivered": 15,
        "failed": 3,
        "opened": 9,
        "clicked": 4,
        "converted": 2,
        "revenue": 87400
      },
      "createdAt": "2025-05-10",
      "sentAt": "2025-05-10T10:30:00Z"
    }
  ]
}
```

#### `POST /campaigns/generate`
AI-powered campaign content generation.

**Request:**
```json
{
  "goal": "Re-engage inactive fashion customers with a personalized discount",
  "segmentId": "SEG001",
  "channels": ["WhatsApp", "Email"]
}
```

**Response:**
```json
{
  "campaignName": "Come Back Offer",
  "whatsapp": {
    "message": "Hey [Name]! 😍 We miss you — grab 20% off your faves before they're gone!",
    "cta": "Claim Discount"
  },
  "email": {
    "subject": "We reserved something special for you ✨",
    "preview": "Your favourites are waiting, and there's a surprise inside.",
    "body": "...",
    "cta": "Shop Now"
  },
  "sms": { "message": "..." },
  "rcs": { "title": "...", "body": "...", "cta": "...", "imageDescription": "..." }
}
```

#### `POST /campaigns`
Save a campaign (without sending).

**Request:**
```json
{
  "name": "Come Back Offer",
  "segmentId": "SEG001",
  "channel": "WhatsApp",
  "goal": "Re-engage inactive customers",
  "content": { "whatsapp": { ... }, "email": { ... } }
}
```

**Response:** `201` with saved campaign.

#### `POST /campaigns/send`
Launch a campaign — creates one `communication` row per customer in the segment, then calls the Channel Service asynchronously.

**Request:**
```json
{ "campaignId": "CMP001" }
```

**Behaviour:**
1. Load segment filters → query matching customers from `customer_stats`
2. For each customer: `INSERT INTO communications (campaign_id, customer_id, channel, message, status='sent')`
3. `UPDATE campaigns SET status='launched', sent_at=NOW()` 
4. For each communication: `POST http://localhost:5000/send` (fire-and-forget)

**Response:**
```json
{ "campaignId": "CMP001", "communicationsCreated": 18, "status": "launched" }
```

---

### 5.5 Analytics

#### `GET /analytics`
Returns aggregated metrics for the dashboard.

**Response:**
```json
{
  "summary": {
    "totalCustomers": 60,
    "activeCustomers": 28,
    "atRiskCustomers": 19,
    "churnedCustomers": 13,
    "avgCLV": 18430,
    "activeCampaigns": 1,
    "totalRevenue": 251400
  },
  "weeklyPerformance": [
    { "day": "Mon", "sent": 124, "delivered": 110, "opened": 68, "clicked": 24, "converted": 8 }
  ],
  "channelDistribution": [
    { "name": "WhatsApp", "value": 42 },
    { "name": "Email", "value": 28 }
  ],
  "recentActivity": [
    { "type": "campaign", "text": "Campaign 'Summer Reactivation' sent to 18 customers", "time": "2 hours ago" }
  ]
}
```

**Implementation:** All values are `SELECT` / `GROUP BY` queries against `communications`, `campaigns`, and `customer_stats`.

#### `GET /analytics/campaigns/:id`
Returns detailed funnel stats for a single campaign.

---

### 5.6 AI Advisor

#### `POST /ai/advisor`
Proxy for the AI Growth Advisor chat.

**Request:**
```json
{
  "question": "Which channel performs best for re-engagement?",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Behaviour:** Backend fetches live analytics summary, builds the context string (same as current `ADVISOR_SYSTEM` + customer/campaign data), calls Claude, returns the response.

**Response:**
```json
{ "answer": "Based on your data, WhatsApp has a 56% open rate vs 38% for Email..." }
```

---

### 5.7 Receipt (Callback)

#### `POST /receipt`
Called by the Channel Service after each status transition.

**Request:**
```json
{
  "communicationId": "uuid-here",
  "status": "opened"
}
```

**Behaviour:**
- `UPDATE communications SET status = ?, updated_at = NOW() WHERE id = ?`
- If `status = 'converted'`: also write a synthetic order to the `orders` table and `UPDATE campaigns SET revenue = revenue + amount`

**Response:** `200 { "ok": true }`

---

## 6. Channel Service — API Specifications

**Base URL:** `http://localhost:5000`

### `POST /send`

Accepts a send request, immediately returns `202 Accepted`, then begins async simulation.

**Request:**
```json
{
  "communicationId": "uuid",
  "campaignId": "CMP001",
  "customerId": "C003",
  "channel": "WhatsApp",
  "message": "Hey Priya! 😍 We miss you..."
}
```

**Response:** `202 { "accepted": true }`

### Simulation Logic (`simulator.js`)

```
For each communication:

1. baseDelay = 300ms + random(0–4000ms)
   → After baseDelay:
      89% chance: status = 'delivered'  → POST /receipt {status:'delivered'}
      11% chance: status = 'failed'     → POST /receipt {status:'failed'} → STOP

2. If delivered, after +600–1800ms:
      56% chance: status = 'opened'     → POST /receipt {status:'opened'}
      (else stop)

3. If opened, after +400–1500ms:
      33% chance: status = 'clicked'    → POST /receipt {status:'clicked'}
      (else stop)

4. If clicked, after +400–1200ms:
      21% chance: status = 'converted'  → POST /receipt {status:'converted'}
      (else stop)
```

These probabilities are identical to the current `simulateDelivery()` in the React component — the behaviour is preserved, only the execution moves to the backend.

**CRM Backend callback URL** is read from `process.env.CRM_BACKEND_URL` (default: `http://localhost:4000`).

---

## 7. AI Layer Contracts

All three AI system prompts from the React prototype are moved verbatim into `crm-backend/src/services/aiService.js`. No changes to the prompts are needed.

| Frontend call | Backend route | Function in aiService.js |
|---|---|---|
| `callClaude(SEGMENT_SYSTEM, query)` | `POST /segments/generate` | `generateSegment(prompt)` |
| `callClaude(CAMPAIGN_SYSTEM, goal+segment+channels)` | `POST /campaigns/generate` | `generateCampaign(goal, segment, channels)` |
| `callClaude(ADVISOR_SYSTEM, context)` | `POST /ai/advisor` | `askAdvisor(question, analyticsContext, history)` |

**`aiService.js` structure:**

```js
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(system, user) { ... }

module.exports = {
  generateSegment,   // returns { segmentName, explanation, filters }
  generateCampaign,  // returns { campaignName, whatsapp, email, sms, rcs }
  askAdvisor,        // returns string
};
```

---

## 8. Frontend Migration Map

The following changes are made to `crm_app.jsx` (or its split files). **All UI rendering code is left untouched.**

### Remove entirely

| What | Location in current file |
|---|---|
| `CITIES`, `FNAMES`, `LNAMES`, seeded RNG, `generateCustomers()` | Lines 44–98 |
| `ALL_CUSTOMERS` constant | Line 98 |
| `DEFAULT_SEGMENTS` constant | Lines 100–122 |
| `INITIAL_CAMPAIGNS` constant | Lines 124–146 |
| `WEEKLY_DATA`, `CHANNEL_DIST` constants | Lines 148–163 |
| `callClaude()` function | Lines 168–182 |
| `SEGMENT_SYSTEM`, `CAMPAIGN_SYSTEM`, `ADVISOR_SYSTEM` prompt strings | Lines 184–239 |
| `simulateDelivery()` function | Lines 244–282 |
| `parseClaudeJSON()` | Line 311–314 |

### Add: `src/api/client.js`

```js
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const getCustomers = (params) => api(`/customers?${new URLSearchParams(params)}`);
export const getSegments  = ()       => api('/segments');
export const postSegmentGenerate = (prompt) => api('/segments/generate', { method:'POST', body: JSON.stringify({ prompt }) });
export const postSegment  = (data)   => api('/segments', { method:'POST', body: JSON.stringify(data) });
export const getCampaigns = ()       => api('/campaigns');
export const postCampaignGenerate = (data) => api('/campaigns/generate', { method:'POST', body: JSON.stringify(data) });
export const postCampaign = (data)   => api('/campaigns', { method:'POST', body: JSON.stringify(data) });
export const sendCampaign = (id)     => api('/campaigns/send', { method:'POST', body: JSON.stringify({ campaignId: id }) });
export const getAnalytics = ()       => api('/analytics');
export const postAdvisor  = (data)   => api('/ai/advisor', { method:'POST', body: JSON.stringify(data) });
```

### Modify: `App.jsx`

**Before (current):**
```jsx
const [customers] = useState(ALL_CUSTOMERS);
const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
```

**After:**
```jsx
const [customers, setCustomers] = useState([]);
const [segments, setSegments] = useState([]);
const [campaigns, setCampaigns] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  Promise.all([getCustomers(), getSegments(), getCampaigns()])
    .then(([c, s, ca]) => {
      setCustomers(c.customers);
      setSegments(s.segments);
      setCampaigns(ca.campaigns);
    })
    .finally(() => setLoading(false));
}, []);
```

### Modify: `AudiencesView`

Replace `callClaude(SEGMENT_SYSTEM, query)` with:
```js
const result = await postSegmentGenerate(query);
// result already contains { segmentName, explanation, filters, matchingCustomers, count }
```

Replace `onSave(seg)` with:
```js
const saved = await postSegment(seg);
onSave(saved);    // pass DB-assigned id and count back up
```

### Modify: `CampaignsView`

Replace `callClaude(CAMPAIGN_SYSTEM, ...)` with:
```js
const aiContent = await postCampaignGenerate({ goal, segmentId: selectedSeg.id, channels: selectedChannels });
```

Replace `simulateDelivery(...)` with:
```js
await sendCampaign(activeCampaign.id);
// Live stats: poll GET /campaigns/:id every 2s and update UI
```

For live stats polling, add a `useEffect` with `setInterval` in `CampaignsView` that calls `api(`/campaigns/${activeCampaign.id}`)` every 2 seconds while `step === 3`, updating `liveStats` from the `stats` field.

### Modify: `AIAdvisorView`

Replace `callClaude(ADVISOR_SYSTEM, context)` with:
```js
const { answer } = await postAdvisor({
  question: q,
  conversationHistory: messages.slice(-6)  // last 6 turns for context
});
```

### Modify: `AnalyticsView`

Replace hardcoded `WEEKLY_DATA` / `CHANNEL_DIST` with:
```js
useEffect(() => {
  getAnalytics().then(data => setAnalytics(data));
}, []);
```

---

## 9. Implementation Roadmap

### Phase 1 — Database & Seed (Day 1)

1. Create MySQL database using `db/schema.sql`
2. Write `crm-backend/src/db/seed.js`:
   - Port the `generateCustomers()` seeded-random logic from React to Node.js
   - Generate 60 customers + ~5 orders each → insert into `customers` and `orders` tables
   - Insert `DEFAULT_SEGMENTS` into `segments`
   - Insert `INITIAL_CAMPAIGNS` into `campaigns` with corresponding `communications` rows
3. Verify: `SELECT * FROM customer_stats LIMIT 5;`

**Deliverable:** Populated DB, all stats matching the original prototype.

---

### Phase 2 — CRM Backend Core (Day 1–2)

1. Scaffold `crm-backend/src/index.js` with Express, cors, body-parser
2. Implement `GET /customers` (with search + status filter + pagination)
3. Implement `GET /segments` + `POST /segments`
4. Implement `GET /campaigns`
5. Implement `GET /analytics` (summary + weekly + channel distribution)
6. Implement `POST /receipt`

**Test:** Use Postman/curl — all read endpoints return data matching what was hardcoded in the prototype.

---

### Phase 3 — AI Routes (Day 2)

1. Port `SEGMENT_SYSTEM` prompt → `aiService.generateSegment()`
2. Implement `POST /segments/generate` — call AI, translate filters to SQL, return count
3. Port `CAMPAIGN_SYSTEM` prompt → `aiService.generateCampaign()`
4. Implement `POST /campaigns/generate`
5. Port `ADVISOR_SYSTEM` prompt → `aiService.askAdvisor()`
6. Implement `POST /ai/advisor` (fetch live analytics context before calling AI)

**Test:** Each route returns the same JSON shape the React component previously parsed.

---

### Phase 4 — Campaign Send & Channel Service (Day 3)

1. Build `channel-service` scaffold
2. Implement `POST /send` with async `simulator.js`
3. Implement `POST /receipt` in CRM backend (UPDATE communications, optionally INSERT order for conversions)
4. Implement `POST /campaigns/send` in CRM backend

**Test:** Send a campaign → watch `communications` rows progress through `sent → delivered → opened → clicked → converted` over ~10 seconds. Verify `GET /analytics` updates accordingly.

---

### Phase 5 — Frontend Migration (Day 3–4)

1. Create `frontend/src/api/client.js`
2. Strip mock data constants from `App.jsx`; replace with `useEffect` API fetches
3. Migrate `AudiencesView` — replace `callClaude` + `onSave` with API calls
4. Migrate `CampaignsView` — replace `callClaude` + `simulateDelivery` with API calls + polling
5. Migrate `AIAdvisorView` — replace `callClaude` with `POST /ai/advisor`
6. Migrate `AnalyticsView` — replace hardcoded arrays with `GET /analytics`
7. Migrate `DashboardView` — replace computed-from-mock values with analytics API data

**Test:** Full user flow — create segment → generate campaign → send → watch live stats — should look identical to the prototype.

---

### Phase 6 — Hardening (Day 4–5)

1. Add `errorHandler.js` middleware to CRM backend (uniform `{ error: "..." }` responses)
2. Add basic input validation (express-validator or manual checks) on POST routes
3. Add a loading/skeleton state to each frontend view during initial data fetch
4. Add `.env.example` files for both services
5. Write `README.md` with setup instructions (DB creation, seed, start commands)

---

## 10. Environment & Configuration

### `crm-backend/.env`
```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=crm_db
ANTHROPIC_API_KEY=sk-ant-...
CHANNEL_SERVICE_URL=http://localhost:5000
```

### `channel-service/.env`
```
PORT=5000
CRM_BACKEND_URL=http://localhost:4000
```

### `frontend/.env`
```
VITE_API_URL=http://localhost:4000
```

### Vite proxy (alternative to env var — for local dev)
```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', rewrite: path => path.replace(/^\/api/, '') }
    }
  }
}
```

---

## Key Design Decisions

**`customer_stats` as a VIEW rather than materialised columns** — LTV, order count, and `last_purchase_days` are always in sync with the `orders` table without any denormalisation risk. If performance becomes a concern, these can be materialised into a scheduled job.

**Filter-to-SQL in `segmentService.js`** — The `applyFilters()` utility from React is translated into a SQL WHERE clause generator. This preserves the same filter schema (`{field, operator, value}`) while executing server-side. The frontend can keep a local `applyFilters()` copy for instant preview before saving.

**Fire-and-forget campaign send** — `POST /campaigns/send` returns immediately after creating communication rows; it does not wait for the Channel Service. The frontend polls `GET /campaigns/:id` for live stats, exactly mirroring the UX of the current `simulateDelivery()` callback pattern.

**One communication row per customer per channel** — This is the correct granularity for analytics. Aggregations (`COUNT`, `SUM`) over this table power all dashboard metrics without any additional caching layer needed at this scale.

**Callbacks over webhooks** — The Channel Service calls `POST /receipt` directly rather than using a message queue. For a take-home project this is appropriate; a production system would use Redis/BullMQ or SQS between the Channel Service and the CRM backend.
