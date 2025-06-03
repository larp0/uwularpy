// src/trigger/index.ts
// This file re-exports task definitions to avoid circular dependencies

export { uwuifyRepositoryTask, codexTask, fullCodeReviewTask, planTask, planApprovalTask, planExecutionTask, prMonitoringTask, prMergeProgressionTask } from "./task-registry";
