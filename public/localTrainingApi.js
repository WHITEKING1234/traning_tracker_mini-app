import {
  WORKOUT_DAYS,
  getAllExercises,
  getExerciseById,
  getWorkoutById,
  getWorkoutForWeekday,
} from "./workoutProgram.js";

export const LOCAL_STORAGE_KEY = "training-os:local-data:v1";

const EMPTY_DATA = {
  user: null,
  sessions: [],
  sets: [],
  bodyWeights: [],
  exerciseMedia: [],
  settings: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(now) {
  return now().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureShape(data) {
  return {
    user: data?.user ?? null,
    sessions: ensureArray(data?.sessions),
    sets: ensureArray(data?.sets),
    bodyWeights: ensureArray(data?.bodyWeights),
    exerciseMedia: ensureArray(data?.exerciseMedia),
    settings: data?.settings ?? null,
  };
}

function parseFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanNotes(value) {
  return String(value ?? "").trim().slice(0, 500);
}

function validateSetInput(input = {}) {
  const errors = [];
  const weightKg = parseFiniteNumber(input.weightKg);
  const reps = parseFiniteNumber(input.reps);

  if (weightKg === null || weightKg < 0 || weightKg > 500) {
    errors.push("weightKg must be between 0 and 500");
  }
  if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 100) {
    errors.push("reps must be an integer between 1 and 100");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { weightKg, reps, notes: cleanNotes(input.notes) } };
}

function validateBodyWeightInput(input = {}) {
  const errors = [];
  const weightKg = parseFiniteNumber(input.weightKg);
  const entryDate = String(input.entryDate ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    errors.push("entryDate must be YYYY-MM-DD");
  }
  if (weightKg === null || weightKg < 20 || weightKg > 300) {
    errors.push("weightKg must be between 20 and 300");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { entryDate, weightKg } };
}

function validateExerciseMediaInput(input = {}) {
  const techniqueMediaType = String(input.techniqueMediaType ?? input.mediaType ?? "link").trim();
  const techniqueMediaUrl = String(input.techniqueMediaUrl ?? input.mediaUrl ?? "").trim();
  const allowed = new Set(["", "image", "video", "link"]);
  const errors = [];

  if (!allowed.has(techniqueMediaType)) {
    errors.push("techniqueMediaType must be image, video, link, or empty");
  }
  if (techniqueMediaUrl && !/^https?:\/\//i.test(techniqueMediaUrl)) {
    errors.push("techniqueMediaUrl must start with http:// or https://");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { techniqueMediaType, techniqueMediaUrl } };
}

function localError(message, status = 400, errors) {
  const error = new Error(message);
  error.status = status;
  error.body = { error: message, errors };
  return error;
}

function weekdayFromIso(date) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function getLatestBodyWeight(bodyWeights) {
  return [...bodyWeights].sort((left, right) => right.entryDate.localeCompare(left.entryDate))[0] ?? null;
}

function buildExerciseHistory(sets, exerciseKey) {
  const byDate = new Map();
  for (const set of sets) {
    if (set.exerciseKey !== exerciseKey) continue;
    const list = byDate.get(set.sessionDate) ?? [];
    list.push(set);
    byDate.set(set.sessionDate, list);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, daySets]) => {
      const best = [...daySets].sort((left, right) => right.weightKg - left.weightKg || right.reps - left.reps)[0];
      return {
        date,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        volume: daySets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
        sets: daySets.length,
      };
    });
}

function normalizeUser(rawUser, now) {
  const telegramId = String(rawUser?.id ?? "local-user");
  const timestamp = nowIso(now);
  return {
    id: `local-${telegramId}`,
    telegramId,
    username: rawUser?.username ?? "",
    firstName: rawUser?.first_name ?? rawUser?.firstName ?? "Local",
    photoUrl: rawUser?.photo_url ?? rawUser?.photoUrl ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function routeUrl(path) {
  return new URL(path, "https://local.training");
}

export function createLocalTrainingApi({
  storage = globalThis.localStorage,
  now = () => new Date(),
  getUser = () => null,
} = {}) {
  function readData() {
    try {
      return ensureShape(JSON.parse(storage.getItem(LOCAL_STORAGE_KEY) || "null"));
    } catch {
      return clone(EMPTY_DATA);
    }
  }

  function writeData(data) {
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ensureShape(data)));
  }

  function ensureUser(data) {
    const nextUser = normalizeUser(getUser(), now);
    if (!data.user || data.user.telegramId !== nextUser.telegramId) {
      data.user = nextUser;
    } else {
      data.user = { ...data.user, ...nextUser, createdAt: data.user.createdAt ?? nextUser.createdAt };
    }
    data.settings = data.settings ?? {
      id: "settings-local",
      userId: data.user.id,
      restDefaults: { compound: 120, accessory: 90, small: 60 },
    };
    return data.user;
  }

  function withMedia(data) {
    const mediaByExerciseId = new Map(data.exerciseMedia.map((item) => [item.exerciseId, item]));
    return (exercise) => {
      const media = mediaByExerciseId.get(exercise.id);
      return {
        ...exercise,
        techniqueMediaType: media?.techniqueMediaType ?? "",
        techniqueMediaUrl: media?.techniqueMediaUrl ?? "",
      };
    };
  }

  function getState(data) {
    const applyMedia = withMedia(data);
    return {
      user: clone(data.user),
      workoutDays: WORKOUT_DAYS.map((day) => ({ ...day, exercises: day.exercises.map(applyMedia) })),
      exercises: getAllExercises().map(applyMedia),
      sessions: clone(data.sessions),
      sets: clone(data.sets),
      bodyWeights: clone(data.bodyWeights),
      latestBodyWeight: clone(getLatestBodyWeight(data.bodyWeights)),
      settings: clone(data.settings),
    };
  }

  function buildBootstrap(data, isoDate) {
    const state = getState(data);
    const todayWorkout = getWorkoutForWeekday(weekdayFromIso(isoDate));
    return {
      ...state,
      today: isoDate,
      todayWorkout: state.workoutDays.find((day) => day.id === todayWorkout.id) ?? state.workoutDays[0],
    };
  }

  function mutate(mutator) {
    const data = readData();
    ensureUser(data);
    const result = mutator(data);
    writeData(data);
    return result;
  }

  return {
    async get(path) {
      return mutate((data) => {
        const url = routeUrl(path);
        const today = url.searchParams.get("today") ?? now().toISOString().slice(0, 10);

        if (url.pathname === "/api/bootstrap") {
          return buildBootstrap(data, today);
        }

        if (url.pathname.startsWith("/api/progress/")) {
          const exerciseKey = decodeURIComponent(url.pathname.slice("/api/progress/".length));
          return { exerciseKey, history: buildExerciseHistory(data.sets, exerciseKey) };
        }

        throw localError("Not found", 404);
      });
    },

    async send(method, path, body = {}) {
      return mutate((data) => {
        const url = routeUrl(path);
        const upperMethod = String(method).toUpperCase();

        if (upperMethod === "POST" && url.pathname === "/api/sessions") {
          const workoutDayId = String(body.workoutDayId ?? "");
          const sessionDate = String(body.sessionDate ?? now().toISOString().slice(0, 10));
          if (!getWorkoutById(workoutDayId)) throw localError("Unknown workout day");

          const existing = data.sessions.find(
            (session) =>
              session.workoutDayId === workoutDayId &&
              session.sessionDate === sessionDate &&
              !session.completedAt,
          );
          if (existing) return { session: clone(existing), state: buildBootstrap(data, sessionDate) };

          const session = {
            id: makeId("session"),
            userId: data.user.id,
            workoutDayId,
            sessionDate,
            startedAt: nowIso(now),
            completedAt: null,
            notes: "",
          };
          data.sessions.push(session);
          return { session: clone(session), state: buildBootstrap(data, sessionDate) };
        }

        if (upperMethod === "POST" && url.pathname === "/api/sets") {
          const validated = validateSetInput(body);
          if (!validated.ok) throw localError("Invalid set input", 400, validated.errors);

          if (body.clientSetId) {
            const existing = data.sets.find((set) => set.clientSetId === body.clientSetId);
            if (existing) {
              return {
                set: clone(existing),
                progress: buildExerciseHistory(data.sets, existing.exerciseKey),
                state: getState(data),
              };
            }
          }

          const session = data.sessions.find((item) => item.id === body.workoutSessionId);
          if (!session) throw localError("Unknown workout session");

          const exercise = getExerciseById(body.exerciseId);
          if (!exercise) throw localError("Unknown exercise");

          const set = {
            id: makeId("set"),
            userId: data.user.id,
            workoutSessionId: session.id,
            workoutDayId: session.workoutDayId,
            exerciseId: exercise.id,
            exerciseKey: exercise.exerciseKey,
            sessionDate: session.sessionDate,
            setNumber: Number(body.setNumber) || 1,
            weightKg: validated.value.weightKg,
            reps: validated.value.reps,
            notes: validated.value.notes,
            clientSetId: String(body.clientSetId ?? makeId("client-set")),
            completedAt: nowIso(now),
          };
          data.sets.push(set);
          return {
            set: clone(set),
            progress: buildExerciseHistory(data.sets, set.exerciseKey),
            state: getState(data),
          };
        }

        if (upperMethod === "POST" && url.pathname === "/api/body-weight") {
          const validated = validateBodyWeightInput(body);
          if (!validated.ok) throw localError("Invalid body weight input", 400, validated.errors);

          const existing = data.bodyWeights.find((entry) => entry.entryDate === validated.value.entryDate);
          if (existing) {
            existing.weightKg = validated.value.weightKg;
            existing.updatedAt = nowIso(now);
            return { bodyWeight: clone(existing), state: getState(data) };
          }

          const entry = {
            id: makeId("body"),
            userId: data.user.id,
            entryDate: validated.value.entryDate,
            weightKg: validated.value.weightKg,
            createdAt: nowIso(now),
          };
          data.bodyWeights.push(entry);
          return { bodyWeight: clone(entry), state: getState(data) };
        }

        if (upperMethod === "PATCH" && url.pathname.startsWith("/api/exercises/") && url.pathname.endsWith("/media")) {
          const exerciseId = decodeURIComponent(
            url.pathname.slice("/api/exercises/".length, -"/media".length),
          );
          if (!getExerciseById(exerciseId)) throw localError("Unknown exercise");

          const validated = validateExerciseMediaInput(body);
          if (!validated.ok) throw localError("Invalid exercise media", 400, validated.errors);

          const existing = data.exerciseMedia.find((item) => item.exerciseId === exerciseId);
          if (existing) {
            existing.techniqueMediaType = validated.value.techniqueMediaType;
            existing.techniqueMediaUrl = validated.value.techniqueMediaUrl;
            existing.updatedAt = nowIso(now);
            return { media: clone(existing), state: getState(data) };
          }

          const media = {
            id: makeId("media"),
            userId: data.user.id,
            exerciseId,
            techniqueMediaType: validated.value.techniqueMediaType,
            techniqueMediaUrl: validated.value.techniqueMediaUrl,
            createdAt: nowIso(now),
            updatedAt: nowIso(now),
          };
          data.exerciseMedia.push(media);
          return { media: clone(media), state: getState(data) };
        }

        throw localError("Not found", 404);
      });
    },
  };
}
