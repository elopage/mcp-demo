// Launch the MCP exactly as Claude Desktop will — from the command/args/env in
// claude_desktop_config.json — and list its tools. Proves the Desktop launch works
// (catches "spawn node ENOENT" / bad env). Run: npm run desktop:verify
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cfgPath = path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
const ablefy = JSON.parse(fs.readFileSync(cfgPath, "utf8")).mcpServers?.ablefy;
if (!ablefy) {
  console.log("FAIL · no ablefy server in the Desktop config");
  process.exit(1);
}
console.log("launching as Desktop would:");
console.log("  command:", ablefy.command);
console.log("  args:   ", (ablefy.args || []).join(" "));

// Don't bind the earnings port here (Desktop may already hold it).
const transport = new StdioClientTransport({
  command: ablefy.command,
  args: ablefy.args,
  env: { ...ablefy.env, EARNINGS_SERVE: "0" },
});
const client = new Client({ name: "desktop-verify", version: "1.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log(`PASS · server booted; ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
await client.close();
