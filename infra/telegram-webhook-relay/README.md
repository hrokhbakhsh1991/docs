# Denali Telegram webhook relay

This Worker is a single network edge for all workspaces. It forwards:

```text
POST /webhooks/telegram/<tenantId>/<integrationId>
```

and, for authenticated API egress:

```text
POST /telegram-api
```

The API remains the authority for tenant routing, bot tokens, webhook secrets,
permissions, receipt review, tickets, and all business state. The Worker does
not persist or log Telegram tokens and is not a polling bot. The outbound
endpoint accepts only a server-to-Worker bearer secret and an allowlisted Bot
API method; it forwards the token in memory to Telegram.

## Deploy once

1. Create a Cloudflare Worker from this directory using `wrangler.toml`.
2. Set `API_ORIGIN` to the public HTTPS origin of the API, for example
   `https://api.example.com`.
3. Use the Worker URL as `TELEGRAM_WEBHOOK_BASE_URL` on the API deployment.
4. Set `TELEGRAM_API_RELAY_URL` to the same Worker URL and store
   `TELEGRAM_API_RELAY_SHARED_SECRET` as a Worker secret and API secret.
5. Restart the API and run Telegram connection setup for each workspace once.

The API then generates a separate webhook secret and webhook path per
workspace connection. Adding another workspace does not require changing this
Worker; only the API stores that workspace's bot token and configuration.

## Local verification

```bash
node --test test/index.test.mjs
```
