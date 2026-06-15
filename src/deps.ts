import type { Config } from "./config.js";
import type { AblefyBackend } from "./ablefy/backend.js";
import type { PaymentRail } from "./payment/rail.js";
import type { Meter } from "./payment/meter.js";
import type { CoachLLM } from "./coach/coach.js";
import type { EarningsSink } from "./earnings/sink.js";

/** Everything the tools need. Swapping fakes for real impls happens here, in index.ts. */
export interface Deps {
  config: Config;
  backend: AblefyBackend;
  rail: PaymentRail;
  meter: Meter;
  coach: CoachLLM;
  earnings: EarningsSink;
}
