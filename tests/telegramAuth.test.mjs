import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  getAuthenticatedUser,
  parseTelegramInitData,
  validateTelegramInitData,
} from "../src/lib/telegramAuth.mjs";

function buildInitData(payload, botToken) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

test("parseTelegramInitData decodes user JSON", () => {
  const parsed = parseTelegramInitData("user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Hoji%22%7D&auth_date=1&hash=x");
  assert.equal(parsed.user.id, 123);
  assert.equal(parsed.user.first_name, "Hoji");
});

test("validateTelegramInitData accepts signed Telegram data", () => {
  const initData = buildInitData(
    { user: { id: 123, first_name: "Hoji", username: "h" }, auth_date: 100 },
    "test-token",
  );
  const result = validateTelegramInitData(initData, "test-token", 100);

  assert.equal(result.ok, true);
  assert.equal(result.user.id, 123);
});

test("validateTelegramInitData rejects tampered data", () => {
  const result = validateTelegramInitData("user=%7B%22id%22%3A123%7D&auth_date=1&hash=bad", "test-token", 1);
  assert.equal(result.ok, false);
});

test("validateTelegramInitData rejects expired auth dates", () => {
  const initData = buildInitData({ user: { id: 123 }, auth_date: 1 }, "test-token");
  const result = validateTelegramInitData(initData, "test-token", 90_000);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired");
});

test("getAuthenticatedUser allows a fixed dev user only in dev mode without bot token", () => {
  assert.equal(getAuthenticatedUser({ devMode: true }).telegramId, "dev-user");
  assert.throws(() => getAuthenticatedUser({ devMode: false }), /Unauthorized/);
});
