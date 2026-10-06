import test from "node:test";
import assert from "node:assert/strict";
import { createRestTimerState } from "../src/lib/restTimer.mjs";

test("rest timer reports remaining seconds without going negative", () => {
  assert.deepEqual(createRestTimerState({ startedAtMs: 0, durationSeconds: 90, nowMs: 30000 }), {
    remainingSeconds: 60,
    done: false,
  });
  assert.deepEqual(createRestTimerState({ startedAtMs: 0, durationSeconds: 90, nowMs: 95000 }), {
    remainingSeconds: 0,
    done: true,
  });
});

test("rest timer treats invalid duration as done", () => {
  assert.deepEqual(createRestTimerState({ startedAtMs: 0, durationSeconds: 0, nowMs: 0 }), {
    remainingSeconds: 0,
    done: true,
  });
});
