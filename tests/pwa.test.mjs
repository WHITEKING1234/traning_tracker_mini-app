import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("index.html exposes installable iPhone and PWA metadata", async () => {
  const html = await readFile(join("public", "index.html"), "utf8");

  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Training OS"/);
});

test("manifest defines a standalone installable training app", async () => {
  const manifest = JSON.parse(await readFile(join("public", "manifest.webmanifest"), "utf8"));

  assert.equal(manifest.name, "Training OS");
  assert.equal(manifest.short_name, "Training OS");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#050507");
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-192.png" && icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.src === "/icon-512.png" && icon.sizes === "512x512"));
});

test("apple touch icon is a PNG file", async () => {
  const icon = await readFile(join("public", "apple-touch-icon.png"));
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
