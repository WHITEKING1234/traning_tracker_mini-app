# Telegram Training App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Telegram Mini App MVP for personal workout logging, rest timers, exercise progress, technique media, and body weight tracking.

**Architecture:** Use a no-build mobile web app served by a small Node.js server so the MVP works without external package installation. The backend validates Telegram Mini App launch data when a bot token is configured, provides a local dev fallback, serves API endpoints, and persists data in a JSON file that can later be replaced by SQLite/Postgres without changing the UI contract.

**Tech Stack:** Node.js ESM, native `node:test`, native `http`, static HTML/CSS/ES modules, Telegram Mini App JavaScript bridge, SVG/CSS charts.

**Spec:** `docs/superpowers/specs/2026-10-05-telegram-training-app-design.md`

## Global Constraints

- The app opens inside Telegram as a Mini App and is optimized for iPhone.
- Use Node.js 18 or newer.
- The first screen is the actual training tool, not a landing page.
- UI copy and exercise names are Russian.
- Program days are Monday, Wednesday, and Friday.
- Each set records weight in kilograms, reps, timestamp, and optional notes.
- Completing a set starts an automatic rest timer.
- Progress includes best set, volume, recent history, and simple charts.
- Body weight entries persist with date and kilograms.
- Exercise technique media supports a video URL, photo URL, or link.
- Telegram init data is validated server-side when `BOT_TOKEN` is set.
- Bot token never appears in frontend code.
- All user data is scoped by authenticated Telegram user, with a single dev user only in local fallback mode.

## Review Focus

- Invalid or tampered Telegram launch data rejects API access when `BOT_TOKEN` is configured; covered in Task 2 auth tests.
- Empty, negative, non-numeric, or extreme set/body-weight inputs return validation errors; covered in Task 3 API tests.
- Duplicate set submissions from double taps do not create duplicate history rows; covered in Task 3 store/API tests.
- Repeated exercises across different workout days share progress by stable exercise key; covered in Task 1 progress tests.
- Rest timer continues correctly when navigating inside the app and does not show negative remaining time; covered in Task 4 timer state tests.

---

## File Structure

- Create `package.json` for scripts: `dev`, `test`, and `start`.
- Create `src/server.mjs` for static file serving, API routing, request parsing, auth middleware, and JSON responses.
- Create `src/lib/workoutProgram.mjs` for the seeded Russian workout program, exercise categories, rest defaults, and stable exercise keys.
- Create `src/lib/progress.mjs` for volume, best set, trend, readiness, and body weight calculations.
- Create `src/lib/telegramAuth.mjs` for Telegram init data parsing and validation.
- Create `src/lib/dataStore.mjs` for JSON persistence, user bootstrap, sessions, sets, body weight, media, and settings.
- Create `src/lib/validation.mjs` for shared numeric/input validation.
- Create `src/lib/restTimer.mjs` for rest timer timestamp calculations used by tests and browser code.
- Create `public/index.html` for the mobile app shell.
- Create `public/styles.css` for the WHOOP-like dark mobile interface.
- Create `public/app.js` for app state, rendering, form handling, navigation, and timer UI.
- Create `public/api.js` for browser API calls.
- Create `public/telegram.js` for Telegram Mini App bridge setup and local fallback.
- Create `data/.gitkeep`; runtime creates `data/app-data.json`.
- Create `tests/workoutProgram.test.mjs`.
- Create `tests/progress.test.mjs`.
- Create `tests/telegramAuth.test.mjs`.
- Create `tests/dataStore.test.mjs`.
- Create `tests/api.test.mjs`.
- Create `tests/restTimer.test.mjs`.
- Create `README.md` with local run, Telegram bot setup, and deployment notes.

---

## Task 1: Workout Program And Progress Core

**Files:**
- Create: `package.json`
- Create: `src/lib/workoutProgram.mjs`
- Create: `src/lib/progress.mjs`
- Create: `tests/workoutProgram.test.mjs`
- Create: `tests/progress.test.mjs`

**Interfaces:**
- Produces: `WORKOUT_DAYS: Array<{ id: string, weekday: number, title: string, exercises: ExerciseSeed[] }>`
- Produces: `getWorkoutForWeekday(weekday: number) -> WorkoutDaySeed`
- Produces: `getExerciseById(exerciseId: string) -> ExerciseSeed | undefined`
- Produces: `normalizeExerciseKey(name: string) -> string`
- Produces: `calculateSetVolume(set: { weightKg: number, reps: number }) -> number`
- Produces: `calculateWorkoutVolume(sets: ExerciseSetLike[]) -> number`
- Produces: `selectBestSet(sets: ExerciseSetLike[]) -> ExerciseSetLike | null`
- Produces: `buildExerciseHistory(sets: ExerciseSetLike[], exerciseKey: string) -> ExerciseHistoryPoint[]`
- Produces: `calculateReadinessScore(input: { hadWorkoutYesterday: boolean, lastPlannedWorkoutCompleted: boolean }) -> number`

- [ ] **Step 1: Write workout program tests**

Create `tests/workoutProgram.test.mjs` with assertions that:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { WORKOUT_DAYS, getWorkoutForWeekday, normalizeExerciseKey } from "../src/lib/workoutProgram.mjs";

test("seed program contains the approved Monday, Wednesday, and Friday workouts", () => {
  assert.deepEqual(WORKOUT_DAYS.map((day) => day.title), ["Понедельник", "Среда", "Пятница"]);
  assert.equal(getWorkoutForWeekday(1).exercises[0].name, "Жим штанги лёжа");
  assert.equal(getWorkoutForWeekday(3).exercises[0].name, "Приседания со штангой");
  assert.equal(getWorkoutForWeekday(5).exercises.at(-1).name, "Подъём на носки стоя");
});

test("same exercise name creates the same progress key across workout days", () => {
  assert.equal(normalizeExerciseKey("Тяга верхнего блока"), normalizeExerciseKey("тяга верхнего блока"));
});
```

- [ ] **Step 2: Run workout program tests to verify they fail**

Run: `node --test tests/workoutProgram.test.mjs`

Expected: FAIL because `src/lib/workoutProgram.mjs` does not exist.

- [ ] **Step 3: Implement `src/lib/workoutProgram.mjs`**

Define the exact approved Russian workout plan. Use stable IDs such as `monday-bench-press`, stable shared `exerciseKey` values from `normalizeExerciseKey(name)`, categories `compound`, `accessory`, and `small`, and default rest seconds: compound `120`, accessory `90`, small `60`.

- [ ] **Step 4: Create initial `package.json`**

Create `package.json` with:

```json
{
  "name": "telegram-training-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 5: Run workout program tests to verify they pass**

Run: `node --test tests/workoutProgram.test.mjs`

Expected: PASS.

- [ ] **Step 6: Write progress tests**

Create `tests/progress.test.mjs` with assertions for set volume, total workout volume, highest weight then reps best-set ranking, shared exercise-key history across days, and readiness scores `85`, `70`, and `60`.

- [ ] **Step 7: Run progress tests to verify they fail**

Run: `node --test tests/progress.test.mjs`

Expected: FAIL because `src/lib/progress.mjs` does not exist.

- [ ] **Step 8: Implement `src/lib/progress.mjs`**

Implement the exported functions listed in the Interfaces block. `buildExerciseHistory` groups by `exerciseKey`, date, best set, and volume.

- [ ] **Step 9: Run Task 1 tests**

Run: `node --test tests/workoutProgram.test.mjs tests/progress.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit if git is available**

Run:

```bash
git add package.json src/lib/workoutProgram.mjs src/lib/progress.mjs tests/workoutProgram.test.mjs tests/progress.test.mjs
git commit -m "feat: add workout program and progress core"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.

---

## Task 2: Telegram Auth, Validation, And Data Store

**Files:**
- Create: `src/lib/telegramAuth.mjs`
- Create: `src/lib/validation.mjs`
- Create: `src/lib/dataStore.mjs`
- Create: `data/.gitkeep`
- Create: `tests/telegramAuth.test.mjs`
- Create: `tests/dataStore.test.mjs`

**Interfaces:**
- Consumes: `WORKOUT_DAYS`, `normalizeExerciseKey(name)`
- Produces: `parseTelegramInitData(initData: string) -> { user?: object, auth_date?: string, hash?: string, [key: string]: string | object }`
- Produces: `validateTelegramInitData(initData: string, botToken: string, nowSeconds?: number) -> { ok: true, user: TelegramUser } | { ok: false, reason: string }`
- Produces: `getAuthenticatedUser(input: { initData?: string, botToken?: string, devMode?: boolean }) -> AuthUser`
- Produces: `validateSetInput(input) -> { ok: true, value: { weightKg: number, reps: number, notes: string } } | { ok: false, errors: string[] }`
- Produces: `validateBodyWeightInput(input) -> { ok: true, value: { entryDate: string, weightKg: number } } | { ok: false, errors: string[] }`
- Produces: `createDataStore({ filePath: string }) -> DataStore`
- Produces DataStore methods: `bootstrapUser(authUser)`, `getState(userId)`, `createSession(userId, workoutDayId, sessionDate)`, `addSet(userId, input)`, `addBodyWeight(userId, input)`, `updateExerciseMedia(userId, exerciseId, media)`

- [ ] **Step 1: Write Telegram auth tests**

Create `tests/telegramAuth.test.mjs` with tests that:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseTelegramInitData, validateTelegramInitData, getAuthenticatedUser } from "../src/lib/telegramAuth.mjs";

test("parseTelegramInitData decodes user JSON", () => {
  const parsed = parseTelegramInitData("user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Hoji%22%7D&auth_date=1&hash=x");
  assert.equal(parsed.user.id, 123);
});

test("validateTelegramInitData rejects tampered data", () => {
  const result = validateTelegramInitData("user=%7B%22id%22%3A123%7D&auth_date=1&hash=bad", "test-token", 1);
  assert.equal(result.ok, false);
});

test("getAuthenticatedUser allows a fixed dev user only in dev mode without bot token", () => {
  assert.equal(getAuthenticatedUser({ devMode: true }).telegramId, "dev-user");
});
```

- [ ] **Step 2: Run Telegram auth tests to verify they fail**

Run: `node --test tests/telegramAuth.test.mjs`

Expected: FAIL because `src/lib/telegramAuth.mjs` does not exist.

- [ ] **Step 3: Implement `src/lib/telegramAuth.mjs`**

Use Node `crypto` HMAC SHA-256. Parse URLSearchParams, JSON-decode `user`, reject missing hash, reject expired auth dates older than 24 hours when `nowSeconds` is provided, and return a dev user only when `devMode` is true and no bot token is present.

- [ ] **Step 4: Write validation and data store tests**

Create `tests/dataStore.test.mjs` with tests that:

- bootstrap creates a user-scoped seeded program
- `addSet` persists `weightKg`, `reps`, `completedAt`, `exerciseKey`, and `clientSetId`
- calling `addSet` twice with the same `clientSetId` returns the existing set
- another user cannot see the first user's sets
- invalid set and body-weight inputs return validation errors
- exercise media can be updated for one user without affecting another user

- [ ] **Step 5: Run data store tests to verify they fail**

Run: `node --test tests/dataStore.test.mjs`

Expected: FAIL because `src/lib/dataStore.mjs` and `src/lib/validation.mjs` do not exist.

- [ ] **Step 6: Implement `src/lib/validation.mjs`**

Implement numeric validation. Accept `weightKg` from `0` to `500`, `reps` from `1` to `100`, and body weight from `20` to `300`. Return structured errors instead of throwing.

- [ ] **Step 7: Implement `src/lib/dataStore.mjs`**

Persist JSON shaped as `{ users: [], sessions: [], sets: [], bodyWeights: [], exerciseMedia: [], settings: [] }`. Write atomically via temp file then rename. All read/write methods must scope by `userId`.

- [ ] **Step 8: Run Task 2 tests**

Run: `node --test tests/telegramAuth.test.mjs tests/dataStore.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit if git is available**

Run:

```bash
git add src/lib/telegramAuth.mjs src/lib/validation.mjs src/lib/dataStore.mjs data/.gitkeep tests/telegramAuth.test.mjs tests/dataStore.test.mjs
git commit -m "feat: add telegram auth and persistence"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.

---

## Task 3: HTTP Server And API

**Files:**
- Create: `src/server.mjs`
- Create: `tests/api.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getAuthenticatedUser(input)`
- Consumes: `createDataStore({ filePath })`
- API produces:
  - `GET /api/bootstrap`
  - `POST /api/sessions`
  - `POST /api/sets`
  - `POST /api/body-weight`
  - `PATCH /api/exercises/:exerciseId/media`
  - `GET /api/progress/:exerciseKey`

- [ ] **Step 1: Write API tests**

Create `tests/api.test.mjs` that starts the server on an ephemeral port with a temporary data file and dev auth enabled. Assert:

- `GET /api/bootstrap` returns user, workout days, settings, latest body weight, and today's workout.
- `POST /api/sessions` creates a session for a valid workout day.
- `POST /api/sets` rejects invalid weight/reps with HTTP `400`.
- `POST /api/sets` is idempotent for the same `clientSetId`.
- `GET /api/progress/:exerciseKey` returns history for repeated exercise keys.
- Requests fail with HTTP `401` when dev auth is disabled and no valid Telegram init data is provided.

- [ ] **Step 2: Run API tests to verify they fail**

Run: `node --test tests/api.test.mjs`

Expected: FAIL because `src/server.mjs` does not exist.

- [ ] **Step 3: Implement `createServer(options)` in `src/server.mjs`**

Export `createServer({ dataFilePath, botToken, devMode, publicDir }) -> http.Server`. Add JSON body parsing, static file serving for `public/`, route handling, auth middleware using `X-Telegram-Init-Data`, and consistent JSON error responses.

- [ ] **Step 4: Add npm scripts**

Modify `package.json` to include:

```json
{
  "scripts": {
    "dev": "node src/server.mjs",
    "start": "NODE_ENV=production node src/server.mjs",
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 5: Run Task 3 tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit if git is available**

Run:

```bash
git add package.json src/server.mjs tests/api.test.mjs
git commit -m "feat: add training app api"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.

---

## Task 4: Mobile App Shell, Navigation, Logging, And Rest Timer

**Files:**
- Create: `src/lib/restTimer.mjs`
- Create: `tests/restTimer.test.mjs`
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/telegram.js`
- Create: `public/api.js`
- Create: `public/app.js`

**Interfaces:**
- Consumes API endpoints from Task 3.
- Produces: `createRestTimerState({ startedAtMs: number, durationSeconds: number, nowMs: number }) -> { remainingSeconds: number, done: boolean }`
- Browser functions in `public/app.js`: `initApp()`, `renderHome()`, `renderWorkout(dayId)`, `renderExercise(exerciseId)`, `startRestTimer(durationSeconds)`

- [ ] **Step 1: Write rest timer tests**

Create `tests/restTimer.test.mjs` with assertions that:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createRestTimerState } from "../src/lib/restTimer.mjs";

test("rest timer reports remaining seconds without going negative", () => {
  assert.deepEqual(createRestTimerState({ startedAtMs: 0, durationSeconds: 90, nowMs: 30000 }), { remainingSeconds: 60, done: false });
  assert.deepEqual(createRestTimerState({ startedAtMs: 0, durationSeconds: 90, nowMs: 95000 }), { remainingSeconds: 0, done: true });
});
```

- [ ] **Step 2: Run rest timer tests to verify they fail**

Run: `node --test tests/restTimer.test.mjs`

Expected: FAIL because `src/lib/restTimer.mjs` does not exist.

- [ ] **Step 3: Implement `src/lib/restTimer.mjs`**

Implement timestamp-based calculation so browser navigation or delayed intervals cannot create negative time.

- [ ] **Step 4: Build the static app shell**

Create `public/index.html` with Telegram script loading, safe-area viewport meta, root container, bottom navigation, and no marketing hero. Create `public/styles.css` with a dark WHOOP-like palette, compact metric rings, thumb-friendly buttons, stable fixed dimensions for controls, and responsive iPhone layout.

- [ ] **Step 5: Implement Telegram bridge**

Create `public/telegram.js` exporting `getTelegramInitData()`, `getTelegramUser()`, `readyTelegramApp()`, `triggerHaptic(type)`, and `isTelegram()` using `window.Telegram?.WebApp`, with safe local fallbacks.

- [ ] **Step 6: Implement browser API client**

Create `public/api.js` exporting `apiGet(path)` and `apiSend(method, path, body)`. Include `X-Telegram-Init-Data` from `getTelegramInitData()` on every request.

- [ ] **Step 7: Implement app rendering and set logging**

Create `public/app.js` to bootstrap state, render Today, Workout, Exercise, Progress, and Settings views. On set completion, send `POST /api/sets` with `clientSetId`, update local state, start the rest timer using the exercise default rest seconds, and disable duplicate submit while the request is in flight.

- [ ] **Step 8: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Run local server and manually verify UI**

Run: `npm run dev`

Open the printed local URL. Verify in a mobile-width viewport that:

- Today screen is the first screen.
- Monday, Wednesday, and Friday are selectable.
- Exercise detail allows kg/reps entry.
- Completing a set starts a visible timer.
- Timer reaches zero without layout shift.

- [ ] **Step 10: Commit if git is available**

Run:

```bash
git add src/lib/restTimer.mjs tests/restTimer.test.mjs public/index.html public/styles.css public/telegram.js public/api.js public/app.js
git commit -m "feat: add mobile training mini app UI"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.

---

## Task 5: Progress, Body Weight, Technique Media, And Polish

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `tests/api.test.mjs`

**Interfaces:**
- Consumes API endpoints from Task 3.
- Produces UI flows for exercise progress, body weight entry, and technique media editing.

- [ ] **Step 1: Extend API tests for body weight and media**

Modify `tests/api.test.mjs` to assert:

- `POST /api/body-weight` stores and returns the latest body weight.
- invalid body weight returns HTTP `400`.
- `PATCH /api/exercises/:exerciseId/media` stores media type and URL.
- `GET /api/bootstrap` includes saved body weight and technique media.

- [ ] **Step 2: Run extended API tests**

Run: `node --test tests/api.test.mjs`

Expected: PASS if Task 3 already implemented these endpoints fully. If it fails, the failure must identify one of these exact response gaps: missing latest body weight in bootstrap, missing technique media in bootstrap, invalid body weight not returning HTTP `400`, or media update not persisting.

- [ ] **Step 3: Complete the exact API/store gap reported by Step 2**

Update `src/server.mjs` or `src/lib/dataStore.mjs` only for the failing response named in Step 2. Keep the existing API response shape stable.

- [ ] **Step 4: Implement progress charts**

In `public/app.js`, render simple SVG line/bar charts for exercise best weight, exercise volume, and body weight trend. Keep charts readable on iPhone and use no external chart dependency.

- [ ] **Step 5: Implement body weight UI**

Add a compact body weight entry form in Settings or Progress, submit to `POST /api/body-weight`, and refresh latest body weight on Home.

- [ ] **Step 6: Implement technique media UI**

Add media type and URL editing for each exercise. Render YouTube/video links as a tappable preview/link and image URLs as image previews.

- [ ] **Step 7: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Manual mobile QA**

Run: `npm run dev` and verify:

- No text overlaps in iPhone-sized viewport.
- Buttons and inputs are thumb-friendly.
- Progress updates after adding sets.
- Body weight trend updates after adding an entry.
- Technique media appears on the exercise screen.
- Empty states are clear and compact.

- [ ] **Step 9: Commit if git is available**

Run:

```bash
git add public/app.js public/styles.css src/server.mjs src/lib/dataStore.mjs tests/api.test.mjs
git commit -m "feat: add progress body weight and media flows"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.

---

## Task 6: Telegram Setup Documentation And Final Verification

**Files:**
- Create: `README.md`
- Modify: `package.json`
- Create: `.gitignore`

**Interfaces:**
- Consumes the complete app from Tasks 1-5.
- Produces local run instructions and Telegram deployment checklist.

- [ ] **Step 1: Write README**

Create `README.md` with:

- local setup: no dependency install is required for the MVP; run `npm run dev`
- test command: `npm test`
- environment variables: `BOT_TOKEN`, `PORT`, `DATA_FILE`
- Telegram BotFather setup steps
- HTTPS requirement for production Mini App URL
- development fallback explanation

- [ ] **Step 2: Add `.gitignore`**

Create `.gitignore` with:

```gitignore
data/app-data.json
node_modules/
.env
.DS_Store
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Start app for final local verification**

Run: `npm run dev`

Expected: server prints a local URL and serves the app successfully.

- [ ] **Step 5: Final browser/mobile verification**

Open the app locally, switch through all main tabs, log at least one set, add body weight, add technique media, reload the page, and verify data persists.

- [ ] **Step 6: Commit if git is available**

Run:

```bash
git add README.md .gitignore package.json
git commit -m "docs: add telegram setup and final project docs"
```

If the directory is not a git repository, skip the commit and record that in the final handoff.
