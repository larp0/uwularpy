// src/trigger/index.ts
import { TriggerClient } from "@trigger.dev/sdk/v3";

// Initialize the Trigger.dev client with lazy initialization to prevent circular dependencies
let _client: any = null;

export function getClient() {
  if (!_client) {
    _client = new TriggerClient({
      id: "uwularpy",
      apiKey: process.env.TRIGGER_DEV_TOKEN || "",
      apiUrl: process.env.TRIGGER_API_URL,
    });
  }
  return _client;
}
