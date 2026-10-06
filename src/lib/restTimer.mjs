export function createRestTimerState({ startedAtMs, durationSeconds, nowMs = Date.now() }) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const elapsedSeconds = Math.max(0, Math.floor((Number(nowMs) - Number(startedAtMs)) / 1000));
  const remainingSeconds = Math.max(0, duration - elapsedSeconds);

  return {
    remainingSeconds,
    done: remainingSeconds === 0,
  };
}
