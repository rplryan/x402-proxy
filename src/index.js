import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

/**
 * Create an x402 payment proxy.
 *
 * @param {object} options
 * @param {string} options.upstream          - Upstream API base URL
 * @param {string} options.payTo             - Wallet address to receive payments
 * @param {number} [options.port=3000]       - Local port to listen on
 * @param {string} [options.price='0.001']   - USD price per request (e.g. "0.001")
 * @param {string} [options.network]         - EVM chain ID (default: eip155:8453 Base mainnet)
 * @param {string} [options.facilitator]     - x402 facilitator URL
 * @param {object} [options.routes]          - Per-route pricing overrides (keyed by "METHOD /path/*")
 * @returns {{ app: import('express').Express, start: () => Promise<import('http').Server> }}
 */
export function createProxy(options) {
  const {
    upstream,
    payTo,
    port = 3000,
    price = "0.001",
    network = "eip155:8453",
    facilitator = "https://facilitator.x402.org",
    routes = null,
  } = options;

  const priceStr = normalizePrice(price);

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitator });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(network, new ExactEvmScheme());

  const routesConfig = buildRoutes({ payTo, price: priceStr, network, routes });

  const app = express();

  // Health check — always bypasses payment
  app.get("/__x402/health", (_req, res) => {
    res.json({ status: "ok", upstream, payTo, price: priceStr, network });
  });

  // Payment middleware
  app.use(paymentMiddleware(routesConfig, resourceServer));

  // Reverse proxy — forwards all paid requests upstream
  app.use(
    "/",
    createProxyMiddleware({
      target: upstream,
      changeOrigin: true,
      on: {
        error: (err, _req, res) => {
          console.error("[x402-proxy] upstream error:", err.message);
          if (!res.headersSent) {
            res.status(502).json({ error: "Bad Gateway", message: err.message });
          }
        },
      },
    })
  );

  return {
    app,
    start() {
      return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
          printBanner({ upstream, payTo, price: priceStr, network, port, facilitator });
          resolve(server);
        });
        server.on("error", reject);
      });
    },
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Build the routes config for paymentMiddleware.
 * If the caller supplied per-route overrides, convert/merge them into the v2 shape.
 * Otherwise produce a global catch-all for the four common HTTP methods.
 */
function buildRoutes({ payTo, price, network, routes }) {
  if (routes) {
    const result = {};
    for (const [key, config] of Object.entries(routes)) {
      result[key] = {
        ...config,
        accepts: {
          scheme: config.accepts?.scheme ?? "exact",
          price: normalizePrice(config.accepts?.price ?? config.price ?? price),
          network: config.accepts?.network ?? network,
          payTo: config.accepts?.payTo ?? payTo,
        },
      };
    }
    return result;
  }

  // Global catch-all for all common HTTP methods
  const routeAccepts = { scheme: "exact", price, network, payTo };
  return {
    "GET /*":    { accepts: routeAccepts },
    "POST /*":   { accepts: routeAccepts },
    "PUT /*":    { accepts: routeAccepts },
    "DELETE /*": { accepts: routeAccepts },
  };
}

/** Ensure price string starts with "$". */
function normalizePrice(p) {
  const s = String(p);
  return s.startsWith("$") ? s : `$${s}`;
}

function printBanner({ upstream, payTo, price, network, port, facilitator }) {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║              x402-proxy  v1.0.0                  ║
  ╚══════════════════════════════════════════════════╝

    Listening   → http://localhost:${port}
    Upstream    → ${upstream}
    Pay-to      → ${payTo}
    Price       → ${price} per request
    Network     → ${network}
    Facilitator → ${facilitator}

    Health      → http://localhost:${port}/__x402/health

  All requests require x402 payment. Press Ctrl+C to stop.
`);
}
