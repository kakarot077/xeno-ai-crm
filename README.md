# Xeno AI CRM

A full-stack, AI-native Customer Relationship Management (CRM) platform featuring customer segmentation, AI-generated campaigns, multi-channel communication simulation, and real-time analytics — built with Node.js, Express, MySQL, React, and the Google Gemini API.

**Live Demo:**
- Frontend: [xeno-ai-crm-nine.vercel.app](https://xeno-ai-crm-nine.vercel.app)
- Backend API: [xeno-ai-crm-production.up.railway.app](https://xeno-ai-crm-production.up.railway.app)

---

## Features

- **Customer Management** — Paginated, searchable customer directory backed by a `customer_stats` view (LTV, order count, last purchase, engagement score)
- **Audience Segmentation** — Build dynamic segments using flexible filters (e.g. `ltv > 1000`), with live audience preview before saving
- **AI Segment Builder** — Describe an audience in plain English (*"customers who bought fashion items but haven't purchased in 30 days"*) and Gemini converts it into structured, ready-to-preview filters
- **AI Message Generator** — Generate channel-appropriate campaign copy from a campaign goal and target segment with one click
- **AI Campaign Assistant** — The flagship feature: a single prompt (*"run campaign for inactive users with 20% discount"*) returns a full campaign draft — target audience filters, message copy, and recommended channel — which can be applied directly to the campaign form for review
- **Campaign Management** — Create multi-channel campaigns (WhatsApp, Email, SMS, RCS) targeted at saved segments
- **Campaign Execution Simulation** — Simulated message delivery lifecycle (queued → sent → delivered → read → clicked → converted) written to a `communications` table via staggered async jobs
- **Analytics Dashboard** — Real-time funnel metrics, channel performance breakdown, revenue tracking, and per-campaign drill-downs
- **MySQL Persistence** — All data backed by a relational schema with proper foreign keys and aggregation views
- **Production-Ready Configuration** — Environment-variable-driven database connection with connection pooling

---

## Tech Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Frontend    | React (Vite), Tailwind CSS, Axios, React Router |
| Backend     | Node.js, Express.js                  |
| Database    | MySQL 8 (`mysql2/promise`)            |
| AI          | Google Gemini API (`gemini-2.0-flash` via `@google/generative-ai`) |
| Hosting     | Railway (backend + MySQL), Vercel (frontend) |

---

## Folder Structure

```
xeno-ai-crm/
├── frontend/                  # React (Vite) application
│   ├── src/
│   │   ├── api/                # Axios client (customers, segments, campaigns, analytics, ai)
│   │   ├── layouts/             # Sidebar, app shell
│   │   ├── pages/                # Dashboard, Segments, Campaigns, Analytics
│   │   └── utils/                 # Formatters, helpers
│   ├── package.json
│   └── .env                       # VITE_API_URL
│
├── src/                        # Express backend
│   ├── controllers/             # Route handlers (campaigns, segments, analytics)
│   ├── services/                 # Business logic (segment filter engine, delivery simulation)
│   │   ├── segmentService.js       # Filter → SQL translation (FIELD_MAP, operators)
│   │   └── simulationService.js    # Async communication lifecycle simulator
│   ├── db/
│   │   ├── connection.js          # MySQL pool
│   │   └── seed.js                 # Database seeding script
│   ├── middleware/                # Error handling
│   ├── routes/
│   │   ├── customers.js
│   │   ├── segments.js
│   │   ├── campaigns.js
│   │   ├── analytics.js
│   │   └── ai.js                   # Gemini-powered AI routes
│   └── index.js                    # App entry point
│
├── schema.sql                  # Database schema (tables + views)
├── package.json                # Backend dependencies
└── .env                         # Backend environment variables
```

---

## Setup Instructions (Local Development)

### Prerequisites

- Node.js 18+
- MySQL 8 (local instance or remote)
- npm
- A Google Gemini API key ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))

### 1. Clone the repository

```bash
git clone https://github.com/kakarot077/xeno-ai-crm.git
cd xeno-ai-crm
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Set up the database

Create a local MySQL database and import the schema:

```bash
mysql -u root -p -e "CREATE DATABASE crm_db"
mysql -u root -p crm_db < schema.sql
```

### 4. Configure environment variables

Copy `.env.example` to `.env` (see [Environment Variables](#environment-variables) below) and fill in your local MySQL credentials and Gemini API key.

### 5. Seed the database (optional)

```bash
npm run seed
```

### 6. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Environment Variables

### Backend (`.env` at project root)

| Variable         | Description                          | Example                  |
|-------------------|----------------------------------------|----------------------------|
| `DB_HOST`        | MySQL host                             | `localhost` or `thomas.proxy.rlwy.net` |
| `DB_PORT`        | MySQL port                             | `3306` or `41006`         |
| `DB_USER`        | MySQL username                         | `root`                     |
| `DB_PASSWORD`    | MySQL password                         | `your_password`            |
| `DB_NAME`        | Database name                          | `crm_db` or `railway`     |
| `PORT`           | Port the Express server listens on     | `3000`                      |
| `GEMINI_API_KEY` | Google Gemini API key for AI routes    | `AIza...`                    |

**Railway MySQL note:** When using Railway's managed MySQL, the plugin exposes both internal (`MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`) and public proxy (`MYSQL_PUBLIC_URL`) variables. This project reads from `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT` — map Railway's variables to these names in your service's Variables tab.

**Gemini API key note:** Generate a key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). The free tier has per-minute and per-day rate limits — AI routes return a `429` with a `retryDelay` if exceeded; the frontend surfaces this as a friendly "AI is rate-limited, try again shortly" message.

### Frontend (`frontend/.env`)

| Variable        | Description                  | Example                                          |
|------------------|--------------------------------|----------------------------------------------------|
| `VITE_API_URL`  | Base URL of the backend API   | `https://xeno-ai-crm-production.up.railway.app`   |

---

## Running Locally

### Start the backend

```bash
npm start
```

The API will be available at `http://localhost:3000`.

For development with auto-restart on file changes:

```bash
npm run dev
```

### Start the frontend

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Deployment (Railway)

### 1. Push your code to GitHub

Railway deploys directly from a connected GitHub repository.

### 2. Create a MySQL service

In your Railway project, click **+ New → Database → MySQL**. Railway will provision a managed MySQL instance and expose connection variables.

### 3. Import your schema and data

Using your MySQL service's public proxy connection details (Variables tab → `MYSQLHOST`, `MYSQLPORT`, `MYSQLPASSWORD` for the proxy — these look like `xxxx.proxy.rlwy.net` and a port other than `3306`):

```bash
mysqldump -u root -p crm_db > crm_db_dump.sql
mysql -h <proxy-host>.proxy.rlwy.net -P <proxy-port> -u root -p<password> railway < crm_db_dump.sql
```

> On Windows, pass the password inline with no space after `-p` (e.g. `-pYourPassword123`) to avoid issues with the interactive password prompt.

### 4. Deploy the backend service

1. Click **+ New → GitHub Repo** and select this repository
2. Railway auto-detects the Node.js app and uses `npm start` (as defined in `package.json`)
3. Go to the new service's **Variables** tab and add the values copied directly from your MySQL service's public proxy connection (`MYSQLHOST`/`MYSQLPORT`/`MYSQLPASSWORD` for the **proxy**, not the internal `mysql.railway.internal` host), plus your Gemini key:
   ```
   DB_HOST=<proxy-host>.proxy.rlwy.net
   DB_PORT=<proxy-port>
   DB_USER=root
   DB_PASSWORD=<mysql-root-password>
   DB_NAME=railway
   PORT=3000
   GEMINI_API_KEY=<your-gemini-api-key>
   ```
   > **Why the public proxy and not the internal host?** Railway's internal hostname (`mysql.railway.internal`) requires both services to be correctly networked within the same project and can intermittently fail with `ETIMEDOUT`. The public proxy endpoint is slightly slower but connects reliably from any service — and from your local machine for running `mysqldump`/`mysql` imports — which is what this project uses in production.
4. Go to **Settings → Networking** and click **Generate Domain** to expose a public URL

### 5. Verify the deployment

```bash
curl https://<your-app>.up.railway.app/health
curl https://<your-app>.up.railway.app/customers
```

### 6. Deploy the frontend (Vercel)

1. Import the same GitHub repo into Vercel
2. Set **Root Directory** to `frontend`
3. Vercel auto-detects the Vite framework
4. Add environment variable:
   ```
   VITE_API_URL=https://<your-backend>.up.railway.app
   ```
5. Deploy

---

## API Endpoints

| Method | Endpoint                          | Description                                  |
|--------|-------------------------------------|-------------------------------------------------|
| GET    | `/health`                          | Health check — returns server status            |
| GET    | `/customers`                       | Paginated customer list with search/status filters |
| GET    | `/segments`                        | List all segments with live audience counts      |
| POST   | `/segments`                        | Create a new segment                              |
| POST   | `/segments/preview`                | Preview audience count + sample for given filters |
| GET    | `/segments/:id`                    | Get a single segment with its filters and live audience preview |
| GET    | `/campaigns`                       | List all campaigns with aggregated stats          |
| POST   | `/campaigns`                       | Create a new campaign                             |
| GET    | `/campaigns/:id`                   | Get a single campaign's details and stats          |
| POST   | `/campaigns/:id/send`              | Launch a campaign and trigger delivery simulation |
| PATCH  | `/campaigns/:id/status`            | Update a campaign's lifecycle status (draft → active → completed) |
| GET    | `/analytics/summary`               | Overall analytics: totals, channel breakdown, top campaigns |
| GET    | `/analytics/campaigns/:id/stats`   | Detailed funnel stats for a specific campaign      |
| POST   | `/ai/generate-message`             | Generate campaign message copy from a goal + segment name |
| POST   | `/ai/generate-segment`             | Convert a natural-language audience description into structured segment filters |
| POST   | `/ai/generate-campaign`            | Generate a full campaign draft (segment + message + channel + goal) from one prompt |

### Example: Health Check

```bash
curl https://xeno-ai-crm-production.up.railway.app/health
```

```json
{ "status": "ok", "timestamp": "2026-06-13T08:21:24.026Z" }
```

### Example: List Customers

```bash
curl https://xeno-ai-crm-production.up.railway.app/customers
```

```json
{
  "customers": [
    {
      "id": "C173",
      "name": "Vimal Malhotra",
      "email": "vimal.malhotra173@hotmail.com",
      "city": "Chandigarh",
      "ltv": "352405.00",
      "orderCount": 15,
      "status": "active"
    }
  ],
  "total": 500,
  "page": 1,
  "pages": 25
}
```

### Example: AI Segment Builder

```bash
curl -X POST https://xeno-ai-crm-production.up.railway.app/ai/generate-segment \
  -H "Content-Type: application/json" \
  -d '{ "description": "customers who bought fashion items but havent purchased in 30 days" }'
```

```json
{
  "name": "Inactive Fashion Buyers",
  "explanation": "Customers tagged 'fashion' who haven't purchased in over 30 days",
  "filters": [
    { "field": "tags", "operator": "contains", "value": "fashion" },
    { "field": "last_purchase_days", "operator": "gt", "value": 30 }
  ]
}
```

### Example: AI Campaign Assistant

```bash
curl -X POST https://xeno-ai-crm-production.up.railway.app/ai/generate-campaign \
  -H "Content-Type: application/json" \
  -d '{ "prompt": "run campaign for inactive users with 20% discount" }'
```

```json
{
  "segment": {
    "name": "Inactive Customers",
    "explanation": "Customers who haven't purchased in over 30 days",
    "filters": [
      { "field": "last_purchase_days", "operator": "gt", "value": 30 }
    ],
    "audience_count": 84
  },
  "message": "Hey [Name], we miss you! Here's 20% off your next order — come back and treat yourself 🎁",
  "channel": "WhatsApp",
  "goal": "Re-engage inactive customers with a 20% discount offer"
}
```

> **Note on the AI assistant's design:** `/ai/generate-campaign` returns a *draft only* — it does not create a segment or campaign automatically. The frontend's "Use This Campaign" action calls `POST /segments` with the AI's filters, then pre-fills the campaign form for the marketer to review and edit before saving. This avoids orphaned segments if a marketer abandons the flow midway, and keeps the human in the loop on the final send.

---

## AI Architecture Notes

All AI routes live in `src/routes/ai.js` and use `@google/generative-ai` with `gemini-2.0-flash`.

- **`/ai/generate-segment`** and **`/ai/generate-campaign`** constrain Gemini's output via an explicit field/operator whitelist in the prompt (`ltv`, `order_count`, `last_purchase_days`, `avg_order_value`, `engagement_score`, `city`, `status`, `preferred_channel`, `tags` × `gt/lt/gte/lte/eq/neq/in/contains`). This guarantees the returned JSON filters are always compatible with `segmentService.js`'s `buildWhereClause()` — no separate validation/mapping layer needed between AI output and the SQL filter engine.
- Responses are parsed defensively: markdown code fences (` ```json `) are stripped before `JSON.parse`, and malformed/incomplete AI responses return a `502` with a message asking the marketer to rephrase, rather than crashing.
- `/ai/generate-campaign` enriches its response with a live `audience_count` (via `getAudienceCount()`) so the marketer sees real reach before committing to anything.
- Rate limiting: Gemini's free tier returns `429` with a `retryDelay`. All three routes propagate this; the frontend detects `429` in the error message and shows "AI is rate-limited — wait ~60 seconds and try again" instead of a raw error.

---

## Troubleshooting

### `connect ETIMEDOUT` or `getaddrinfo ENOTFOUND`

The configured `DB_HOST` is unreachable from where the app is running.

- If deploying on Railway, ensure you're using the correct host — the **internal** hostname (`mysql.railway.internal`) only works for services within the same Railway project; the **public proxy** host (e.g. `xxxx.proxy.rlwy.net`) works from anywhere
- Verify the value isn't a literal unresolved placeholder (e.g. `${{MySQL.MYSQLHOST}}` printed as-is) — check your logs to confirm `DB_HOST` resolves to an actual hostname

### `Access denied for user 'root'@'...'`

Credentials mismatch.

- Double-check `DB_USER` and `DB_PASSWORD` against the exact values shown in your MySQL service's **Variables** tab — copy-paste rather than retype to avoid case-sensitivity errors
- If using `mysql` CLI on Windows and pasting into the password prompt doesn't work, pass the password inline instead: `mysql -h <host> -P <port> -u root -p<password> <db>` (no space after `-p`)

### `Table 'railway.customer_stats' doesn't exist`

The database schema hasn't been imported yet.

- Run `mysqldump` on your local database and import the resulting `.sql` file into the remote MySQL instance using the public proxy connection (see [Deployment](#deployment-railway) step 3)

### `TypeError: Cannot read properties of undefined (reading 'isServer')`

This occurs when `mysql2.createPool()` receives a malformed configuration — typically from passing a raw connection string alongside other config options, or passing `undefined` because an environment variable wasn't set.

- Use a plain config object instead of a connection string:
  ```js
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  ```
- Always coerce `DB_PORT` to a `Number` — some `mysql2` versions throw obscure errors if it's passed as a string

### Frontend shows "Network Error" / `ERR_CONNECTION_REFUSED` to `localhost`

The deployed frontend is still pointing at a local backend URL.

- Confirm `VITE_API_URL` is set correctly in your hosting provider's environment variables (e.g. Vercel → Project Settings → Environment Variables)
- Environment variable changes require a **redeploy** to take effect — existing builds have the old value baked in
- Variable names must be prefixed with `VITE_` for Vite to expose them to client-side code

### CORS errors in the browser console

- Ensure the backend's CORS middleware allows your frontend's origin:
  ```js
  app.use(cors()); // allows all origins — fine for development/demo
  ```
  For production, restrict to your frontend's domain:
  ```js
  app.use(cors({ origin: 'https://your-frontend.vercel.app' }));
  ```

### AI routes return `404 Not Found` for the model

The Gemini model name isn't available for your API key/region.

- This project uses `gemini-2.0-flash`. If you see `models/gemini-1.5-flash is not found`, your key doesn't support that model — stick with `gemini-2.0-flash`, or call `ListModels` on the Gemini API to see what's available for your key.

### AI routes return `429 Too Many Requests`

Gemini's free-tier rate limit has been hit (per-minute and/or per-day).

- The error response includes a `retryDelay` (e.g. `"retryDelay": "35s"`) — wait that long and retry
- The frontend already handles this gracefully with a "wait and try again" message
- If this persists across many minutes, the **daily** quota is likely exhausted; it resets at midnight Pacific Time

### AI routes return `400 Missing required fields`

The request body field names don't match what the route expects.

- `/ai/generate-message` expects `{ goal, segmentName, channel? }`
- `/ai/generate-segment` expects `{ description }`
- `/ai/generate-campaign` expects `{ prompt }`

---

## License

This project was built as part of an internship/assignment submission.