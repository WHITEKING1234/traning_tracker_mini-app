import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExerciseHistory } from "./lib/progress.mjs";
import { getAuthenticatedUser } from "./lib/telegramAuth.mjs";
import { createDataStore } from "./lib/dataStore.mjs";
import { getWorkoutForWeekday } from "./lib/workoutProgram.mjs";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function todayInIso(url) {
  const explicit = url.searchParams.get("today");
  if (explicit) return explicit;
  return new Date().toISOString().slice(0, 10);
}

function weekdayFromIso(date) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function buildBootstrap(state, isoDate) {
  const weekday = weekdayFromIso(isoDate);
  const todayWorkout = getWorkoutForWeekday(weekday);
  return {
    ...state,
    today: isoDate,
    todayWorkout: state.workoutDays.find((day) => day.id === todayWorkout.id) ?? state.workoutDays[0],
  };
}

async function serveStatic(req, res, publicDir) {
  const rawPath = String(req.url ?? "").split("?")[0].toLocaleLowerCase();
  if (rawPath.includes("..") || rawPath.includes("%2e")) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  const reqUrl = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(reqUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(resolve(join(publicDir, relativePath)));
  const root = normalize(resolve(publicDir));

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
    res.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === "ENOENT") {
      json(res, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

function getRouteParam(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  return decodeURIComponent(pathname.slice(prefix.length));
}

export function createServer({
  dataFilePath = process.env.DATA_FILE ?? join(process.cwd(), "data", "app-data.json"),
  botToken = process.env.BOT_TOKEN ?? "",
  devMode = process.env.NODE_ENV !== "production",
  publicDir = join(process.cwd(), "public"),
} = {}) {
  const store = createDataStore({ filePath: dataFilePath });

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (!url.pathname.startsWith("/api/")) {
        await serveStatic(req, res, publicDir);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, { ok: true, app: "training-os" });
        return;
      }

      const authUser = getAuthenticatedUser({
        initData: req.headers["x-telegram-init-data"],
        botToken,
        devMode,
      });
      const user = await store.bootstrapUser(authUser);

      if (req.method === "GET" && url.pathname === "/api/bootstrap") {
        const state = await store.getState(user.id);
        json(res, 200, buildBootstrap(state, todayInIso(url)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/sessions") {
        const body = await readJsonBody(req);
        const session = await store.createSession(
          user.id,
          String(body.workoutDayId ?? ""),
          String(body.sessionDate ?? todayInIso(url)),
        );
        json(res, 200, { session, state: buildBootstrap(await store.getState(user.id), session.sessionDate) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/sets") {
        const body = await readJsonBody(req);
        const set = await store.addSet(user.id, body);
        const state = await store.getState(user.id);
        json(res, 200, {
          set,
          progress: buildExerciseHistory(state.sets, set.exerciseKey),
          state,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/body-weight") {
        const body = await readJsonBody(req);
        const entry = await store.addBodyWeight(user.id, body);
        json(res, 200, { bodyWeight: entry, state: await store.getState(user.id) });
        return;
      }

      if (req.method === "PATCH") {
        const exerciseId = getRouteParam(url.pathname, "/api/exercises/");
        if (exerciseId?.endsWith("/media")) {
          const id = exerciseId.slice(0, -"/media".length);
          const body = await readJsonBody(req);
          const media = await store.updateExerciseMedia(user.id, id, body);
          json(res, 200, { media, state: await store.getState(user.id) });
          return;
        }
      }

      if (req.method === "GET") {
        const exerciseKey = getRouteParam(url.pathname, "/api/progress/");
        if (exerciseKey) {
          const state = await store.getState(user.id);
          json(res, 200, { exerciseKey, history: buildExerciseHistory(state.sets, exerciseKey) });
          return;
        }
      }

      json(res, 404, { error: "Not found" });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      json(res, statusCode, {
        error: error.statusCode ? error.message : "Internal server error",
        reason: error.reason,
        errors: error.errors,
      });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Training app listening on http://${host}:${port}`);
  });
}
