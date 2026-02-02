# Cloudflare Worker Deployment Guide

## Prerequisites

1. **Cloudflare Account** - Sign up at [cloudflare.com](https://cloudflare.com)
2. **Square Developer Account** - Set up at [developer.squareup.com](https://developer.squareup.com)

## Step 1: Login to Cloudflare

```bash
cd worker
npx wrangler login
```

This opens a browser to authenticate with Cloudflare.

## Step 2: Create KV Namespace

```bash
npx wrangler kv:namespace create INVENTORY_KV
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "INVENTORY_KV"
id = "YOUR_ACTUAL_KV_ID"  # <-- Replace with the ID from the command
```

## Step 3: Set Square API Secrets

Get these from your Square Developer Dashboard:

```bash
# Production credentials
npx wrangler secret put SQUARE_ACCESS_TOKEN
npx wrangler secret put SQUARE_APPLICATION_ID
npx wrangler secret put SQUARE_LOCATION_ID

# Optional: webhook signature key
npx wrangler secret put WEBHOOK_SIGNATURE_KEY
```

Each command will prompt you to enter the value securely.

## Step 4: Update Configuration

Edit `wrangler.toml`:

```toml
[vars]
SQUARE_ENVIRONMENT = "sandbox"  # Change to "production" when ready
CORS_ORIGIN = "https://ravensquill.marziale.tech"
```

## Step 5: Deploy

```bash
npx wrangler deploy
```

Note the deployed URL (e.g., `https://ravensquill-api.YOUR_SUBDOMAIN.workers.dev`)

## Step 6: Update Frontend

In `index.html`, update the API_BASE variable:

```javascript
var API_BASE = 'https://ravensquill-api.YOUR_SUBDOMAIN.workers.dev';
```

Also update the Square SDK initialization with your Application ID and Location ID.

## Step 7: Configure Square Webhooks

1. Go to Square Developer Dashboard > Your App > Webhooks
2. Add a new webhook subscription
3. URL: `https://ravensquill-api.YOUR_SUBDOMAIN.workers.dev/api/webhook`
4. Subscribe to events:
   - `inventory.count.updated`
   - `catalog.version.updated`

## Step 8: Initial Sync

Trigger an initial inventory sync:

```bash
curl -X POST https://ravensquill-api.YOUR_SUBDOMAIN.workers.dev/api/sync
```

## Testing

### Test with Sandbox First

1. Use Square Sandbox credentials initially
2. Set `SQUARE_ENVIRONMENT = "sandbox"` in wrangler.toml
3. Use sandbox Square Web Payments SDK URL in index.html

### Test Endpoints

```bash
# Health check
curl https://YOUR_WORKER_URL/api/health

# Get items
curl https://YOUR_WORKER_URL/api/items

# Manual sync
curl -X POST https://YOUR_WORKER_URL/api/sync
```

## Going Live

1. Update secrets with production Square credentials
2. Change `SQUARE_ENVIRONMENT` to `"production"`
3. Update index.html to use production Square SDK URL
4. Redeploy: `npx wrangler deploy`

## Local Development

```bash
# Create .dev.vars with local secrets
echo "SQUARE_ACCESS_TOKEN=your_sandbox_token" > .dev.vars
echo "SQUARE_APPLICATION_ID=your_app_id" >> .dev.vars
echo "SQUARE_LOCATION_ID=your_location_id" >> .dev.vars

# Run locally
npm run dev
```
