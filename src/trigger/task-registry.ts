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

export const codexTask = task({
  id: "codex-task",
  machine: "large-2x",
  // Set a longer maxDuration for repository processing
  maxDuration: 600, // 20 minutes
  run: async (payload: GitHubContext, ctx) => {
    // Dynamically import the implementation to avoid circular dependencies
    const { runCodexTask } = await import("./codex-task");
    return await runCodexTask(payload, ctx);
  },
});

export const fullCodeReviewTask = task({
  id: "full-code-review",
  machine: "large-2x",
  maxDuration: 900, // 15 minutes
  run: async (payload: GitHubContext, { ctx }) => {
    const { runFullCodeReviewTask } = await import("./full-code-review-implementation");
    return await runFullCodeReviewTask(payload, ctx);
  },
});

export const planTask = task({
  id: "plan-task",
  machine: "large-2x",
  maxDuration: 1200, // 20 minutes for comprehensive repository analysis
  run: async (payload: GitHubContext, { ctx }) => {
    const { runPlanTask } = await import("./plan-implementation");
    return await runPlanTask(payload, ctx);
  },
});

export const planApprovalTask = task({
  id: "plan-approval-task",
  machine: "large-2x",
  maxDuration: 600, // 10 minutes for milestone decomposition
  run: async (payload: GitHubContext, { ctx }) => {
    const { runPlanApprovalTask } = await import("./plan-approval-implementation");
    return await runPlanApprovalTask(payload, ctx);
  },
});

export const planExecutionTask = task({
  id: "plan-execution-task",
  machine: "large-2x",
  maxDuration: 300, // 5 minutes for workflow initiation
  run: async (payload: GitHubContext, { ctx }) => {
    const { runPlanExecutionTask } = await import("./plan-execution-implementation");
    return await runPlanExecutionTask(payload, ctx);
  },
});

export const prMonitoringTask = task({
  id: "pr-monitoring-task",
  machine: "small-1x",
  maxDuration: 120, // 2 minutes for PR monitoring
  run: async (payload: GitHubContext, { ctx }) => {
    const { runPRMonitoringTask } = await import("./pr-monitoring-implementation");
    return await runPRMonitoringTask(payload, ctx);
  },
});

export const prMergeProgressionTask = task({
  id: "pr-merge-progression-task", 
  machine: "small-1x",
  maxDuration: 300, // 5 minutes for PR merge progression
  run: async (payload: GitHubContext, { ctx }) => {
    const { runPRMergeProgressionTask } = await import("./pr-merge-progression-implementation");
    return await runPRMergeProgressionTask(payload, ctx);
  },
});
