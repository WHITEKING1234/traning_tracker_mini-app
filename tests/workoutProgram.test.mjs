import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKOUT_DAYS,
  getExerciseById,
  getWorkoutForWeekday,
  normalizeExerciseKey,
} from "../src/lib/workoutProgram.mjs";

test("seed program contains the approved Monday, Wednesday, and Friday workouts", () => {
  assert.deepEqual(WORKOUT_DAYS.map((day) => day.title), ["Понедельник", "Среда", "Пятница"]);
  assert.equal(getWorkoutForWeekday(1).exercises[0].name, "Жим штанги лёжа");
  assert.equal(getWorkoutForWeekday(3).exercises[0].name, "Приседания со штангой");
  assert.equal(getWorkoutForWeekday(5).exercises.at(-1).name, "Подъём на носки стоя");
});

test("same exercise name creates the same progress key across workout days", () => {
  assert.equal(normalizeExerciseKey("Тяга верхнего блока"), normalizeExerciseKey("тяга верхнего блока"));
  assert.equal(
    WORKOUT_DAYS[0].exercises.find((exercise) => exercise.name === "Тяга верхнего блока").exerciseKey,
    WORKOUT_DAYS[1].exercises.find((exercise) => exercise.name === "Тяга верхнего блока").exerciseKey,
  );
});

test("exercise seeds include categories and rest defaults used by the app", () => {
  const bench = getExerciseById("monday-bench-press");
  const curls = getExerciseById("monday-dumbbell-biceps-curl");
  const abs = getExerciseById("monday-abs");

  assert.equal(bench.category, "compound");
  assert.equal(bench.defaultRestSeconds, 120);
  assert.equal(curls.category, "accessory");
  assert.equal(curls.defaultRestSeconds, 90);
  assert.equal(abs.category, "small");
  assert.equal(abs.defaultRestSeconds, 60);
});
