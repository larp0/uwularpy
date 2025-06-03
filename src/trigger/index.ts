// src/trigger/index.ts
// This file re-exports task definitions to avoid circular dependencies

export { uwuifyRepositoryTask, codexTask, fullCodeReviewTask, planTask } from "./task-registry";
