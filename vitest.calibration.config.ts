import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** `npm run calibrate`: slow, networked model checks kept out of the regular test run. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/**/*.calibration.ts"],
    testTimeout: 300_000,
  },
});
