# Tosly Backend — Deploy Plan (Fly.io)

## Pre-flight answers

| Question | Your answer |
|---|---|
| Fly.io app name | tosly-backend (or pick another) |
| Closest region | <!-- lhr=London, iad=US East, ord=US Central, sin=Singapore, syd=Sydney --> |
| Custom domain | <!-- e.g. api.tosly.app (optional) --> |

---

## Step 1 — Install flyctl

```bash
brew install flyctl
```

Or via the official installer:
```bash
curl -L https://fly.io/install.sh | sh
```

---

## Step 2 — Sign up / log in

```bash
fly auth signup   # new account
# or
fly auth login    # existing account
```

No credit card required for the free tier.

---

## Step 3 — Launch the app

From the `backend/` directory:

```bash
cd backend
fly launch --name tosly-backend --region lhr --no-deploy
```

- `--no-deploy` so we set secrets before first deploy
- It will detect the `Dockerfile` and `fly.toml` automatically
- Say **No** when asked to overwrite `fly.toml`

---

## Step 4 — Set secrets

```bash
fly secrets set GEMINI_API_KEY=your_key_here
```

Never committed to git — stored encrypted in Fly.io.

---

## Step 5 — Deploy

```bash
fly deploy
```

Fly builds the Docker image remotely, deploys to your chosen region, and gives you a URL like:
`https://tosly-backend.fly.dev`

---

## Step 6 — Verify

```bash
curl https://tosly-backend.fly.dev/health
# should return: ok
```

---

## Step 7 — Update extension for production

Create `extension/.env.production`:

```env
PLASMO_PUBLIC_BACKEND_URL=https://tosly-backend.fly.dev
```

Then `plasmo build` bakes in the production URL.

---

## Custom domain (optional)

```bash
fly certs add api.tosly.app
```

Then add a CNAME record in your DNS:
```
api.tosly.app  →  tosly-backend.fly.dev
```

Fly handles TLS automatically.

---

## Subsequent deploys

Any time you push changes to the backend:

```bash
cd backend
fly deploy
```

Or set up GitHub Actions for auto-deploy on push (see below).

---

## GitHub Actions auto-deploy (optional)

Get your Fly API token:
```bash
fly tokens create deploy
```

Add it to GitHub repo → **Settings → Secrets** → `FLY_API_TOKEN`

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [deploy/backend]
    paths: [backend/**]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: fly deploy --remote-only
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## Checklist

- [ ] Fill in pre-flight answers above
- [ ] `flyctl` installed
- [ ] `fly auth signup` or `fly auth login`
- [ ] `fly launch` run from `backend/` (no overwrite of fly.toml)
- [ ] `fly secrets set GEMINI_API_KEY=...`
- [ ] `fly deploy` succeeded
- [ ] `https://tosly-backend.fly.dev/health` returns `ok`
- [ ] `extension/.env.production` created with production URL
- [ ] Custom domain set up (optional)
- [ ] GitHub Actions auto-deploy set up (optional)
