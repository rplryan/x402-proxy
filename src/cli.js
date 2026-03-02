#!/usr/bin/env node

import { program } from "commander";
import { createProxy } from "./index.js";

program
  .name("x402-proxy")
  .description("Dead-simple reverse proxy that adds x402 payment requirements to any API")
  .requiredOption("--upstream <url>", "Upstream API URL to proxy")
  .requiredOption("--pay-to <address>", "Wallet address to receive payments")
  .option("--port <number>", "Local port to listen on", "3000")
  .option("--price <amount>", "Price in USD per request (e.g. 0.001)", "0.001")
  .option("--network <chainId>", "EVM chain ID (e.g. eip155:8453 for Base mainnet)", "eip155:8453")
  .option("--facilitator <url>", "x402 facilitator URL", "https://facilitator.x402.org")
  .option("--routes <json>", "JSON string for per-route pricing config")
  .version("1.0.0");

program.parse();

const opts = program.opts();

let routes = null;
if (opts.routes) {
  try {
    routes = JSON.parse(opts.routes);
  } catch {
    console.error("Error: --routes must be valid JSON");
    process.exit(1);
  }
}

const { start } = createProxy({
  upstream: opts.upstream,
  payTo: opts.payTo,
  port: parseInt(opts.port, 10),
  price: opts.price,
  network: opts.network,
  facilitator: opts.facilitator,
  routes,
});

start().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
