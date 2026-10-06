import { createLocalTrainingApi } from "./localTrainingApi.js";
import { getTelegramInitData, getTelegramUser } from "./telegram.js";

const localApi = createLocalTrainingApi({ getUser: getTelegramUser });

function shouldUseLocalApi() {
  const location = globalThis.location;
  if (!location) return false;
  return (
    location.protocol === "file:" ||
    location.hostname.endsWith("github.io") ||
    location.search.includes("storage=local")
  );
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": getTelegramInitData(),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(body?.error ?? "Ошибка запроса");
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export function apiGet(path) {
  if (shouldUseLocalApi()) return localApi.get(path);
  return request(path);
}

export function apiSend(method, path, body) {
  if (shouldUseLocalApi()) return localApi.send(method, path, body);
  return request(path, {
    method,
    body: JSON.stringify(body ?? {}),
  });
}
