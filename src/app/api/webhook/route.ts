// src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/github-auth';
import { getClient } from '@/trigger';
import { uwuifyRepositoryTask } from '@/trigger/uwuify';

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
    if (event === 'issue_comment' && body.action === 'created') {
      const comment = body.comment.body;
      const issueNumber = body.issue.number;
      const requester = body.comment.user.login;
      const repo = body.repository.name;
      const owner = body.repository.owner.login;
      
      // Check if the comment mentions @uwularpy
      if (comment.includes('@uwularpy')) {
        console.log(`Mention detected in issue #${issueNumber} by ${requester}`);
        
        try {
          // Trigger the uwuify repository task using trigger.dev
          // All processing will be handled by trigger.dev
          const client = getClient();
          const runId = await client.runTask(uwuifyRepositoryTask, {
            owner,
            repo,
            issueNumber,
            requester,
            installationId: body.installation.id,
            requestTimestamp: new Date().toISOString(),
            requestId: generateRequestId(),
          });
          
          console.log(`Triggered uwuify repository task, run ID: ${runId}`);
          
          // Return success response immediately after triggering the task
          return NextResponse.json({ 
            message: 'Webhook processed successfully', 
            runId: runId 
          }, { status: 200 });
        } catch (error) {
          console.error('Error triggering uwuify repository task:', error);
          return NextResponse.json({ 
            error: 'Error triggering uwuification task',
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

/**
 * Generates a unique request ID for tracking
 * 
 * @returns A unique ID string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
