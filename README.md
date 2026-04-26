# 💸 EZSPENDING

A full-stack personal spending tracker with dashboard analytics.

## Features

- **User Registration & Login** — email, first name, last name, address
- **Dashboard** — spending summaries (daily / weekly / monthly / yearly) with bar charts and category breakdown pie chart
- **Add Expenses** — manual entry with amount, description, category, date/time, and optional receipt attachment (image or PDF)
- **Spending Records** — filterable table with pagination, receipt viewer, and delete support
- **Categories** — 8 built-in categories (Food, Transport, Entertainment, Shopping, Health, Education, Bills, Other)

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend  | Node.js + Express |
| Database | SQLite via `node:sqlite` (built-in, no installation needed) |
| Auth     | JWT + bcryptjs |
| Uploads  | Multer (images & PDF, max 10MB) |

## Quick Start

### Prerequisites
- Node.js v24+
- npm

### 1. Backend

```bash
cd backend
cp .env.example .env        # edit JWT_SECRET if desired
npm install
npm run dev                 # starts on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), register an account, and start tracking.

## Project Structure

```
EZSPENDING/
├── backend/
│   ├── src/
│   │   ├── db.js              SQLite setup & seeding
│   │   ├── index.js           Express app
│   │   ├── middleware/auth.js  JWT guard
│   │   └── routes/
│   │       ├── auth.js        POST /api/auth/register, /login
│   │       ├── spending.js    CRUD + summary /api/spending
│   │       └── categories.js  GET/POST /api/categories
│   └── uploads/               Receipt files (gitignored)
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   ├── Dashboard.tsx  Summary cards + charts
        │   ├── AddSpending.tsx
        │   └── SpendingList.tsx
        ├── components/
        │   ├── Navbar.tsx
        │   └── ProtectedRoute.tsx
        ├── context/AuthContext.tsx
        └── api/client.ts
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/spending/summary` | Dashboard data |
| GET | `/api/spending` | List records (filter by period/category) |
| POST | `/api/spending` | Add record (multipart/form-data) |
| PUT | `/api/spending/:id` | Update record |
| DELETE | `/api/spending/:id` | Delete record |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create custom category |
