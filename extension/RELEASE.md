# Tosly Extension — Build & Release

## CI/CD overview

Two GitHub Actions workflows handle extension builds:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| [`extension-build.yml`](../.github/workflows/extension-build.yml) | Push/PR to `main` touching `extension/**` | Builds + packages, uploads artifacts |
| [`extension-release.yml`](../.github/workflows/extension-release.yml) | Tag matching `extension-v*` | Builds, creates GitHub Release with zip, optionally publishes to Chrome Web Store |

## Cutting a release

```bash
# 1. Bump version in extension/package.json (e.g. 0.0.1 → 0.1.0)
# 2. Commit
git commit -am "release: extension v0.1.0"

# 3. Tag and push
git tag extension-v0.1.0
git push origin main --tags
```

The release workflow will:
1. Build with `PLASMO_PUBLIC_BACKEND_URL=https://tosly-backend.onrender.com`
2. Package as `tosly-0.1.0.zip`
3. Create a GitHub Release with auto-generated notes
4. (Optional) Auto-publish to the Chrome Web Store if secrets are set

## Configuration

### Repository variable (recommended)

Set in **GitHub → Settings → Secrets and variables → Actions → Variables**:

- `PLASMO_PUBLIC_BACKEND_URL` — backend URL injected at build time. Defaults to `https://tosly-backend.onrender.com` if unset.

### Chrome Web Store auto-publish (optional)

To enable auto-publishing on every release tag, set these **secrets**:

- `CWS_EXTENSION_ID` — your extension ID from the Chrome Web Store
- `CWS_CLIENT_ID` — Google OAuth client ID
- `CWS_CLIENT_SECRET` — Google OAuth client secret
- `CWS_REFRESH_TOKEN` — long-lived refresh token

If `CWS_EXTENSION_ID` is unset, the publish step is skipped silently and the workflow only produces the GitHub Release zip (you upload manually to CWS).

#### Generating CWS credentials

1. Create OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (type: Desktop app)
2. Enable the Chrome Web Store API
3. Generate refresh token following the [chrome-webstore-upload-cli docs](https://github.com/fregante/chrome-webstore-upload-cli#-set-up)

## Local build

```bash
cd extension
npm ci --legacy-peer-deps
PLASMO_PUBLIC_BACKEND_URL=https://tosly-backend.onrender.com npm run build
npm run package
# → extension/build/chrome-mv3-prod.zip
```

## Artifacts

Every build on `main` uploads two artifacts to the workflow run (downloadable for 14–30 days):

- **`tosly-extension-build`** — unpacked production build (load via `chrome://extensions` → Load unpacked)
- **`tosly-extension-zip`** — packaged zip for Chrome Web Store upload


