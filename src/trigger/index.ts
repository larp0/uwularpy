import { TriggerClient } from "@trigger.dev/sdk/v3";

// Initialize the Trigger.dev client
export const client = new TriggerClient({
  id: "uwularpy",
  apiKey: process.env.TRIGGER_DEV_TOKEN,
  apiUrl: process.env.TRIGGER_API_URL,
});
