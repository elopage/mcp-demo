import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Deps } from "./deps.js";
import { registerFindCoach } from "./tools/findCoach.js";
import { registerGetOffer } from "./tools/getOffer.js";
import { registerAskCoach } from "./tools/askCoach.js";
import { registerAuthorizeAllowance } from "./tools/authorizeAllowance.js";
import { registerPayFlat } from "./tools/payFlat.js";
import { registerCreatorEarnings } from "./tools/creatorEarnings.js";

/** Build the ablefy MCP server with all tools registered against the given deps. */
export function buildServer(deps: Deps): McpServer {
  const server = new McpServer({ name: "ablefy", version: "0.1.0" });
  registerFindCoach(server, deps);
  registerGetOffer(server, deps);
  registerAskCoach(server, deps);
  registerAuthorizeAllowance(server, deps);
  registerPayFlat(server, deps);
  registerCreatorEarnings(server, deps);
  return server;
}
