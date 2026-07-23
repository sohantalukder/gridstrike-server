# GridStrike Server

Backend API for GridStrike.

## Environment setup (production only)

This branch is configured for production-only environment loading.

1. Copy prod env template to `.env`:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client and migrate DB:

```bash
npx prisma generate
npx prisma migrate dev
```

### Practical DB & migration workflow

This project includes helper scripts for repeatable DB operations:

```bash
# 1) Smoke test the active DATABASE_URL
npm run db:check

# 1b) Test both DATABASE_URL and DIRECT_URL endpoint reachability
npm run db:reach

# 1a) Validate environment keys/format
npm run env:check

# 2) Generate Prisma client
npm run prisma:generate

# 3) Run local migrations (creates and applies migration files)
npm run db:migrate:local

# 4) Show migration status
npm run prisma:migrate:status

# 5) Apply migrations in production/database servers (non-interactive)
npm run db:migrate:prod
```

`npm run db:check` exits with code `0` when the DB is reachable and exits with code `1` when it cannot connect.

4. Start server:

```bash
NODE_ENV=prod npm run start:prod
```

API docs are disabled in production.

## API quick matrix

- `POST /api/v1/auth/*`
- `GET /api/v1/profile`
- `GET /api/v1/game-config`
- `GET /api/v1/weapons`, `/api/v1/weapons/:id`
- `GET /api/v1/abilities`, `/api/v1/abilities/:id`
- `GET /api/v1/missions`, `/api/v1/missions/active`, `/api/v1/missions/:id`, `/api/v1/missions/:id/claim`
- `GET /api/v1/daily-challenges/today`
- `POST /api/v1/game-results`
- `GET /api/v1/leaderboards/survival|missions|daily|me`
- `GET /api/v1/health*`
