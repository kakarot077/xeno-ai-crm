'use strict';

/**
 * seed.js
 * Populates crm_db with:
 *   - 500 realistic customers (Indian names, cities)
 *   - 2500–5000 realistic orders spread across customers
 *
 * Run: node src/db/seed.js
 */

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

console.log("DB_HOST =", process.env.DB_HOST);
console.log("DB_USER =", process.env.DB_USER);
console.log("DB_PASSWORD =", process.env.DB_PASSWORD);
console.log("DB_NAME =", process.env.DB_NAME);

const mysql = require('mysql2/promise');
// ─────────────────────────────────────────
// Reference data
// ─────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav','Aditya','Akash','Amit','Amitabh','Ananya','Anjali','Ankit','Ansh','Arjun',
  'Arnav','Aryan','Ayaan','Deepak','Deepika','Devika','Dhruv','Divya','Farhan','Gaurav',
  'Isha','Ishaan','Jatin','Kabir','Karan','Kavita','Kavya','Kirti','Kritika','Kunal',
  'Lakshmi','Mahesh','Manish','Meera','Mohit','Neha','Nisha','Pankaj','Pooja','Prachi',
  'Pranav','Priya','Rahul','Raj','Rajesh','Ravi','Riya','Rohan','Rohini','Rohit',
  'Sachin','Sangeeta','Sanjay','Sara','Shivam','Shruti','Sneha','Sonia','Suresh','Tanvi',
  'Tanya','Uday','Uma','Vaibhav','Vansh','Varun','Vidya','Vijay','Vipul','Vishal',
  'Yash','Zoya','Aishwarya','Bhavna','Chetan','Disha','Ekta','Faisal','Geeta','Hemant',
  'Indu','Jaya','Kalpana','Lata','Madhuri','Nalini','Omkar','Pallavi','Qasim','Rekha',
  'Smita','Tarun','Urmila','Vimal','Wasim','Yamini','Zubin','Nandini','Ojas','Payal',
];

const LAST_NAMES = [
  'Sharma','Verma','Gupta','Kumar','Singh','Mehta','Joshi','Rao','Iyer','Nair',
  'Reddy','Patel','Shah','Chopra','Malhotra','Kapoor','Banerjee','Chatterjee','Mukherjee','Bose',
  'Pillai','Menon','Krishnan','Subramaniam','Agarwal','Mishra','Tiwari','Pandey','Shukla','Dubey',
  'Desai','Jain','Soni','Bhatia','Arora','Saxena','Yadav','Chauhan','Rathore','Rajput',
  'Bhatt','Negi','Thakur','Rawat','Bisht','Naik','Pawar','Jadhav','More','Shinde',
  'Ghosh','Das','Roy','Sen','Dutta','Paul','Saha','Biswas','Mandal','Chakraborty',
];

const CITIES = [
  'Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad',
  'Jaipur','Surat','Lucknow','Kanpur','Nagpur','Indore','Thane','Bhopal','Visakhapatnam',
  'Patna','Vadodara','Ghaziabad','Ludhiana','Agra','Nashik','Faridabad','Meerut',
  'Rajkot','Kalyan','Vasai-Virar','Varanasi','Srinagar','Aurangabad','Dhanbad','Amritsar',
  'Navi Mumbai','Allahabad','Ranchi','Howrah','Coimbatore','Jabalpur','Gwalior','Vijayawada',
  'Jodhpur','Madurai','Raipur','Kota','Chandigarh','Guwahati','Solapur','Hubli','Tiruchirappalli',
];

const CHANNELS  = ['WhatsApp', 'Email', 'SMS', 'RCS'];
const STATUSES  = ['active', 'active', 'active', 'at-risk', 'at-risk', 'churned'];
const CATEGORIES = [
  'fashion','electronics','home-decor','beauty','sports','books',
  'grocery','toys','jewellery','furniture','footwear','accessories',
];
const TAG_POOL = [
  'fashion','premium','loyal','discount-seeker','new','electronics',
  'seasonal','high-ltv','referral','mobile-user','desktop-user','vip',
];

// ─────────────────────────────────────────
// Seeded pseudo-random (deterministic)
// ─────────────────────────────────────────
let _seed = 20240101;
function rand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff;
  return ((_seed >>> 0) / 0xffffffff);
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

// ─────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function randomDateBetween(startDaysAgo, endDaysAgo) {
  return daysAgo(randInt(endDaysAgo, startDaysAgo));
}

// ─────────────────────────────────────────
// Customer generator
// ─────────────────────────────────────────
function generateCustomers(count = 500) {
  const customers = [];
  const usedEmails = new Set();

  for (let i = 1; i <= count; i++) {
    const id        = `C${String(i).padStart(3, '0')}`;
    const firstName = pick(FIRST_NAMES);
    const lastName  = pick(LAST_NAMES);
    const name      = `${firstName} ${lastName}`;

    // Unique email
    let email;
    let attempt = 0;
    do {
      const suffix  = attempt === 0 ? i : `${i}_${attempt}`;
      const domain  = pick(['gmail.com','yahoo.in','outlook.com','hotmail.com','rediffmail.com']);
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${suffix}@${domain}`;
      attempt++;
    } while (usedEmails.has(email));
    usedEmails.add(email);

    const phone          = `+91 ${randInt(70000,99999)} ${randInt(10000,99999)}`;
    const city           = pick(CITIES);
    const preferredChan  = pick(CHANNELS);
    const engagementScore= randInt(10, 98);
    const status         = pick(STATUSES);
    const joinDate       = randomDateBetween(1200, 30);
    const tags           = pickN(TAG_POOL, randInt(1, 4));

    customers.push({
      id, name, email, phone, city,
      preferred_channel: preferredChan,
      engagement_score:  engagementScore,
      status,
      join_date:         joinDate,
      tags:              JSON.stringify(tags),
    });
  }
  return customers;
}

// ─────────────────────────────────────────
// Order generator
// ─────────────────────────────────────────
function generateOrders(customers) {
  const orders = [];
  let orderIndex = 1;

  for (const customer of customers) {
    // Vary order count by status
    let minOrders, maxOrders;
    if (customer.status === 'active') {
      minOrders = 4; maxOrders = 16;
    } else if (customer.status === 'at-risk') {
      minOrders = 2; maxOrders = 8;
    } else {
      minOrders = 1; maxOrders = 5;
    }
    const orderCount = randInt(minOrders, maxOrders);

    for (let j = 0; j < orderCount; j++) {
      const id = `ORD-${String(orderIndex).padStart(5, '0')}`;
      orderIndex++;

      // Realistic order amounts by category
      const category  = pick(CATEGORIES);
      let amount;
      switch (category) {
        case 'electronics':  amount = randInt(2000,  80000); break;
        case 'furniture':    amount = randInt(3000,  50000); break;
        case 'jewellery':    amount = randInt(1500,  40000); break;
        case 'fashion':      amount = randInt(500,   8000);  break;
        case 'footwear':     amount = randInt(400,   6000);  break;
        case 'beauty':       amount = randInt(200,   3000);  break;
        case 'sports':       amount = randInt(500,   10000); break;
        case 'books':        amount = randInt(100,   1500);  break;
        case 'grocery':      amount = randInt(200,   2500);  break;
        case 'toys':         amount = randInt(300,   4000);  break;
        case 'home-decor':   amount = randInt(500,   12000); break;
        case 'accessories':  amount = randInt(200,   5000);  break;
        default:             amount = randInt(300,   5000);
      }

      // Churned customers have older orders; active ones have recent ones
      let orderDate;
      if (customer.status === 'churned') {
        orderDate = randomDateBetween(730, 180);
      } else if (customer.status === 'at-risk') {
        orderDate = randomDateBetween(365, 45);
      } else {
        orderDate = randomDateBetween(180, 1);
      }

      orders.push({
        id,
        customer_id: customer.id,
        amount:      parseFloat(amount.toFixed(2)),
        order_date:  orderDate,
        category,
      });
    }
  }
  return orders;
}

// ─────────────────────────────────────────
// Insert helpers
// ─────────────────────────────────────────
async function insertCustomers(conn, customers) {
  console.log(`[seed] Inserting ${customers.length} customers…`);
  const sql = `
    INSERT INTO customers
      (id, name, email, phone, city, preferred_channel, engagement_score, status, join_date, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  for (const c of customers) {
    await conn.execute(sql, [
      c.id, c.name, c.email, c.phone, c.city,
      c.preferred_channel, c.engagement_score,
      c.status, c.join_date, c.tags,
    ]);
  }
  console.log('[seed] Customers inserted ✓');
}

async function insertOrders(conn, orders) {
  console.log(`[seed] Inserting ${orders.length} orders in batches…`);
  const BATCH = 500;
  const sql = `
    INSERT INTO orders (id, customer_id, amount, order_date, category)
    VALUES (?, ?, ?, ?, ?)
  `;
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);
    for (const o of batch) {
      await conn.execute(sql, [o.id, o.customer_id, o.amount, o.order_date, o.category]);
    }
    console.log(`[seed]   …${Math.min(i + BATCH, orders.length)} / ${orders.length}`);
  }
  console.log('[seed] Orders inserted ✓');
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'crm_db',
    multipleStatements: false,
  });

  try {
    console.log('[seed] Connected to MySQL');

    // Wipe existing seed data (safe for dev re-runs)
    console.log('[seed] Clearing existing data…');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await conn.execute('TRUNCATE TABLE communications');
    await conn.execute('TRUNCATE TABLE campaigns');
    await conn.execute('TRUNCATE TABLE segments');
    await conn.execute('TRUNCATE TABLE orders');
    await conn.execute('TRUNCATE TABLE customers');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    const customers = generateCustomers(500);
    await insertCustomers(conn, customers);

    const orders = generateOrders(customers);
    await insertOrders(conn, orders);

    // Verify
    const [[{ cnt: cCount }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM customers');
    const [[{ cnt: oCount }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM orders');
    const [[{ ltv }]]         = await conn.execute('SELECT ROUND(SUM(amount),2) AS ltv FROM orders');

    console.log('');
    console.log('────────────────────────────────');
    console.log(' Seed complete');
    console.log(`  Customers : ${cCount}`);
    console.log(`  Orders    : ${oCount}`);
    console.log(`  Total LTV : ₹${Number(ltv).toLocaleString('en-IN')}`);
    console.log('────────────────────────────────');
    console.log('');
    console.log('Run: SELECT * FROM customer_stats LIMIT 5;');
  } catch (err) {
    console.error('[seed] ERROR:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
