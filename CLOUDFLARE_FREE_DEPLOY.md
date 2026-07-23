# Cloudflare deploy for GridStrike Server

Use Cloudflare's build/deploy pipeline directly for this repo. This backend is
deployed as a Cloudflare Container behind a Worker because it is a NestJS Node
server, not a static site.

## Cloudflare dashboard settings

Set these values in Cloudflare:

- Root directory: `/`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Remove this old deploy command:

```bash
pm2 restart gridstrike-server --update-env || pm2 start dist/main.js --name gridstrike-server
```

That command only works on a VPS or VM where PM2 is installed and can keep a
Node process running. Cloudflare's deploy command must finish after deploying,
so it should run Wrangler with this repo's `wrangler.jsonc`.

The deploy files are:

- `wrangler.jsonc`: Worker, Durable Object, and Container configuration
- `cloudflare/worker.ts`: forwards requests to the backend container
- `Dockerfile`: builds and starts the NestJS API on port `8080`

Cloudflare Containers need a container image. When `wrangler.jsonc` points to
`./Dockerfile`, Wrangler builds that image during deploy, so the deploy runner
must have Docker or a Docker-compatible CLI available. If the Cloudflare deploy
log says Docker is missing, run the first full deploy from a machine with Docker
or switch `image` in `wrangler.jsonc` to a prebuilt image reference.

## Build token

Keep using the existing Cloudflare build token:

```text
gridstrike-server build token
```

## Environment variables

Configure the backend runtime environment values in the Cloudflare Worker
settings. `wrangler.jsonc` has `keep_vars: true` so deploys will not overwrite
dashboard-managed variables/secrets.

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

Your app already includes:

- `GET /api/v1/health` in `HealthController` for basic health probes.
