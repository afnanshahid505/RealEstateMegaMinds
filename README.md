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

