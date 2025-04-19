import { defineConfig } from "@trigger.dev/sdk/v3";
import { additionalFiles, additionalPackages } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_xadoucnepuzlmbifjvgz",
  runtime: "node",
  logLevel: "info",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 1,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  // Add additionalFiles extension to include the uwuify binary
  build: {
    extensions: [
      additionalFiles({
        files: ["src/lib/bin/uwuify"]
      }),
      additionalPackages({ packages: ["@openai/codex"] })
    ]
  },
});
