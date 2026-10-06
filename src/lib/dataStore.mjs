import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getLatestBodyWeight } from "./progress.mjs";
import { getAllExercises, getExerciseById, getWorkoutById, WORKOUT_DAYS } from "./workoutProgram.mjs";
import { validateBodyWeightInput, validateExerciseMediaInput, validateSetInput } from "./validation.mjs";

const EMPTY_DATA = {
  users: [],
  sessions: [],
  sets: [],
  bodyWeights: [],
  exerciseMedia: [],
  settings: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureShape(data) {
  return {
    users: Array.isArray(data.users) ? data.users : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    sets: Array.isArray(data.sets) ? data.sets : [],
    bodyWeights: Array.isArray(data.bodyWeights) ? data.bodyWeights : [],
    exerciseMedia: Array.isArray(data.exerciseMedia) ? data.exerciseMedia : [],
    settings: Array.isArray(data.settings) ? data.settings : [],
  };
}

function withMediaForUser(mediaByExerciseId) {
  return (exercise) => {
    const media = mediaByExerciseId.get(exercise.id);
    return {
      ...exercise,
      techniqueMediaType: media?.techniqueMediaType ?? "",
      techniqueMediaUrl: media?.techniqueMediaUrl ?? "",
    };
  };
}

export function createDataStore({ filePath }) {
  async function readData() {
    try {
      return ensureShape(JSON.parse(await readFile(filePath, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return clone(EMPTY_DATA);
      throw error;
    }
  }

  async function writeData(data) {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(ensureShape(data), null, 2)}\n`);
    await rename(tempPath, filePath);
  }

  async function mutate(mutator) {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result;
  }

  function applyMedia(data, userId, workoutDay) {
    const mediaByExerciseId = new Map(
      data.exerciseMedia
        .filter((item) => item.userId === userId)
        .map((item) => [item.exerciseId, item]),
    );
    return {
      ...workoutDay,
      exercises: workoutDay.exercises.map(withMediaForUser(mediaByExerciseId)),
    };
  }

  return {
    filePath,

    async bootstrapUser(authUser) {
      return mutate((data) => {
        const existing = data.users.find((user) => user.telegramId === authUser.telegramId);
        const timestamp = nowIso();
        if (existing) {
          existing.username = authUser.username ?? existing.username ?? "";
          existing.firstName = authUser.firstName ?? existing.firstName ?? "";
          existing.photoUrl = authUser.photoUrl ?? existing.photoUrl ?? "";
          existing.updatedAt = timestamp;
          return clone(existing);
        }

        const user = {
          id: authUser.id || `tg-${authUser.telegramId}`,
          telegramId: String(authUser.telegramId),
          username: authUser.username ?? "",
          firstName: authUser.firstName ?? "",
          photoUrl: authUser.photoUrl ?? "",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        data.users.push(user);
        data.settings.push({
          id: makeId("settings"),
          userId: user.id,
          restDefaults: { compound: 120, accessory: 90, small: 60 },
        });
        return clone(user);
      });
    },

    async getState(userId) {
      const data = await readData();
      const sets = data.sets.filter((set) => set.userId === userId);
      const sessions = data.sessions.filter((session) => session.userId === userId);
      const bodyWeights = data.bodyWeights.filter((entry) => entry.userId === userId);
      const settings =
        data.settings.find((item) => item.userId === userId) ??
        { restDefaults: { compound: 120, accessory: 90, small: 60 } };

      return {
        user: data.users.find((user) => user.id === userId) ?? null,
        workoutDays: WORKOUT_DAYS.map((day) => applyMedia(data, userId, day)),
        exercises: getAllExercises().map((exercise) => applyMedia(data, userId, { exercises: [exercise] }).exercises[0]),
        sessions: clone(sessions),
        sets: clone(sets),
        bodyWeights: clone(bodyWeights),
        latestBodyWeight: getLatestBodyWeight(bodyWeights),
        settings: clone(settings),
      };
    },

    async createSession(userId, workoutDayId, sessionDate) {
      return mutate((data) => {
        if (!getWorkoutById(workoutDayId)) {
          const error = new Error("Unknown workout day");
          error.statusCode = 400;
          throw error;
        }
        const existing = data.sessions.find(
          (session) =>
            session.userId === userId &&
            session.workoutDayId === workoutDayId &&
            session.sessionDate === sessionDate &&
            !session.completedAt,
        );
        if (existing) return clone(existing);

        const session = {
          id: makeId("session"),
          userId,
          workoutDayId,
          sessionDate,
          startedAt: nowIso(),
          completedAt: null,
          notes: "",
        };
        data.sessions.push(session);
        return clone(session);
      });
    },

    async addSet(userId, input) {
      const validated = validateSetInput(input);
      if (!validated.ok) {
        const error = new Error("Invalid set input");
        error.statusCode = 400;
        error.errors = validated.errors;
        throw error;
      }

      return mutate((data) => {
        if (input.clientSetId) {
          const existing = data.sets.find((set) => set.userId === userId && set.clientSetId === input.clientSetId);
          if (existing) return clone(existing);
        }

        const session = data.sessions.find(
          (item) => item.id === input.workoutSessionId && item.userId === userId,
        );
        if (!session) {
          const error = new Error("Unknown workout session");
          error.statusCode = 400;
          throw error;
        }

        const exercise = getExerciseById(input.exerciseId);
        if (!exercise) {
          const error = new Error("Unknown exercise");
          error.statusCode = 400;
          throw error;
        }

        const set = {
          id: makeId("set"),
          userId,
          workoutSessionId: session.id,
          workoutDayId: session.workoutDayId,
          exerciseId: exercise.id,
          exerciseKey: exercise.exerciseKey,
          sessionDate: session.sessionDate,
          setNumber: Number(input.setNumber) || 1,
          weightKg: validated.value.weightKg,
          reps: validated.value.reps,
          notes: validated.value.notes,
          clientSetId: String(input.clientSetId ?? makeId("client-set")),
          completedAt: nowIso(),
        };
        data.sets.push(set);
        return clone(set);
      });
    },

    async addBodyWeight(userId, input) {
      const validated = validateBodyWeightInput(input);
      if (!validated.ok) {
        const error = new Error("Invalid body weight input");
        error.statusCode = 400;
        error.errors = validated.errors;
        throw error;
      }

      return mutate((data) => {
        const existing = data.bodyWeights.find(
          (entry) => entry.userId === userId && entry.entryDate === validated.value.entryDate,
        );
        if (existing) {
          existing.weightKg = validated.value.weightKg;
          existing.createdAt = existing.createdAt ?? nowIso();
          existing.updatedAt = nowIso();
          return clone(existing);
        }

        const entry = {
          id: makeId("body"),
          userId,
          entryDate: validated.value.entryDate,
          weightKg: validated.value.weightKg,
          createdAt: nowIso(),
        };
        data.bodyWeights.push(entry);
        return clone(entry);
      });
    },

    async updateExerciseMedia(userId, exerciseId, media) {
      const exercise = getExerciseById(exerciseId);
      if (!exercise) {
        const error = new Error("Unknown exercise");
        error.statusCode = 400;
        throw error;
      }

      const validated = validateExerciseMediaInput(media);
      if (!validated.ok) {
        const error = new Error("Invalid exercise media");
        error.statusCode = 400;
        error.errors = validated.errors;
        throw error;
      }

      return mutate((data) => {
        const existing = data.exerciseMedia.find((item) => item.userId === userId && item.exerciseId === exerciseId);
        if (existing) {
          existing.techniqueMediaType = validated.value.techniqueMediaType;
          existing.techniqueMediaUrl = validated.value.techniqueMediaUrl;
          existing.updatedAt = nowIso();
          return clone(existing);
        }

        const item = {
          id: makeId("media"),
          userId,
          exerciseId,
          techniqueMediaType: validated.value.techniqueMediaType,
          techniqueMediaUrl: validated.value.techniqueMediaUrl,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        data.exerciseMedia.push(item);
        return clone(item);
      });
    },
  };
}
