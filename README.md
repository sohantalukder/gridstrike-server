# GridStrike Server

Backend API for GridStrike.

## Local setup (no Docker)

1. Install PostgreSQL and Redis locally.
2. Create database: `createdb gridstrike`
3. Copy environment file:

```bash
cp .env.example .env
```

4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and migrate DB:

```bash
npx prisma generate
npx prisma migrate dev
```

6. Start server:

```bash
npm run start:dev
```

API docs (development): `http://localhost:3000/docs`

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
