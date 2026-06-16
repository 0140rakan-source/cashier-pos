# كاشير — Cashier POS

Professional local-first POS system for Saudi small businesses (restaurants, cafes, retail).

## Quick Start

```bash
# 1. Install dependencies (run once)
cd /Users/rakan/Desktop/cashier-pos
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# 2. Start PostgreSQL (first time only — already installed)
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 -l /opt/homebrew/var/postgresql@16/logfile start

# 3. Setup database (first time only)
cd backend
npx prisma@6.5.0 migrate dev
node prisma/seed.js
cd ..

# 4. Start development servers (opens both backend + frontend)
npm run dev
```

## Stack

- **Backend:** Node.js + Express + Prisma ORM + PostgreSQL 16
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand + i18next
- **Desktop:** Electron (Phase 5 packaging)
- **Language:** Arabic (RTL) + English

## Default Credentials

- **Admin:** username: `admin`, password: `admin123`
- **Cashier:** username: `cashier`, password: `1234`, PIN: `1234`
