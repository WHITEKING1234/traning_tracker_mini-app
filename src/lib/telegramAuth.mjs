import crypto from "node:crypto";

export function parseTelegramInitData(initData = "") {
  const params = new URLSearchParams(initData);
  const result = {};

  for (const [key, value] of params.entries()) {
    if (key === "user" || key === "receiver" || key === "chat") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

function buildDataCheckString(initData) {
  const params = new URLSearchParams(initData);
  params.delete("hash");
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function timingSafeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

export function validateTelegramInitData(initData, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!initData) return { ok: false, reason: "missing_init_data" };
  if (!botToken) return { ok: false, reason: "missing_bot_token" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!hash) return { ok: false, reason: "missing_hash" };
  if (!Number.isFinite(authDate)) return { ok: false, reason: "missing_auth_date" };
  if (nowSeconds - authDate > 86400) return { ok: false, reason: "expired" };

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(buildDataCheckString(initData))
    .digest("hex");

  if (!timingSafeEqualHex(hash, expectedHash)) return { ok: false, reason: "invalid_hash" };

  const parsed = parseTelegramInitData(initData);
  if (!parsed.user?.id) return { ok: false, reason: "missing_user" };

  return { ok: true, user: parsed.user };
}

export function getAuthenticatedUser({ initData, botToken, devMode = false } = {}) {
  if (botToken) {
    const result = validateTelegramInitData(initData, botToken);
    if (!result.ok) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      error.reason = result.reason;
      throw error;
    }
    return {
      id: `tg-${result.user.id}`,
      telegramId: String(result.user.id),
      username: result.user.username ?? "",
      firstName: result.user.first_name ?? "",
      photoUrl: result.user.photo_url ?? "",
    };
  }

  if (devMode) {
    return {
      id: "dev-user",
      telegramId: "dev-user",
      username: "local",
      firstName: "Hoji",
      photoUrl: "",
    };
  }

  const error = new Error("Unauthorized");
  error.statusCode = 401;
  error.reason = "missing_credentials";
  throw error;
}
