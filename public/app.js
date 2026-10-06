import { apiGet, apiSend } from "./api.js";
import { getTelegramUser, readyTelegramApp, triggerHaptic } from "./telegram.js";

const appRoot = document.querySelector("#app");
const screenTitle = document.querySelector("#screen-title");
const profilePill = document.querySelector("#profile-pill");
const navButtons = [...document.querySelectorAll(".nav-button")];

const state = {
  boot: null,
  activeTab: "home",
  selectedDayId: "monday",
  selectedExerciseId: "",
  selectedProgressKey: "",
  selectedMediaExerciseId: "",
  activeTimer: null,
  timerInterval: null,
  pendingSet: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatKg(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function createRestTimerState({ startedAtMs, durationSeconds, nowMs = Date.now() }) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const elapsedSeconds = Math.max(0, Math.floor((Number(nowMs) - Number(startedAtMs)) / 1000));
  const remainingSeconds = Math.max(0, duration - elapsedSeconds);
  return { remainingSeconds, done: remainingSeconds === 0 };
}

function allExercises() {
  return state.boot?.exercises ?? state.boot?.workoutDays.flatMap((day) => day.exercises) ?? [];
}

function uniqueExercises() {
  const map = new Map();
  for (const exercise of allExercises()) {
    if (!map.has(exercise.exerciseKey)) map.set(exercise.exerciseKey, exercise);
  }
  return [...map.values()];
}

function currentDay() {
  return state.boot.workoutDays.find((day) => day.id === state.selectedDayId) ?? state.boot.todayWorkout;
}

function getExercise(exerciseId = state.selectedExerciseId) {
  return allExercises().find((exercise) => exercise.id === exerciseId) ?? currentDay().exercises[0];
}

function currentSession(dayId = state.selectedDayId) {
  return [...state.boot.sessions]
    .reverse()
    .find((session) => session.workoutDayId === dayId && session.sessionDate === state.boot.today);
}

function setsForExercise(exerciseId) {
  return state.boot.sets.filter((set) => set.exerciseId === exerciseId);
}

function setsForCurrentSession(exerciseId) {
  const session = currentSession();
  if (!session) return [];
  return state.boot.sets.filter((set) => set.workoutSessionId === session.id && set.exerciseId === exerciseId);
}

function bestSetForExercise(exerciseKey) {
  const sets = state.boot.sets.filter((set) => set.exerciseKey === exerciseKey);
  return sets.sort((left, right) => {
    if (right.weightKg !== left.weightKg) return right.weightKg - left.weightKg;
    return right.reps - left.reps;
  })[0];
}

function setScreen(title) {
  screenTitle.textContent = title;
  navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === state.activeTab));
}

function updateProfile() {
  const tgUser = getTelegramUser();
  const first = tgUser?.first_name ?? state.boot?.user?.firstName ?? "TG";
  profilePill.textContent = first.slice(0, 2).toLocaleUpperCase("ru-RU");
}

function daySwitcher() {
  return `
    <div class="segmented" role="tablist" aria-label="Дни тренировок">
      ${state.boot.workoutDays
        .map(
          (day) => `
            <button class="segment-button ${day.id === state.selectedDayId ? "is-active" : ""}" type="button" data-action="select-day" data-day-id="${day.id}">
              ${escapeHtml(day.title.slice(0, 2))}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function metricCard(label, value, ringValue, sub = "") {
  return `
    <article class="metric-card">
      <div class="metric-ring" style="--value: ${Math.max(0, Math.min(100, ringValue))}%"><span>${escapeHtml(value)}</span></div>
      <p class="metric-label">${escapeHtml(label)}</p>
      ${sub ? `<p class="metric-value">${escapeHtml(sub)}</p>` : ""}
    </article>
  `;
}

function calculateTodayVolume() {
  return calculateVolumeForDay(state.boot.todayWorkout.id);
}

function calculateVolumeForDay(dayId) {
  const session = currentSession(dayId);
  if (!session) return 0;
  return state.boot.sets
    .filter((set) => set.workoutSessionId === session.id)
    .reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

function completedSetsForDay(dayId) {
  const session = currentSession(dayId);
  if (!session) return 0;
  return state.boot.sets.filter((set) => set.workoutSessionId === session.id).length;
}

export function renderHome() {
  state.activeTab = "home";
  setScreen("Сегодня");
  const workout = currentDay();
  const completed = completedSetsForDay(workout.id);
  const planned = workout.exercises.length * 3;
  const volume = calculateVolumeForDay(workout.id);
  const bodyWeight = state.boot.latestBodyWeight?.weightKg;

  appRoot.innerHTML = `
    <section class="panel">
      <div class="inline-row">
        <div>
          <p class="eyebrow">План на сегодня</p>
          <h2>${escapeHtml(workout.title)}</h2>
        </div>
        <span class="mini">${workout.id === state.boot.todayWorkout.id ? escapeHtml(state.boot.today) : "план"}</span>
      </div>
      ${daySwitcher()}
      <button class="primary-button" type="button" data-action="start-today">Начать тренировку</button>
    </section>

    <section class="metric-grid">
      ${metricCard("Готовность", "85", 85, "свежий день")}
      ${metricCard("Объем", String(Math.round(volume)), Math.min(100, volume / 50), "кг x повт")}
      ${metricCard("Подходы", `${completed}/${planned}`, Math.min(100, (completed / planned) * 100), "сегодня")}
      ${metricCard("Вес тела", bodyWeight ? String(bodyWeight) : "—", bodyWeight ? 72 : 8, bodyWeight ? "кг" : "нет записи")}
    </section>

    <section class="panel">
      <h2>Ближайшие упражнения</h2>
      <div class="exercise-list">
        ${workout.exercises
          .slice(0, 5)
          .map((exercise) => exerciseRow(exercise))
          .join("")}
      </div>
    </section>
  `;
}

function exerciseRow(exercise) {
  const done = setsForCurrentSession(exercise.id).length;
  const best = bestSetForExercise(exercise.exerciseKey);
  return `
    <button class="exercise-row" type="button" data-action="open-exercise" data-exercise-id="${exercise.id}">
      <span>
        <strong>${escapeHtml(exercise.name)}</strong>
        <span class="mini">${best ? `Лучшее: ${formatKg(best.weightKg)} x ${best.reps}` : "История пустая"} · ${done} подходов сегодня</span>
      </span>
      <span class="status-dot ${done > 0 ? "done" : ""}" aria-hidden="true"></span>
    </button>
  `;
}

export function renderWorkout(dayId = state.selectedDayId) {
  state.activeTab = "workout";
  state.selectedDayId = dayId;
  const day = currentDay();
  setScreen(day.title);

  appRoot.innerHTML = `
    <section class="panel">
      ${daySwitcher()}
    </section>
    <section class="exercise-list">
      ${day.exercises.map((exercise) => exerciseRow(exercise)).join("")}
    </section>
  `;
}

function renderTechnique(exercise) {
  if (!exercise.techniqueMediaUrl) {
    return `<p class="muted">Добавь ссылку на видео или фото техники в настройках.</p>`;
  }

  if (exercise.techniqueMediaType === "image") {
    return `
      <div class="media-preview">
        <img src="${escapeHtml(exercise.techniqueMediaUrl)}" alt="${escapeHtml(exercise.name)}" />
        <a class="ghost-button" href="${escapeHtml(exercise.techniqueMediaUrl)}" target="_blank" rel="noreferrer">Открыть источник</a>
      </div>
    `;
  }

  return `<a class="ghost-button" href="${escapeHtml(exercise.techniqueMediaUrl)}" target="_blank" rel="noreferrer">Смотреть технику</a>`;
}

function renderTimer() {
  if (!state.activeTimer) return "";
  const timer = createRestTimerState(state.activeTimer);
  const elapsed = state.activeTimer.durationSeconds - timer.remainingSeconds;
  const progress = state.activeTimer.durationSeconds
    ? Math.min(100, (elapsed / state.activeTimer.durationSeconds) * 100)
    : 100;

  return `
    <section class="timer-bar" id="timer-bar">
      <div class="inline-row">
        <span class="label">Отдых</span>
        <strong>${timer.done ? "Готово" : "Следующий подход"}</strong>
      </div>
      <div class="timer-time">${formatTime(timer.remainingSeconds)}</div>
      <div class="progress-track"><span style="--progress: ${progress}%"></span></div>
    </section>
  `;
}

function renderSetHistory(exercise) {
  const sets = setsForExercise(exercise.id).slice(-8).reverse();
  if (!sets.length) return `<p class="muted">Пока нет записей. Первый подход задаст базу.</p>`;

  return `
    <div class="set-table">
      ${sets
        .map(
          (set) => `
            <div class="set-line">
              <strong>#${set.setNumber}</strong>
              <span>${formatKg(set.weightKg)} x ${set.reps}</span>
              <span class="mini">${escapeHtml(set.sessionDate)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderExercise(exerciseId = state.selectedExerciseId) {
  state.activeTab = "workout";
  state.selectedExerciseId = exerciseId;
  const exercise = getExercise(exerciseId);
  setScreen(exercise.name);

  appRoot.innerHTML = `
    ${renderTimer()}
    <section class="panel">
      <button class="ghost-button" type="button" data-action="back-workout">Назад к списку</button>
      <p class="eyebrow">${escapeHtml(exercise.category)} · отдых ${Math.round(exercise.defaultRestSeconds / 60)} мин</p>
      <h2>${escapeHtml(exercise.name)}</h2>
      ${renderTechnique(exercise)}
    </section>

    <section class="panel">
      <h2>Запись подхода</h2>
      <form class="set-form" data-form="set">
        <label class="field">
          <span>Вес, кг</span>
          <input class="input" name="weightKg" type="number" inputmode="decimal" min="0" max="500" step="0.5" required />
        </label>
        <label class="field">
          <span>Повторы</span>
          <input class="input" name="reps" type="number" inputmode="numeric" min="1" max="100" step="1" required />
        </label>
        <label class="field full">
          <span>Заметка</span>
          <input class="input" name="notes" type="text" maxlength="120" placeholder="например: чисто, тяжело, запас 1" />
        </label>
        <button class="primary-button full" type="submit" ${state.pendingSet ? "disabled" : ""}>Готово</button>
      </form>
    </section>

    <section class="panel">
      <h2>История</h2>
      ${renderSetHistory(exercise)}
    </section>
  `;
}

function chart(points, valueKey, color = "#18f28b") {
  if (!points.length) return `<div class="empty-state"><p>Данных пока нет</p></div>`;
  const max = Math.max(...points.map((point) => Number(point[valueKey]) || 0), 1);
  const step = points.length > 1 ? 260 / (points.length - 1) : 260;
  const path = points
    .map((point, index) => {
      const x = 20 + index * step;
      const y = 118 - ((Number(point[valueKey]) || 0) / max) * 96;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <div class="chart">
      <svg viewBox="0 0 300 138" role="img" aria-label="График прогресса">
        <path d="M20 118 H280" stroke="#292d36" stroke-width="1" />
        <path d="${path}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        ${points
          .map((point, index) => {
            const x = 20 + index * step;
            const y = 118 - ((Number(point[valueKey]) || 0) / max) * 96;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" />`;
          })
          .join("")}
      </svg>
    </div>
  `;
}

function historyForKey(exerciseKey) {
  const byDate = new Map();
  for (const set of state.boot.sets) {
    if (set.exerciseKey !== exerciseKey) continue;
    const list = byDate.get(set.sessionDate) ?? [];
    list.push(set);
    byDate.set(set.sessionDate, list);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, sets]) => {
      const best = sets.sort((left, right) => right.weightKg - left.weightKg || right.reps - left.reps)[0];
      return {
        date,
        bestWeightKg: best.weightKg,
        bestReps: best.reps,
        volume: sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
        sets: sets.length,
      };
    });
}

export function renderProgress() {
  state.activeTab = "progress";
  const exercises = uniqueExercises();
  if (!state.selectedProgressKey) state.selectedProgressKey = exercises[0]?.exerciseKey ?? "";
  const selected = exercises.find((exercise) => exercise.exerciseKey === state.selectedProgressKey) ?? exercises[0];
  const history = selected ? historyForKey(selected.exerciseKey) : [];
  const best = selected ? bestSetForExercise(selected.exerciseKey) : null;
  setScreen("Прогресс");

  appRoot.innerHTML = `
    <section class="panel">
      <label class="field">
        <span>Упражнение</span>
        <select class="select" data-action="select-progress">
          ${exercises
            .map(
              (exercise) => `
                <option value="${exercise.exerciseKey}" ${exercise.exerciseKey === state.selectedProgressKey ? "selected" : ""}>
                  ${escapeHtml(exercise.name)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    </section>
    <section class="panel">
      <div class="inline-row">
        <div>
          <p class="eyebrow">Лучший подход</p>
          <h2>${best ? `${formatKg(best.weightKg)} x ${best.reps}` : "Пока пусто"}</h2>
        </div>
        <span class="mini">${history.length} тренировок</span>
      </div>
      ${chart(history, "bestWeightKg")}
    </section>
    <section class="panel">
      <h2>Объем</h2>
      ${chart(history, "volume", "#54b7ff")}
    </section>
    <section class="panel">
      <h2>Вес тела</h2>
      ${chart(state.boot.bodyWeights, "weightKg", "#ffcf5a")}
    </section>
  `;
}

export function renderSettings() {
  state.activeTab = "settings";
  setScreen("Настройки");
  const exercises = allExercises();
  const mediaExercise = exercises.find((exercise) => exercise.id === state.selectedMediaExerciseId) ?? exercises[0];
  state.selectedMediaExerciseId = mediaExercise?.id ?? "";

  appRoot.innerHTML = `
    <section class="panel">
      <h2>Вес тела</h2>
      <form class="set-form" data-form="body-weight">
        <label class="field">
          <span>Дата</span>
          <input class="input" name="entryDate" type="date" value="${escapeHtml(todayIso())}" required />
        </label>
        <label class="field">
          <span>Вес, кг</span>
          <input class="input" name="weightKg" type="number" min="20" max="300" step="0.1" required />
        </label>
        <button class="primary-button full" type="submit">Сохранить вес</button>
      </form>
    </section>

    <section class="panel">
      <h2>Техника упражнения</h2>
      <form class="set-form" data-form="media">
        <label class="field full">
          <span>Упражнение</span>
          <select class="select" name="exerciseId">
            ${exercises
              .map(
                (exercise) => `
                  <option value="${exercise.id}" ${exercise.id === state.selectedMediaExerciseId ? "selected" : ""}>${escapeHtml(exercise.name)}</option>
                `,
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Тип</span>
          <select class="select" name="techniqueMediaType">
            <option value="video" ${mediaExercise?.techniqueMediaType === "video" ? "selected" : ""}>Видео</option>
            <option value="image" ${mediaExercise?.techniqueMediaType === "image" ? "selected" : ""}>Фото</option>
            <option value="link" ${mediaExercise?.techniqueMediaType === "link" ? "selected" : ""}>Ссылка</option>
          </select>
        </label>
        <label class="field">
          <span>URL</span>
          <input class="input" name="techniqueMediaUrl" type="url" value="${escapeHtml(mediaExercise?.techniqueMediaUrl ?? "")}" placeholder="https://..." />
        </label>
        <button class="primary-button full" type="submit">Сохранить технику</button>
      </form>
    </section>

    <section class="panel">
      <h2>Telegram</h2>
      <p class="muted">@${escapeHtml(state.boot.user.username || "local")} · ${escapeHtml(state.boot.user.firstName || "dev")}</p>
    </section>
  `;
}

function renderError(error) {
  appRoot.innerHTML = `
    <section class="panel">
      <h2>Что-то пошло не так</h2>
      <p class="error-text">${escapeHtml(error.message)}</p>
      <button class="primary-button" type="button" data-action="reload">Повторить</button>
    </section>
  `;
}

function render() {
  updateProfile();
  if (state.activeTab === "home") renderHome();
  if (state.activeTab === "workout") renderWorkout(state.selectedDayId);
  if (state.activeTab === "progress") renderProgress();
  if (state.activeTab === "settings") renderSettings();
}

async function refreshBoot(nextState) {
  if (nextState) {
    state.boot = nextState;
    return;
  }
  state.boot = await apiGet(`/api/bootstrap?today=${todayIso()}`);
  state.selectedDayId = state.boot.todayWorkout.id;
  state.selectedExerciseId = state.boot.todayWorkout.exercises[0]?.id ?? "";
}

async function ensureSession(dayId) {
  const existing = currentSession(dayId);
  if (existing) return existing;
  const result = await apiSend("POST", "/api/sessions", {
    workoutDayId: dayId,
    sessionDate: state.boot.today,
  });
  state.boot = result.state;
  return result.session;
}

export function startRestTimer(durationSeconds) {
  state.activeTimer = {
    startedAtMs: Date.now(),
    nowMs: Date.now(),
    durationSeconds,
  };
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (!state.activeTimer) return;
    state.activeTimer.nowMs = Date.now();
    const timer = createRestTimerState(state.activeTimer);
    const timerBar = document.querySelector("#timer-bar");
    if (timerBar && state.activeTab === "workout" && state.selectedExerciseId) {
      renderExercise(state.selectedExerciseId);
    }
    if (timer.done) {
      triggerHaptic("medium");
      clearInterval(state.timerInterval);
    }
  }, 1000);
  renderExercise(state.selectedExerciseId);
}

async function handleSetSubmit(form) {
  const exercise = getExercise();
  const session = await ensureSession(state.selectedDayId);
  const formData = new FormData(form);
  state.pendingSet = true;
  renderExercise(exercise.id);

  try {
    const result = await apiSend("POST", "/api/sets", {
      workoutSessionId: session.id,
      exerciseId: exercise.id,
      setNumber: setsForCurrentSession(exercise.id).length + 1,
      weightKg: formData.get("weightKg"),
      reps: formData.get("reps"),
      notes: formData.get("notes"),
      clientSetId: `${exercise.id}-${Date.now()}`,
    });
    state.boot = result.state;
    state.pendingSet = false;
    triggerHaptic("light");
    startRestTimer(exercise.defaultRestSeconds);
  } finally {
    state.pendingSet = false;
  }
}

async function handleBodyWeightSubmit(form) {
  const formData = new FormData(form);
  const result = await apiSend("POST", "/api/body-weight", {
    entryDate: formData.get("entryDate"),
    weightKg: formData.get("weightKg"),
  });
  state.boot = result.state;
  triggerHaptic("light");
  renderSettings();
}

async function handleMediaSubmit(form) {
  const formData = new FormData(form);
  const exerciseId = String(formData.get("exerciseId"));
  const result = await apiSend("PATCH", `/api/exercises/${encodeURIComponent(exerciseId)}/media`, {
    techniqueMediaType: formData.get("techniqueMediaType"),
    techniqueMediaUrl: formData.get("techniqueMediaUrl"),
  });
  state.boot = result.state;
  state.selectedMediaExerciseId = exerciseId;
  triggerHaptic("light");
  renderSettings();
}

function attachEvents() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      if (state.activeTab === "workout") state.selectedDayId = state.boot.todayWorkout.id;
      render();
    });
  });

  appRoot.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    try {
      if (action === "select-day") {
        state.selectedDayId = target.dataset.dayId;
        state.activeTab === "home" ? renderHome() : renderWorkout(state.selectedDayId);
      }
      if (action === "start-today") {
        await ensureSession(state.selectedDayId);
        state.activeTab = "workout";
        renderWorkout(state.selectedDayId);
      }
      if (action === "open-exercise") {
        state.selectedExerciseId = target.dataset.exerciseId;
        await ensureSession(state.selectedDayId);
        renderExercise(state.selectedExerciseId);
      }
      if (action === "back-workout") {
        renderWorkout(state.selectedDayId);
      }
      if (action === "reload") {
        await initApp();
      }
    } catch (error) {
      renderError(error);
    }
  });

  appRoot.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("[data-action='select-progress']")) {
      state.selectedProgressKey = target.value;
      renderProgress();
    }
  });

  appRoot.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      if (form.dataset.form === "set") await handleSetSubmit(form);
      if (form.dataset.form === "body-weight") await handleBodyWeightSubmit(form);
      if (form.dataset.form === "media") await handleMediaSubmit(form);
    } catch (error) {
      renderError(error);
    }
  });
}

export async function initApp() {
  readyTelegramApp();
  try {
    await refreshBoot();
    renderHome();
  } catch (error) {
    renderError(error);
  }
}

attachEvents();
initApp();
