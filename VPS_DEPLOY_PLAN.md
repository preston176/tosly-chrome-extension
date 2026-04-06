# Tosly Backend — VPS Deploy Plan (Coolify)

## Pre-flight answers

| Question | Your answer |
|---|---|
| VPS IP address | <!-- fill in --> |
| Domain / subdomain for API | <!-- e.g. api.tosly.app --> |
| VPS provider | <!-- e.g. Hetzner, DigitalOcean, Vultr --> |
| VPS OS | Ubuntu 22.04 LTS |
| VPS RAM | <!-- e.g. 2GB --> |

---

## Why Coolify

- One-click Docker deploys from GitHub
- Automatic HTTPS via Let's Encrypt (no nginx config needed)
- Environment variable management in the UI
- Health check monitoring + auto-restart
- Free and self-hosted on your own VPS

---

## Step 1 — Install Coolify on VPS (one-time)

SSH into your VPS then run:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Coolify installs Docker, sets up its own reverse proxy (Traefik), and starts on port **8000**.

Access the UI at: `http://<YOUR_VPS_IP>:8000`

Create your admin account on first visit.

---

## Step 2 — Point your domain

Add a DNS A record:

```
api.tosly.app  →  <YOUR_VPS_IP>
```

Wait for propagation (usually < 5 min on Cloudflare).

---

## Step 3 — Connect GitHub to Coolify

In Coolify UI:
1. **Sources** → Add GitHub App → follow OAuth flow
2. Grant access to `tosly-chrome-extension` repo

---

## Step 4 — Create the service in Coolify

1. **New Resource** → **Application** → **GitHub**
2. Select repo: `tosly-chrome-extension`
3. Select branch: `deploy/backend`
4. Build pack: **Dockerfile**
5. Dockerfile path: `backend/Dockerfile`
6. Port: `8080`
7. Domain: `api.tosly.app` — Coolify handles TLS automatically

---

## Step 5 — Set environment variables

In the service **Environment Variables** tab:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini API key |

Never commit this to git — set it only in the Coolify UI.

---

## Step 6 — Deploy

Click **Deploy**. Coolify will:
1. Clone the repo
2. Build the Docker image from `backend/Dockerfile`
3. Start the container
4. Issue TLS cert for your domain
5. Route `https://api.tosly.app` → container port 8080

Health check: `https://api.tosly.app/health` should return `ok`.

---

## Step 7 — Update extension for production

Create `extension/.env.production`:

```env
PLASMO_PUBLIC_BACKEND_URL=https://api.tosly.app
```

Then `plasmo build` will bake in the production URL.

---

## Auto-deploy on push (optional)

In Coolify service settings → **Webhooks** → copy the deploy webhook URL.

In GitHub repo → **Settings → Webhooks** → add the URL.

Now every push to `deploy/backend` triggers a redeploy automatically.

---

## Checklist

- [ ] Fill in pre-flight answers above
- [ ] VPS provisioned (Ubuntu 22.04, min 1GB RAM)
- [ ] Coolify installed on VPS
- [ ] DNS A record pointing to VPS IP
- [ ] GitHub connected to Coolify
- [ ] Service created with correct Dockerfile path
- [ ] `GEMINI_API_KEY` set in Coolify env vars
- [ ] First deploy successful
- [ ] `https://api.tosly.app/health` returns `ok`
- [ ] `extension/.env.production` created with production URL
- [ ] Webhook set up for auto-deploy (optional)
