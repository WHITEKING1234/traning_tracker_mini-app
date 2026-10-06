import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "../src/server.mjs";

async function startTestServer(options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "training-api-"));
  const server = createServer({
    dataFilePath: join(dir, "app-data.json"),
    publicDir: resolve("public"),
    devMode: true,
    ...options,
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async request(path, requestOptions = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        ...requestOptions,
        headers: {
          "content-type": "application/json",
          ...(requestOptions.headers ?? {}),
        },
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      return { response, body };
    },
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

function rawGet(baseUrl, path) {
  const url = new URL(baseUrl);
  return new Promise((resolveRequest, rejectRequest) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path,
        method: "GET",
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          resolveRequest({ response: { status: res.statusCode }, body: text ? JSON.parse(text) : null });
        });
      },
    );
    req.on("error", rejectRequest);
    req.end();
  });
}

test("GET /api/bootstrap returns user, workout days, settings, latest body weight, and today's workout", async () => {
  const app = await startTestServer();
  try {
    const { response, body } = await app.request("/api/bootstrap?today=2026-10-05");

    assert.equal(response.status, 200);
    assert.equal(body.user.telegramId, "dev-user");
    assert.equal(body.workoutDays.length, 3);
    assert.equal(body.todayWorkout.title, "Понедельник");
    assert.equal(body.latestBodyWeight, null);
    assert.equal(body.settings.restDefaults.compound, 120);
  } finally {
    await app.close();
  }
});

test("GET /api/health returns deployment status without auth", async () => {
  const app = await startTestServer({ devMode: false, botToken: "" });
  try {
    const { response, body } = await app.request("/api/health");

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, app: "training-os" });
  } finally {
    await app.close();
  }
});

test("sessions, set logging, and progress endpoints work together", async () => {
  const app = await startTestServer();
  try {
    const sessionResult = await app.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ workoutDayId: "monday", sessionDate: "2026-10-05" }),
    });
    assert.equal(sessionResult.response.status, 200);

    const setInput = {
      workoutSessionId: sessionResult.body.session.id,
      exerciseId: "monday-lat-pulldown",
      setNumber: 1,
      weightKg: 55,
      reps: 10,
      clientSetId: "tap-1",
    };
    const first = await app.request("/api/sets", { method: "POST", body: JSON.stringify(setInput) });
    const second = await app.request("/api/sets", { method: "POST", body: JSON.stringify(setInput) });
    const progress = await app.request("/api/progress/tyaga-verhnego-bloka");

    assert.equal(first.response.status, 200);
    assert.equal(second.body.set.id, first.body.set.id);
    assert.equal(progress.response.status, 200);
    assert.deepEqual(progress.body.history, [
      { date: "2026-10-05", bestWeightKg: 55, bestReps: 10, volume: 550, sets: 1 },
    ]);
  } finally {
    await app.close();
  }
});

test("POST /api/sets rejects invalid weight and reps with HTTP 400", async () => {
  const app = await startTestServer();
  try {
    const sessionResult = await app.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ workoutDayId: "monday", sessionDate: "2026-10-05" }),
    });
    const result = await app.request("/api/sets", {
      method: "POST",
      body: JSON.stringify({
        workoutSessionId: sessionResult.body.session.id,
        exerciseId: "monday-bench-press",
        setNumber: 1,
        weightKg: 999,
        reps: 0,
        clientSetId: "bad",
      }),
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, "Invalid set input");
  } finally {
    await app.close();
  }
});

test("body weight and technique media persist through bootstrap", async () => {
  const app = await startTestServer();
  try {
    const bodyWeight = await app.request("/api/body-weight", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-10-05", weightKg: 82.4 }),
    });
    const invalidBodyWeight = await app.request("/api/body-weight", {
      method: "POST",
      body: JSON.stringify({ entryDate: "2026-10-05", weightKg: 999 }),
    });
    const media = await app.request("/api/exercises/monday-bench-press/media", {
      method: "PATCH",
      body: JSON.stringify({
        techniqueMediaType: "image",
        techniqueMediaUrl: "https://example.com/bench.jpg",
      }),
    });
    const bootstrap = await app.request("/api/bootstrap?today=2026-10-05");

    assert.equal(bodyWeight.response.status, 200);
    assert.equal(bodyWeight.body.bodyWeight.weightKg, 82.4);
    assert.equal(invalidBodyWeight.response.status, 400);
    assert.equal(media.response.status, 200);
    assert.equal(media.body.media.techniqueMediaType, "image");
    assert.equal(bootstrap.body.latestBodyWeight.weightKg, 82.4);
    assert.equal(bootstrap.body.workoutDays[0].exercises[0].techniqueMediaUrl, "https://example.com/bench.jpg");
  } finally {
    await app.close();
  }
});

test("requests fail with 401 when dev auth is disabled and no valid Telegram data is provided", async () => {
  const app = await startTestServer({ devMode: false, botToken: "" });
  try {
    const { response, body } = await app.request("/api/bootstrap");

    assert.equal(response.status, 401);
    assert.equal(body.error, "Unauthorized");
  } finally {
    await app.close();
  }
});

test("static server rejects path traversal into public sibling directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "training-static-"));
  const publicDir = join(dir, "public");
  const siblingDir = join(dir, "publicity");
  await mkdir(publicDir);
  await mkdir(siblingDir);
  await writeFile(join(publicDir, "index.html"), "ok");
  await writeFile(join(siblingDir, "secret.txt"), "secret");
  const app = await startTestServer({ publicDir });
  try {
    const { response, body } = await rawGet(app.baseUrl, "/%2e%2e/publicity/secret.txt");

    assert.equal(response.status, 403);
    assert.equal(body.error, "Forbidden");
  } finally {
    await app.close();
  }
});
