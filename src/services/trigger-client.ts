// src/services/trigger-client.ts
import { TriggerClient } from "@trigger.dev/sdk";

// Initialize the Trigger.dev client with lazy initialization
let _client: TriggerClient | null = null;

export function getClient(): TriggerClient {
  if (!_client) {
    if (!process.env.TRIGGER_DEV_TOKEN) {
      console.warn("TRIGGER_DEV_TOKEN environment variable not set");
    }
    
    _client = new TriggerClient({
      id: "uwularpy",
      apiKey: process.env.TRIGGER_DEV_TOKEN || "",
      apiUrl: process.env.TRIGGER_API_URL,
    });
  }
  return _client;
}

// Export the tasks module for v3 API
export async function triggerTask(taskId: string, payload: any) {
  // Dynamically import the tasks module to avoid circular dependencies
  const { tasks } = await import("@trigger.dev/sdk/v3");
  
  // Use the trigger method from the tasks module
  return await tasks.trigger(taskId, payload);
}
