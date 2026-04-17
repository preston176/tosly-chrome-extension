# Tosly Backend — Deploy Plan (DigitalOcean Droplet)

## Pre-flight answers

| Question | Your answer |
|---|---|
| Droplet IP address | <!-- fill in --> |
| SSH user | root (or your sudo user) |
| Domain / subdomain | <!-- e.g. api.tosly.app (optional) --> |
| Docker already installed? | <!-- yes / no --> |

---

## Step 1 — SSH into your droplet

```bash
ssh root@<YOUR_DROPLET_IP>
```

---

## Step 2 — Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Verify:
```bash
docker --version
docker compose version
```

---

## Step 3 — Clone the repo

```bash
git clone https://github.com/preston176/tosly-chrome-extension.git /opt/tosly
cd /opt/tosly/backend
```

Or if the repo is private, use a GitHub personal access token:
```bash
git clone https://YOUR_TOKEN@github.com/preston176/tosly-chrome-extension.git /opt/tosly
```

---

## Step 4 — Set your environment variable

```bash
echo "GEMINI_API_KEY=your_key_here" > /opt/tosly/backend/.env
```

Never commit this file — it's in `.gitignore`.

---

## Step 5 — Build and start

```bash
cd /opt/tosly/backend
docker compose up -d --build
```

- `-d` runs it in the background
- `--build` builds the image from the Dockerfile

Check it's running:
```bash
docker compose ps
curl http://localhost:8080/health
# should return: ok
```

---

## Step 6 — Open the firewall port

In DigitalOcean dashboard → **Networking → Firewalls** → add an inbound rule:

| Type | Protocol | Port | Sources |
|---|---|---|---|
| Custom | TCP | 8080 | All IPv4, All IPv6 |

Or via `ufw` on the droplet:
```bash
ufw allow 8080/tcp
```

Test from your machine:
```bash
curl http://<YOUR_DROPLET_IP>:8080/health
```

---

## Step 7 — Point a domain + HTTPS (recommended)

Install Caddy — it handles HTTPS automatically:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

Create `/etc/caddy/Caddyfile`:
```
api.tosly.app {
    reverse_proxy localhost:8080
}
```

Start Caddy:
```bash
systemctl enable caddy
systemctl start caddy
```

Add a DNS A record:
```
api.tosly.app  →  <YOUR_DROPLET_IP>
```

Caddy auto-issues a Let's Encrypt cert. Test:
```bash
curl https://api.tosly.app/health
```

---

## Step 8 — Update extension for production

Create `extension/.env.production`:

```env
# If using domain:
PLASMO_PUBLIC_BACKEND_URL=https://api.tosly.app

# If using raw IP (not recommended):
PLASMO_PUBLIC_BACKEND_URL=http://<YOUR_DROPLET_IP>:8080
```

Then `plasmo build` bakes in the production URL.

---

## Subsequent deploys (pull latest + restart)

```bash
cd /opt/tosly
git pull
cd backend
docker compose up -d --build
```

---

## Useful commands

```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Check status
docker compose ps
```

---

## Checklist

- [ ] Fill in pre-flight answers above
- [ ] SSH access confirmed
- [ ] Docker installed and running
- [ ] Repo cloned to `/opt/tosly`
- [ ] `.env` file created with `GEMINI_API_KEY`
- [ ] `docker compose up -d --build` succeeded
- [ ] `curl http://localhost:8080/health` returns `ok`
- [ ] Firewall port 8080 open
- [ ] Caddy installed + Caddyfile configured (if using domain)
- [ ] DNS A record pointing to droplet IP
- [ ] `curl https://api.tosly.app/health` returns `ok`
- [ ] `extension/.env.production` created with production URL
