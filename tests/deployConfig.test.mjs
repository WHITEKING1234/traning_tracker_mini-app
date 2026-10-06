import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Render blueprint runs the Node web service with health checks and secret bot token", async () => {
  const blueprint = await readFile("render.yaml", "utf8");

  assert.match(blueprint, /type:\s*web/);
  assert.match(blueprint, /runtime:\s*node/);
  assert.match(blueprint, /buildCommand:\s*npm test/);
  assert.match(blueprint, /startCommand:\s*npm start/);
  assert.match(blueprint, /healthCheckPath:\s*\/api\/health/);
  assert.match(blueprint, /autoDeployTrigger:\s*commit/);
  assert.match(blueprint, /key:\s*BOT_TOKEN\s*\n\s*sync:\s*false/);
});
