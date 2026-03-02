# x402-proxy

[![npm](https://img.shields.io/npm/v/x402-proxy)](https://www.npmjs.com/package/x402-proxy)
[![license](https://img.shields.io/npm/l/x402-proxy)](./LICENSE)

Dead-simple reverse proxy that adds x402 payment requirements to any API.

Wrap any HTTP API with a payment gate in one command — no code changes required. AI agents and other x402-compatible clients pay per request before the proxy forwards traffic to your upstream.

---

## Quick Start

```bash
npx x402-proxy --upstream https://myapi.com --pay-to 0xYourWallet --price 0.001
```

Your API is now live on `http://localhost:3000`. Every request requires a valid x402 payment header before it reaches the upstream.

A free health check endpoint is always available without payment:

```
GET http://localhost:3000/__x402/health
```

---

## How It Works

```
Client  ──[HTTP + X-Payment header]──►  x402-proxy  ──[verified]──►  Upstream API
                                              │
                                        validates payment
                                        via x402 facilitator
```

1. The proxy receives an incoming request.
2. `@x402/express` middleware verifies the `X-Payment` header against the configured facilitator.
3. If payment is valid, the request is forwarded to the upstream API via `http-proxy-middleware`.
4. If payment is missing or invalid, the proxy returns a `402 Payment Required` response with instructions for how to pay.

No changes needed to your upstream API. No SDK integration. Just run the proxy in front of it.

---

## Installation

**Run without installing (recommended for quick use):**

```bash
npx x402-proxy --upstream https://myapi.com --pay-to 0xYourWallet
```

**Install globally:**

```bash
npm install -g x402-proxy
x402-proxy --upstream https://myapi.com --pay-to 0xYourWallet
```

**Use programmatically:**

```bash
npm install x402-proxy
```

```js
import { createProxy } from "x402-proxy";

const { start } = createProxy({
  upstream: "https://myapi.com",
  payTo: "0xYourWallet",
  price: "0.001",
});

await start();
```

---

## CLI Options

| Option | Description | Default |
|---|---|---|
| `--upstream <url>` | Upstream API URL to proxy **(required)** | — |
| `--pay-to <address>` | Wallet address to receive payments **(required)** | — |
| `--port <number>` | Local port to listen on | `3000` |
| `--price <amount>` | Price in USD per request | `0.001` |
| `--network <chainId>` | EVM chain ID | `eip155:8453` (Base mainnet) |
| `--facilitator <url>` | x402 facilitator URL | `https://facilitator.x402.org` |
| `--routes <json>` | JSON string for per-route pricing config | — |

---

## Per-Route Pricing

Use `--routes` to set different prices for different paths or methods. Pass a JSON object where each key is `"METHOD /path/*"`:

```bash
x402-proxy \
  --upstream https://myapi.com \
  --pay-to 0xYourWallet \
  --routes '{
    "GET /free/*":      { "accepts": { "price": "0" } },
    "GET /basic/*":     { "accepts": { "price": "0.001" } },
    "POST /premium/*":  { "accepts": { "price": "0.01" } }
  }'
```

Each route entry accepts an `accepts` object with any combination of:

| Field | Description |
|---|---|
| `price` | USD price for this route (e.g. `"0.005"`) |
| `network` | Chain ID override for this route |
| `payTo` | Payment recipient override for this route |
| `scheme` | Payment scheme (default: `"exact"`) |

Any fields omitted from a route's `accepts` object inherit the top-level defaults.

---

## Register in x402 Discovery

Once your proxy is running and publicly accessible, you can register it with the x402 discovery service so clients can find and pay your API automatically:

```
POST https://x402-discovery-api.onrender.com/register
```

See the [x402 Discovery API](https://x402-discovery-api.onrender.com) for registration details and the full API schema.

---

## Built On

- [`@x402/express`](https://www.npmjs.com/package/@x402/express) — x402 payment middleware for Express
- [`http-proxy-middleware`](https://www.npmjs.com/package/http-proxy-middleware) — battle-tested HTTP proxying
- [`express`](https://www.npmjs.com/package/express) — HTTP server framework

---

## Requirements

- Node.js >= 18

---

## License

MIT
