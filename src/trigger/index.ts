// src/trigger/index.ts
// This file re-exports task definitions to avoid circular dependencies

export { uwuifyRepositoryTask, codexTask, fullCodeReviewTask, planTask, planApprovalTask } from "./task-registry";
