// src/lib/__tests__/general-response.test.ts
import { parseCommand, getTaskType } from '../command-parser';

describe('General Response Task Routing', () => {
  test('empty command should route to general-response-task', async () => {
    const parsedCommand = parseCommand('@l');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('general-response-task');
  });

  test('unknown command should route to general-response-task', async () => {
    const parsedCommand = parseCommand('@l help me with this issue');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('general-response-task');
  });

  test('question to bot should route to general-response-task', async () => {
    const parsedCommand = parseCommand('@l bot what do you think about this?');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('general-response-task');
  });

  test('specific commands still work - review', async () => {
    const parsedCommand = parseCommand('@l review');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('full-code-review');
  });

  test('specific commands still work - dev commands route to codex-task', async () => {
    const parsedCommand = parseCommand('@l dev fix this bug');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('codex-task');
  });

  test('approval commands still work', async () => {
    const parsedCommand = parseCommand('@l approve');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('plan-approval-task');
  });

  test('plan commands still work', async () => {
    const parsedCommand = parseCommand('@l plan implement feature X');
    const taskType = await getTaskType(parsedCommand);
    expect(taskType).toBe('plan-task');
  });
});
