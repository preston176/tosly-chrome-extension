# Tosly Backend — Deploy Plan (DigitalOcean + GitHub Actions CI/CD)

## Pre-flight answers

| Question | Your answer |
|---|---|
| Droplet IP address | <!-- fill in --> |
| SSH user | root (or your sudo user) |
| Domain / subdomain for API | <!-- e.g. api.tosly.app --> |

---

## Architecture

```
git push origin deploy/backend
        ↓
  GitHub Actions runs
        ↓
  SSH into droplet
  git pull + docker compose up --build
        ↓
  Container replaced in ~30s
        ↓
  https://api.tosly.app/analyze
```

No extra software on the droplet — just Docker + your container (~200MB total).

---

## Step 1 — SSH into your droplet

```bash
ssh root@<YOUR_DROPLET_IP>
```

---

## Step 2 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

---

## Step 3 — Install Caddy (HTTPS reverse proxy)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

Create `/etc/caddy/Caddyfile`:
```
api.tosly.app {
    reverse_proxy localhost:8080
}
```

```bash
systemctl enable caddy && systemctl start caddy
```

---

## Step 4 — Clone repo + set secrets

```bash
git clone https://github.com/preston176/tosly-chrome-extension.git /opt/tosly
echo "GEMINI_API_KEY=your_key_here" > /opt/tosly/backend/.env
```

---

## Step 5 — First deploy

```bash
cd /opt/tosly/backend
docker compose up -d --build
curl http://localhost:8080/health   # → ok
curl https://api.tosly.app/health   # → ok (after DNS propagates)
```

---

## Step 6 — Add DNS A record

```
api.tosly.app  →  <YOUR_DROPLET_IP>
```

---

## Step 7 — Set up GitHub Actions CI/CD

### 7a — Generate an SSH key pair for GitHub Actions

On your **local machine**:
```bash
ssh-keygen -t ed25519 -C "github-actions-tosly" -f ~/.ssh/tosly_deploy
```

This creates:
- `~/.ssh/tosly_deploy` (private key — goes to GitHub)
- `~/.ssh/tosly_deploy.pub` (public key — goes to droplet)

### 7b — Add public key to droplet

```bash
cat ~/.ssh/tosly_deploy.pub | ssh root@<YOUR_DROPLET_IP> "cat >> ~/.ssh/authorized_keys"
```

### 7c — Add secrets to GitHub

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `DO_HOST` | your droplet IP |
| `DO_USER` | `root` |
| `DO_SSH_KEY` | contents of `~/.ssh/tosly_deploy` (the private key) |

---

## Step 8 — GitHub Actions workflow

Already committed at `.github/workflows/deploy-backend.yml`:

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
      - name: Deploy to droplet
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USER }}
          key: ${{ secrets.DO_SSH_KEY }}
          script: |
            cd /opt/tosly
            git pull origin deploy/backend
            cd backend
            docker compose up -d --build
            docker image prune -f
```

Every push to `deploy/backend` that touches `backend/**` triggers:
1. SSH into droplet
2. `git pull`
3. `docker compose up -d --build`

---

## DigitalOcean firewall rules

| Purpose | Protocol | Port |
|---|---|---|
| SSH | TCP | 22 |
| HTTP (cert issuance) | TCP | 80 |
| HTTPS | TCP | 443 |

Port 8080 stays internal — Caddy proxies it, never exposed publicly.

---

## Checklist

- [ ] Fill in pre-flight answers above
- [ ] SSH access confirmed
- [ ] Docker installed
- [ ] Caddy installed + Caddyfile configured
- [ ] Repo cloned to `/opt/tosly`
- [ ] `.env` created with `GEMINI_API_KEY`
- [ ] `docker compose up -d --build` succeeded
- [ ] DNS A record added
- [ ] `https://api.tosly.app/health` returns `ok`
- [ ] Deploy SSH key generated and added to droplet
- [ ] `DO_HOST`, `DO_USER`, `DO_SSH_KEY` secrets added to GitHub
- [ ] GitHub Actions workflow committed and tested
- [ ] `extension/.env.production` created with production URL
