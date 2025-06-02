// src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/services/github-auth';
import { getClient, triggerTask } from '@/services/trigger-client';
import { generateRequestId, GitHubContext } from '@/services/task-types';
import { parseCommand, getTaskType } from '@/lib/command-parser';

// POST handler for webhook
export async function POST(request: NextRequest) {
  try {
    // Get the raw request body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    
    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const event = request.headers.get('x-github-event');
    
    // Only process issue_comment events
    if (event === 'issue_comment' && body.action === 'created' && body.comment.user.login !== 'uwularpy') {
      const comment = body.comment.body;
      const issueNumber = body.issue.number;
      const requester = body.comment.user.login;
      const repo = body.repository.name;
      const owner = body.repository.owner.login;
      
      // Parse the command from the comment
      const parsedCommand = parseCommand(comment);
      
      if (parsedCommand.isMention) {
        console.log(`Mention detected in issue #${issueNumber} by ${requester}`);

        try {
          // Prepare the context for the task
          const context: GitHubContext = {
            owner,
            repo,
            issueNumber,
            requester,
            installationId: body.installation.id,
            requestTimestamp: new Date().toISOString(),
            requestId: generateRequestId(),
            message: parsedCommand.fullText,
          };

          // Determine which task to trigger
          const taskType = getTaskType(parsedCommand);
          
          if (taskType) {
            const runHandle = await triggerTask(taskType, context);
            console.log(`Triggered ${taskType} task, run ID: ${runHandle.id}`);
            return NextResponse.json({ 
              message: `${taskType} task triggered`, 
              runId: runHandle.id 
            }, { status: 200 });
          } else {
            return NextResponse.json({ 
              message: 'No action required' 
            }, { status: 200 });
          }
        } catch (error) {
          console.error('Error triggering task:', error);
          return NextResponse.json({ 
            error: 'Error triggering task',
            message: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }
    }
    
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ 
      error: 'Error processing webhook', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
