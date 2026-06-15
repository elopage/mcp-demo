#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import type { Deps } from "./deps.js";
import { FakeAblefyBackend } from "./ablefy/fakeBackend.js";
import { MockRail } from "./payment/mockRail.js";
import { Meter } from "./payment/meter.js";
import { FakeCoach } from "./coach/fakeCoach.js";
import { FileEarningsSink } from "./earnings/fileSink.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // Slice 1: every dependency is a fake/mock. Later slices swap real impls in here
  // by config (real Rails backend, Algorand rail, Anthropic coach) — same interfaces.
  const deps: Deps = {
    config,
    backend: new FakeAblefyBackend(config),
    rail: new MockRail(),
    meter: new Meter(config.meterFile),
    coach: new FakeCoach(),
    earnings: new FileEarningsSink(config.earningsFile, config.currency),
  };

  const server = buildServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // NB: never log to stdout — it's the JSON-RPC channel. stderr only.
  console.error(`[ablefy-mcp] ready · rail=${config.paymentRail} coach=${config.coachLlm}`);
}

main().catch((err) => {
  console.error("[ablefy-mcp] fatal:", err);
  process.exit(1);
});
