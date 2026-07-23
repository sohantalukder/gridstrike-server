# Cloudflare deploy for GridStrike Server

Use Cloudflare's build/deploy pipeline directly for this repo. This backend is
deployed as a Cloudflare Container behind a Worker because it is a NestJS Node
server, not a static site.

## Plan requirement

Cloudflare Containers are not available on a plain free Workers setup. This
deploy path needs Containers enabled on the account, which normally means using
the Workers Paid plan and having billing set up.

If the token already has `Containers` - `Edit` but deploy still fails with
`Unauthorized`, the account itself is probably not authorized for Containers yet.
Enable Workers Paid / Containers on the Cloudflare account, then redeploy.

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

If deploy fails with `Durable Object namespace name ... already in use`, a
previous failed deploy created the namespace before the full deploy completed.
This repo now uses `GridStrikeApiContainer` to avoid the old partial namespace
name `gridstrike-server_GridStrikeServerContainer`.

Cloudflare Containers need a container image. When `wrangler.jsonc` points to
`./Dockerfile`, Wrangler builds that image during deploy, so the deploy runner
must have Docker or a Docker-compatible CLI available. If the Cloudflare deploy
log says Docker is missing, run the first full deploy from a machine with Docker
or switch `image` in `wrangler.jsonc` to a prebuilt image reference.

## Build token

The deploy log can reach Docker image build and still fail with:

```text
Unauthorized
```

That means the token used by Workers Builds can deploy the Worker script but
cannot push/manage the Cloudflare Container image. Enabling `workers.dev` will
not fix that.

Use a custom **user API token** for this Worker build with these permissions:

- Account: `Account Settings` - `Read`
- Account: `Workers Scripts` - `Edit`
- Account: `Containers` - `Edit`
- User: `User Details` - `Read`
- User: `Memberships` - `Read`

If you attach a custom domain or route from Wrangler, also add:

- Zone: `Workers Routes` - `Edit`

Then select that token in Cloudflare:

1. Open `Workers & Pages`.
2. Open the `gridstrike-server` Worker.
3. Go to `Settings` -> `Builds`.
4. In `API token`, select the new token instead of the old build token.
5. Redeploy.

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
