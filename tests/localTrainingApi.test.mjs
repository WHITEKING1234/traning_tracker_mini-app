import test from "node:test";
import assert from "node:assert/strict";
import { createLocalTrainingApi } from "../public/localTrainingApi.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function createApi() {
  return createLocalTrainingApi({
    storage: createMemoryStorage(),
    now: () => new Date("2026-10-05T12:00:00.000Z"),
    getUser: () => ({ id: 777, username: "akbar", first_name: "Akbar" }),
  });
}

test("local API bootstraps the approved program without a backend", async () => {
  const api = createApi();

  const boot = await api.get("/api/bootstrap?today=2026-10-05");

  assert.equal(boot.user.telegramId, "777");
  assert.equal(boot.user.firstName, "Akbar");
  assert.equal(boot.todayWorkout.title, "Понедельник");
  assert.equal(boot.workoutDays.length, 3);
  assert.equal(boot.latestBodyWeight, null);
});

test("local API saves sessions, sets, progress, body weight, and media", async () => {
  const api = createApi();
  const sessionResult = await api.send("POST", "/api/sessions", {
    workoutDayId: "monday",
    sessionDate: "2026-10-05",
  });

  const setResult = await api.send("POST", "/api/sets", {
    workoutSessionId: sessionResult.session.id,
    exerciseId: "monday-bench-press",
    setNumber: 1,
    weightKg: "80",
    reps: "8",
    clientSetId: "bench-1",
  });
  const duplicate = await api.send("POST", "/api/sets", {
    workoutSessionId: sessionResult.session.id,
    exerciseId: "monday-bench-press",
    setNumber: 1,
    weightKg: "80",
    reps: "8",
    clientSetId: "bench-1",
  });
  const weight = await api.send("POST", "/api/body-weight", {
    entryDate: "2026-10-05",
    weightKg: "82.4",
  });
  const media = await api.send("PATCH", "/api/exercises/monday-bench-press/media", {
    techniqueMediaType: "video",
    techniqueMediaUrl: "https://example.com/bench",
  });
  const progress = await api.get("/api/progress/zhim-shtangi-lezha");
  const boot = await api.get("/api/bootstrap?today=2026-10-05");

  assert.equal(setResult.set.weightKg, 80);
  assert.equal(duplicate.set.id, setResult.set.id);
  assert.equal(weight.bodyWeight.weightKg, 82.4);
  assert.equal(media.media.techniqueMediaUrl, "https://example.com/bench");
  assert.deepEqual(progress.history, [
    { date: "2026-10-05", bestWeightKg: 80, bestReps: 8, volume: 640, sets: 1 },
  ]);
  assert.equal(boot.latestBodyWeight.weightKg, 82.4);
  assert.equal(boot.workoutDays[0].exercises[0].techniqueMediaUrl, "https://example.com/bench");
});

test("local API rejects invalid set inputs", async () => {
  const api = createApi();
  const sessionResult = await api.send("POST", "/api/sessions", {
    workoutDayId: "monday",
    sessionDate: "2026-10-05",
  });

  await assert.rejects(
    () =>
      api.send("POST", "/api/sets", {
        workoutSessionId: sessionResult.session.id,
        exerciseId: "monday-bench-press",
        setNumber: 1,
        weightKg: "999",
        reps: "0",
      }),
    /Invalid set input/,
  );
});
