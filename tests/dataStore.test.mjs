import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDataStore } from "../src/lib/dataStore.mjs";
import { validateBodyWeightInput, validateSetInput } from "../src/lib/validation.mjs";

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "training-store-"));
  return createDataStore({ filePath: join(dir, "app-data.json") });
}

const userA = { id: "u-a", telegramId: "1", username: "a", firstName: "A", photoUrl: "" };
const userB = { id: "u-b", telegramId: "2", username: "b", firstName: "B", photoUrl: "" };

test("bootstrap creates a user-scoped seeded program", async () => {
  const store = await makeStore();
  const user = await store.bootstrapUser(userA);
  const state = await store.getState(user.id);

  assert.equal(user.telegramId, "1");
  assert.equal(state.workoutDays.length, 3);
  assert.equal(state.workoutDays[0].exercises[0].name, "Жим штанги лёжа");
  assert.equal(state.workoutDays[0].exercises[0].techniqueMediaUrl, "");
});

test("addSet persists set fields and is idempotent for the same clientSetId", async () => {
  const store = await makeStore();
  const user = await store.bootstrapUser(userA);
  const session = await store.createSession(user.id, "monday", "2026-10-05");
  const input = {
    workoutSessionId: session.id,
    exerciseId: "monday-bench-press",
    setNumber: 1,
    weightKg: 80,
    reps: 8,
    notes: "легко",
    clientSetId: "tap-1",
  };

  const first = await store.addSet(user.id, input);
  const second = await store.addSet(user.id, input);
  const state = await store.getState(user.id);

  assert.equal(first.id, second.id);
  assert.equal(state.sets.length, 1);
  assert.equal(state.sets[0].exerciseKey, "zhim-shtangi-lezha");
  assert.equal(state.sets[0].weightKg, 80);
  assert.equal(state.sets[0].reps, 8);
  assert.equal(state.sets[0].clientSetId, "tap-1");
  assert.match(state.sets[0].completedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("another user cannot see the first user's sets or media", async () => {
  const store = await makeStore();
  const a = await store.bootstrapUser(userA);
  const b = await store.bootstrapUser(userB);
  const session = await store.createSession(a.id, "monday", "2026-10-05");

  await store.addSet(a.id, {
    workoutSessionId: session.id,
    exerciseId: "monday-bench-press",
    setNumber: 1,
    weightKg: 80,
    reps: 8,
    clientSetId: "tap-1",
  });
  await store.updateExerciseMedia(a.id, "monday-bench-press", {
    techniqueMediaType: "video",
    techniqueMediaUrl: "https://example.com/bench.mp4",
  });

  const stateB = await store.getState(b.id);

  assert.equal(stateB.sets.length, 0);
  assert.equal(stateB.workoutDays[0].exercises[0].techniqueMediaUrl, "");
});

test("validation rejects invalid set and body-weight inputs", () => {
  assert.equal(validateSetInput({ weightKg: -1, reps: 8 }).ok, false);
  assert.equal(validateSetInput({ weightKg: 501, reps: 8 }).ok, false);
  assert.equal(validateSetInput({ weightKg: 80, reps: 0 }).ok, false);
  assert.equal(validateSetInput({ weightKg: 80, reps: 101 }).ok, false);
  assert.equal(validateBodyWeightInput({ entryDate: "2026-10-05", weightKg: 19 }).ok, false);
  assert.equal(validateBodyWeightInput({ entryDate: "2026-10-05", weightKg: 301 }).ok, false);
});

test("body weight and media persist to disk", async () => {
  const store = await makeStore();
  const user = await store.bootstrapUser(userA);

  await store.addBodyWeight(user.id, { entryDate: "2026-10-05", weightKg: 82.4 });
  await store.updateExerciseMedia(user.id, "monday-bench-press", {
    techniqueMediaType: "image",
    techniqueMediaUrl: "https://example.com/bench.jpg",
  });

  const state = await store.getState(user.id);
  const file = JSON.parse(await readFile(store.filePath, "utf8"));

  assert.equal(state.latestBodyWeight.weightKg, 82.4);
  assert.equal(state.workoutDays[0].exercises[0].techniqueMediaType, "image");
  assert.equal(file.bodyWeights.length, 1);
  assert.equal(file.exerciseMedia.length, 1);
});
