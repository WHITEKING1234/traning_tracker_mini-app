import test from "node:test";
import assert from "node:assert/strict";
import { getListenOptions } from "../src/server.mjs";

test("production server binds to all interfaces when HOST is not set", () => {
  assert.deepEqual(getListenOptions({ NODE_ENV: "production", PORT: "10000" }), {
    host: "0.0.0.0",
    port: 10000,
  });
});

test("development server keeps localhost as the default host", () => {
  assert.deepEqual(getListenOptions({ NODE_ENV: "development" }), {
    host: "127.0.0.1",
    port: 3000,
  });
});

test("explicit HOST wins over environment defaults", () => {
  assert.deepEqual(getListenOptions({ NODE_ENV: "production", HOST: "127.0.0.1", PORT: "4000" }), {
    host: "127.0.0.1",
    port: 4000,
  });
});
