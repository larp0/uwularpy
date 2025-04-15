import { defineConfig } from "@trigger.dev/sdk/v3";
import { BuildExtension } from "@trigger.dev/build";

// Create a custom build extension to install Rust and build the uwuify binary
function rustUwuifyExtension(): BuildExtension {
  return {
    name: "rust-uwuify-extension",
    // Set up the build environment
    onBuildStart: async (context) => {
      console.log("Setting up Rust uwuify extension...");
    },
    // Ensure the Rust implementation is properly included and built
    onBuildComplete: async (context, manifest) => {
      console.log("Installing Rust and building uwuify binary...");
      
      if (context.target === "deploy") {
        // Add a layer to install Rust and build the binary
        context.addLayer({
          id: "rust-uwuify-layer",
          // Commands to run in the build container
          cmds: [
            // Install Rust
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
            // Add Cargo to PATH
            "export PATH=\"$HOME/.cargo/bin:$PATH\"",
            // Build the uwuify binary
            "cd src/lib/rust-binary && $HOME/.cargo/bin/cargo build --release",
            // Copy the binary to a location that will be available in the final image
            "mkdir -p /app/src/lib/rust-binary/",
            "cp src/lib/rust-binary/target/release/uwuify-binary /app/src/lib/rust-binary/"
          ]
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
