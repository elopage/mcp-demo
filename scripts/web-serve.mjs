// Standalone buyer landing page server. Equivalent to running the MCP with WEB_SERVE=1,
// but without starting the MCP transport (useful for previewing the page during development).
// Run: npm run web:serve
import { loadConfig } from "../dist/config.js";
import { FakeAblefyBackend } from "../dist/ablefy/fakeBackend.js";
import { HttpAblefyBackend } from "../dist/ablefy/httpBackend.js";
import { MockRail } from "../dist/payment/mockRail.js";
import { Meter } from "../dist/payment/meter.js";
import { FakeCoach } from "../dist/coach/fakeCoach.js";
import { FileEarningsSink } from "../dist/earnings/fileSink.js";
import { startWebServer } from "../dist/webServer.js";

const config = loadConfig();
const deps = {
  config,
  backend: config.backendKind === "http" ? new HttpAblefyBackend(config) : new FakeAblefyBackend(config),
  rail: new MockRail(),
  meter: new Meter(config.meterFile),
  coach: new FakeCoach(),
  earnings: new FileEarningsSink(config.earningsFile, config.currency),
};

startWebServer(deps);
console.log(`\nOpen: http://127.0.0.1:${config.webPort}/\n`);
