// MapLibre GL v6 is ESM-only and loads its worker from a URL. Bundlers can't resolve that URL,
// so the docs recommend self-hosting the worker and calling setWorkerUrl().
// https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "maplibre-gl", "dist");
const target = join(root, "public", "maplibre");

if (!existsSync(source)) {
  console.warn("[maplibre] node_modules/maplibre-gl not found; skipping worker copy");
  process.exit(0);
}
mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(source, file), join(target, file));
}
