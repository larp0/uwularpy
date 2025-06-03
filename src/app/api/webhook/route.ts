// src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/services/github-auth';
import { getClient, triggerTask } from '@/services/trigger-client';
import { generateRequestId, GitHubContext } from '@/services/task-types';
import { parseCommand, getTaskType } from '@/lib/command-parser';

// POST handler for webhook
export async function POST(request: NextRequest) {
  let body: any;
  let rawBody: string;
  
  try {
    // Get the raw request body for signature verification
    rawBody = await request.text();
    
    // Validate raw body
    if (!rawBody || typeof rawBody !== 'string') {
      console.warn('Invalid or empty request body received');
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Parse JSON with error handling
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.warn('Failed to parse webhook JSON payload:', parseError instanceof Error ? parseError.message : 'Unknown parse error');
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    
    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('Webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const event = request.headers.get('x-github-event');
    
    // Only process issue_comment events
    if (event === 'issue_comment' && body.action === 'created' && body.comment?.user?.login !== 'uwularpy') {
      // Validate required fields
      if (!body.comment?.body || !body.issue?.number || !body.repository?.name || !body.repository?.owner?.login) {
        console.warn('Missing required fields in webhook payload');
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      const comment = body.comment.body;
      const issueNumber = body.issue.number;
      const requester = body.comment.user.login;
      const repo = body.repository.name;
      const owner = body.repository.owner.login;
      
      // Validate installation ID
      if (!body.installation?.id) {
        console.warn('Missing installation ID in webhook payload');
        return NextResponse.json({ error: 'Missing installation ID' }, { status: 400 });
      }
      
      // Parse the command from the comment with enhanced safety
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
          console.error('Error triggering task:', error instanceof Error ? error.message : 'Unknown error');
          return NextResponse.json({ 
            error: 'Error triggering task',
            message: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }
    }
    
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ 
      error: 'Error processing webhook', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
