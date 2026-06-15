import os from "node:os";
import path from "node:path";

/** Resolve `~` and relative paths to an absolute path. */
function resolveHome(p: string): string {
  if (p.startsWith("~")) return path.join(os.homedir(), p.slice(1));
  return path.resolve(p);
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface Config {
  // ablefy backend
  backendKind: "fake" | "http";
  ablefyApiBase: string;
  sellerToken: string;
  coachSlug: string;
  // pricing / meter — the MCP owns these
  pricePerQ: number;
  monthlyCap: number;
  currency: string;
  // payment rail
  paymentRail: "mock" | "algorand";
  // coach LLM
  coachLlm: "fake" | "anthropic";
  anthropicApiKey: string;
  coachModel: string;
  // local state files
  earningsFile: string;
  meterFile: string;
}

/** Read configuration from the environment, applying slice-1 defaults. */
export function loadConfig(): Config {
  const stateDir = path.join(os.homedir(), ".ablefy-mcp");
  return {
    backendKind: process.env.ABLEFY_BACKEND === "http" ? "http" : "fake",
    ablefyApiBase: process.env.ABLEFY_API_BASE ?? "http://localhost:3000",
    sellerToken: process.env.ABLEFY_SELLER_TOKEN ?? "",
    coachSlug: process.env.COACH_PRODUCT_SLUG ?? "the-systems-studio",
    pricePerQ: num("PRICE_PER_Q", 0.1),
    monthlyCap: num("MONTHLY_CAP", 9.0),
    currency: process.env.CURRENCY ?? "EUR",
    paymentRail: process.env.PAYMENT_RAIL === "algorand" ? "algorand" : "mock",
    coachLlm: process.env.COACH_LLM === "anthropic" ? "anthropic" : "fake",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    coachModel: process.env.COACH_MODEL ?? "claude-haiku-4-5-20251001",
    earningsFile: resolveHome(process.env.EARNINGS_FILE ?? path.join(stateDir, "earnings.json")),
    meterFile: resolveHome(process.env.METER_FILE ?? path.join(stateDir, "meter.json")),
  };
}
