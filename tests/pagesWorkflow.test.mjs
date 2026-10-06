import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("GitHub Pages workflow deploys the public app folder", async () => {
  const workflow = await readFile(".github/workflows/pages.yml", "utf8");

  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /path:\s*public/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
