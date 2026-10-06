import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExerciseHistory,
  calculateReadinessScore,
  calculateSetVolume,
  calculateWorkoutVolume,
  selectBestSet,
} from "../src/lib/progress.mjs";

test("calculates set and workout volume from weight and reps", () => {
  assert.equal(calculateSetVolume({ weightKg: 80, reps: 8 }), 640);
  assert.equal(
    calculateWorkoutVolume([
      { weightKg: 80, reps: 8 },
      { weightKg: 90, reps: 5 },
      { weightKg: 0, reps: 12 },
    ]),
    1090,
  );
});

test("selects best set by highest weight then reps", () => {
  const best = selectBestSet([
    { weightKg: 70, reps: 12, completedAt: "2026-10-01T10:00:00.000Z" },
    { weightKg: 80, reps: 5, completedAt: "2026-10-01T10:05:00.000Z" },
    { weightKg: 80, reps: 8, completedAt: "2026-10-01T10:10:00.000Z" },
  ]);

  assert.equal(best.weightKg, 80);
  assert.equal(best.reps, 8);
});

test("builds exercise history for repeated exercise key across workout days", () => {
  const history = buildExerciseHistory(
    [
      {
        exerciseKey: "tyaga-verhnego-bloka",
        sessionDate: "2026-10-01",
        weightKg: 55,
        reps: 10,
      },
      {
        exerciseKey: "drugoe",
        sessionDate: "2026-10-01",
        weightKg: 100,
        reps: 3,
      },
      {
        exerciseKey: "tyaga-verhnego-bloka",
        sessionDate: "2026-10-03",
        weightKg: 60,
        reps: 8,
      },
    ],
    "tyaga-verhnego-bloka",
  );

  assert.deepEqual(history, [
    {
      date: "2026-10-01",
      bestWeightKg: 55,
      bestReps: 10,
      volume: 550,
      sets: 1,
    },
    {
      date: "2026-10-03",
      bestWeightKg: 60,
      bestReps: 8,
      volume: 480,
      sets: 1,
    },
  ]);
});

test("calculates starter readiness score from recent completion", () => {
  assert.equal(calculateReadinessScore({ hadWorkoutYesterday: false, lastPlannedWorkoutCompleted: true }), 85);
  assert.equal(calculateReadinessScore({ hadWorkoutYesterday: true, lastPlannedWorkoutCompleted: true }), 70);
  assert.equal(calculateReadinessScore({ hadWorkoutYesterday: false, lastPlannedWorkoutCompleted: false }), 60);
});
