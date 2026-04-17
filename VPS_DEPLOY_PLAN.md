# Tosly Backend — Deploy Plan (DigitalOcean + Coolify CI/CD)

## Pre-flight answers

| Question | Your answer |
|---|---|
| Droplet IP address | <!-- fill in --> |
| SSH user | root (or your sudo user) |
| Domain / subdomain for API | <!-- e.g. api.tosly.app --> |
| Coolify UI domain (optional) | <!-- e.g. coolify.tosly.app --> |

---

## Architecture

```
GitHub push to deploy/backend
        ↓
  Coolify (on droplet)
  detects push via webhook
        ↓
  builds Dockerfile
        ↓
  replaces running container
        ↓
  Traefik (built into Coolify)
  handles HTTPS + routing
        ↓
  https://api.tosly.app/analyze
```

No manual SSH needed after initial setup.

---

## Step 1 — SSH into your droplet

```bash
ssh root@<YOUR_DROPLET_IP>
```

---

## Step 2 — Install Coolify (installs Docker too)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This installs:
- Docker + Docker Compose
- Coolify itself
- Traefik (reverse proxy + auto HTTPS)

Access the UI at: `http://<YOUR_DROPLET_IP>:8000`

Create your admin account on first visit.

> **Firewall:** open port 8000 temporarily for setup, then restrict it to your IP once done.

---

## Step 3 — Open required ports on DigitalOcean

In DO dashboard → **Networking → Firewalls** → add inbound rules:

| Purpose | Protocol | Port |
|---|---|---|
| Coolify UI (setup only) | TCP | 8000 |
| HTTP (for cert issuance) | TCP | 80 |
| HTTPS | TCP | 443 |
| SSH | TCP | 22 |

Port 8080 does NOT need to be public — Traefik proxies it internally.

---

## Step 4 — Point your domain

Add DNS A records:

```
api.tosly.app      →  <YOUR_DROPLET_IP>
coolify.tosly.app  →  <YOUR_DROPLET_IP>   (optional, for Coolify UI)
```

---

## Step 5 — Connect GitHub to Coolify

In Coolify UI:
1. **Settings → Sources** → **Add** → **GitHub App**
2. Follow the OAuth flow
3. Grant access to `tosly-chrome-extension` repo

---

## Step 6 — Create the service

1. **Projects → New Project** → name it `tosly`
2. **New Resource → Application → GitHub**
3. Select:
   - Repo: `tosly-chrome-extension`
   - Branch: `deploy/backend`
   - Build pack: **Dockerfile**
   - Dockerfile path: `backend/Dockerfile`
   - Port: `8080`
4. Domain: `api.tosly.app`
5. Coolify handles TLS automatically via Traefik

---

## Step 7 — Set environment variables

In the service → **Environment Variables** tab:

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini API key |

Never in git — only in Coolify UI.

---

## Step 8 — Enable auto-deploy on push

In the service → **Settings**:
- Enable **Auto Deploy** → on push to `deploy/backend`

Coolify sets up the GitHub webhook automatically.

Now every `git push origin deploy/backend` triggers a rebuild and zero-downtime redeploy.

---

## Step 9 — First deploy

Click **Deploy** in the Coolify UI. Watch the build logs in real time.

Verify:
```bash
curl https://api.tosly.app/health
# should return: ok
```

---

## Step 10 — Update extension for production

Create `extension/.env.production`:

```env
PLASMO_PUBLIC_BACKEND_URL=https://api.tosly.app
```

Then `plasmo build` bakes in the production URL.

---

## Ongoing deploy workflow

```bash
# Make backend changes locally, then:
git add .
git commit -m "fix: ..."
git push origin deploy/backend
# Coolify detects push → rebuilds → redeploys automatically
```

---

## Useful Coolify features

- **Build logs** — real-time in the UI
- **Container logs** — live log streaming
- **Rollback** — one click to previous deploy
- **Health checks** — auto-restarts if `/health` fails
- **Notifications** — Slack/email on deploy success/failure

---

## Checklist

- [ ] Fill in pre-flight answers above
- [ ] SSH access confirmed
- [ ] Coolify installed (`curl ... | bash`)
- [ ] Coolify UI accessible at `http://<IP>:8000`
- [ ] Admin account created
- [ ] DNS A records pointing to droplet IP
- [ ] GitHub connected to Coolify
- [ ] Service created (repo, branch, Dockerfile path, port)
- [ ] `GEMINI_API_KEY` set in Coolify env vars
- [ ] Auto-deploy enabled
- [ ] First deploy successful
- [ ] `https://api.tosly.app/health` returns `ok`
- [ ] `extension/.env.production` created with production URL
- [ ] Port 8000 restricted to your IP (after setup)
