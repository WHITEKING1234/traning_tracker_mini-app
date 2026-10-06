export function calculateSetVolume(set) {
  return Number(set.weightKg) * Number(set.reps);
}

export function calculateWorkoutVolume(sets) {
  return sets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
}

export function selectBestSet(sets) {
  if (!sets.length) return null;
  return [...sets].sort((left, right) => {
    if (right.weightKg !== left.weightKg) return right.weightKg - left.weightKg;
    if (right.reps !== left.reps) return right.reps - left.reps;
    return String(right.completedAt ?? "").localeCompare(String(left.completedAt ?? ""));
  })[0];
}

export function buildExerciseHistory(sets, exerciseKey) {
  const byDate = new Map();
  for (const set of sets) {
    if (set.exerciseKey !== exerciseKey) continue;
    const date = set.sessionDate ?? String(set.completedAt ?? "").slice(0, 10);
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(set);
    byDate.set(date, list);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dateSets]) => {
      const best = selectBestSet(dateSets);
      return {
        date,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        volume: calculateWorkoutVolume(dateSets),
        sets: dateSets.length,
      };
    });
}

export function calculateReadinessScore({ hadWorkoutYesterday, lastPlannedWorkoutCompleted }) {
  if (!lastPlannedWorkoutCompleted) return 60;
  if (hadWorkoutYesterday) return 70;
  return 85;
}

export function getLatestBodyWeight(bodyWeights) {
  return [...bodyWeights].sort((left, right) => {
    const dateCompare = String(right.entryDate).localeCompare(String(left.entryDate));
    if (dateCompare !== 0) return dateCompare;
    return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
  })[0] ?? null;
}
