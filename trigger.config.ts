import { defineConfig } from "@trigger.dev/sdk/v3";
import { BuildExtension } from "@trigger.dev/build";

// Create a custom build extension to ensure Rust uwuify is used
function rustUwuifyExtension(): BuildExtension {
  return {
    name: "rust-uwuify-extension",
    // Add uwuify-rs as an external dependency
    externalsForTarget: async (target) => {
      return ["uwuify-rs"];
    },
    // Set up the build environment
    onBuildStart: async (context) => {
      console.log("Setting up Rust uwuify extension...");
      
      // Register any necessary plugins or configurations
      if (context.target === "deploy") {
        console.log("Preparing Rust uwuify for deployment...");
      }
    },
    // Ensure the Rust implementation is properly included
    onBuildComplete: async (context, manifest) => {
      console.log("Finalizing Rust uwuify integration...");
      
      // Add any necessary layers or configurations
      if (context.target === "deploy") {
        // Add a layer to ensure the Rust implementation is included
        context.addLayer({
          id: "rust-uwuify-layer",
          // Add any necessary dependencies
          deps: {
            "uwuify-rs": "^1.0.0"
          }
        });
      }
    }
  };
}

export default defineConfig({
  project: "proj_xadoucnepuzlmbifjvgz",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  // Add the Rust uwuify extension to ensure it's always used
  build: {
    extensions: [rustUwuifyExtension()]
  }
});
