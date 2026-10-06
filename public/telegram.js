export function telegramWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram() {
  return Boolean(telegramWebApp()?.initData);
}

export function getTelegramInitData() {
  return telegramWebApp()?.initData ?? "";
}

export function getTelegramUser() {
  return telegramWebApp()?.initDataUnsafe?.user ?? null;
}

export function readyTelegramApp() {
  const app = telegramWebApp();
  if (!app) return;
  app.ready();
  app.expand();
  app.setHeaderColor?.("#050507");
  app.setBackgroundColor?.("#050507");
}

export function triggerHaptic(type = "light") {
  telegramWebApp()?.HapticFeedback?.impactOccurred?.(type);
}
