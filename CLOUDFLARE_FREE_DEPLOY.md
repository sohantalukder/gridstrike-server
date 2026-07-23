# Auto deploy to Cloudflare (free tier) for this backend

Because this project is a NestJS server (HTTP + WebSocket + Prisma + Redis), the clean free plan setup is:

- Host app on a small VPS/container host (your origin server).
- Put Cloudflare on your domain as DNS + proxy + SSL.
- Push to `main` triggers GitHub Actions, which builds and deploys to the origin server.

## Why not direct Cloudflare Workers

- Cloudflare Workers are great, but this app uses NestJS + Socket.IO + ioredis and is best kept on a Node runtime.
- On free Cloudflare, this setup is typically done as an **origin + proxy** pattern (Cloudflare in front, server elsewhere).

## What to configure in GitHub Secrets

Create these repository secrets:

- `PROD_HOST`: public IP or SSH host of your server
- `PROD_SSH_USER`: SSH user
- `PROD_SSH_KEY`: private key for deploy user
- `PROD_SSH_PORT`: usually `22`
- `PROD_APP_DIR`: server path (for example `/home/ubuntu/gridstrike-server`)

### Optional

- `PM2_NAME` if you want custom process name (default: `gridstrike-server`)

## Environment variables for your server `.env`

These are the values your backend reads directly from `.env`:

- `NODE_ENV` (must be `prod`)
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWKS_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`

You can create the file on the server with:

```bash
cp .env.example /home/ubuntu/gridstrike-server/.env
nano /home/ubuntu/gridstrike-server/.env
```

Then fill real values (especially secrets and DB/Redis URLs). Keep `.env` file on the server only.

Example command for fresh server:

```bash
cd /home/ubuntu/gridstrike-server
cp .env.example .env
chmod 600 .env
```

## Cloudflare DNS (free)

1. Add DNS record: `api` (or root) -> your server IP.
2. Enable orange-cloud proxy.
3. Turn SSL/TLS to **Full** or **Full (strict)**.
4. Keep your app bound to port `3000` on origin (`PORT=3000`).
5. Point `api.your-domain.com` to this DNS name.

Your app already includes:

- `GET /api/v1/health` in `HealthController` for basic health probes.

## One-time server setup (origin)

On the server, install pm2 and keep it available:

```bash
npm i -g pm2
```

If first run after clone/deploy:

```bash
npm ci
npm run build
pm2 start dist/main.js --name gridstrike-server
pm2 save
pm2 startup
```

After every GitHub deploy, the action runs `pm2 restart gridstrike-server --update-env`.

## Next step

Commit these files and push to `main` to test the first automated deploy.
