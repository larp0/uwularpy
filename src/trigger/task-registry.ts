// src/trigger/task-registry.ts

import { task } from "@trigger.dev/sdk/v3";
import { GitHubContext } from "../services/task-types";

// Export the task definition separately from the implementation
// This helps break circular dependencies
export const uwuifyRepositoryTask = task({
  id: "uwuify-repository",
  machine: "large-2x",
  // Set a longer maxDuration for repository processing
  maxDuration: 600, // 20 minutes
  run: async (payload: GitHubContext, { ctx }) => {
    // Dynamically import the implementation to avoid circular dependencies
    const { runUwuifyTask } = await import("./uwuify-implementation");
    return await runUwuifyTask(payload, ctx);
  },
});
