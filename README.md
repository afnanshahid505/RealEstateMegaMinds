# Brick Factory ERP

Real-time factory management: dashboard, products, raw materials, production (with auto inventory), stock in, and customers.

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Or from the backend folder: `npm start` (not `node index.js` from `src/`).

API runs at `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` (proxies `/api` to backend)

## Demo logins

| Role  | Email                     | Password  |
|-------|---------------------------|-----------|
| Admin | ravi@brickfactory.com     | admin123  |
| Staff | staff@brickfactory.com    | staff123  |

## Role access

**Admin (Ravi):** Dashboard, create/approve products, customers, view stock in audit trail.

**Staff:** Enter raw material purchases, production entries, manual stock in; view approved products (read-only).

Production automatically deducts raw materials and creates a Stock In record with source `PRODUCTION`.
