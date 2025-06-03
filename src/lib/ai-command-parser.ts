import { logger } from "@trigger.dev/sdk/v3";

interface IntentClassification {
  intent: string;
  confidence: number;
  originalCommand: string;
  normalizedCommand: string;
  language?: string;
}

/**
 * Uses AI to intelligently parse user intent from commands
 * Handles typos, multiple languages, and various phrasings
 */
export async function classifyCommandIntent(
  command: string,
  context?: { 
    recentMilestone?: boolean;
    lastTaskType?: string;
  }
): Promise<IntentClassification> {
  
  const systemPrompt = `You are a command intent classifier for a GitHub bot. Your job is to understand what the user wants to do, regardless of typos, language, or phrasing.

AVAILABLE INTENTS:
1. "approval" - User wants to approve a plan/milestone (yes, ok, approve, go ahead, looks good, lgtm, ship it, let's do it, etc.)
2. "plan" - User wants to create a development plan
3. "refine" - User wants to modify/update an existing plan
4. "cancel" - User wants to cancel/reject a plan
5. "review" - User wants a code review
6. "execute" - User wants to start execution (go, start, begin, let's go, lfg, do it, etc.)
7. "codex" - Any other development task or unclear intent

MULTI-LANGUAGE SUPPORT:
Recognize approval in any language:
- English: yes, ok, approve, go ahead
- Spanish: sí, ok, aprobar, adelante
- French: oui, ok, approuver, allez-y
- German: ja, ok, genehmigen, los
- Portuguese: sim, ok, aprovar, vamos
- Italian: sì, ok, approvare, vai
- Russian: да, ок, одобрить, давай
- Chinese: 是的, 好的, 批准, 开始
- Japanese: はい, OK, 承認, 始めましょう
- And other languages...

TYPO TOLERANCE:
- "aprove" → "approval"
- "ys" → "approval" (likely "yes")
- "oke" → "approval"
- "refien" → "refine"
- "cancle" → "cancel"

CONTEXT AWARENESS:
${context?.recentMilestone ? "- User recently created a milestone, so approval-related commands are more likely" : ""}
${context?.lastTaskType ? `- Last task was: ${context.lastTaskType}` : ""}

OUTPUT FORMAT:
{
  "intent": "approval|plan|refine|cancel|review|execute|codex",
  "confidence": 0.0-1.0,
  "normalizedCommand": "the intent in standard english",
  "language": "detected language code (en, es, fr, etc.)"
}`;

  const userPrompt = `Classify this command: "${command}"

Remember to:
1. Be generous with typo correction
2. Recognize intent in ANY language
3. Consider the context
4. Default to "codex" only if truly unclear`;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const classification = JSON.parse(content) as IntentClassification;
    classification.originalCommand = command;

    logger.info("AI command classification", { ...classification });
    return classification;

  } catch (error) {
    logger.error("AI classification failed, using fallback", { error });
    
    // Fallback to basic pattern matching
    return fallbackClassification(command);
  }
}

/**
 * Fallback classification using basic patterns
 */
function fallbackClassification(command: string): IntentClassification {
  const normalized = command.toLowerCase().trim();
  
  // Approval patterns (more flexible)
  if (/^(y|yes|ok|okay|approve|lgtm|ship|go\s+ahead|looks\s+good)/i.test(normalized)) {
    return {
      intent: 'approval',
      confidence: 0.8,
      originalCommand: command,
      normalizedCommand: 'approve',
      language: 'en'
    };
  }
  
  // Plan patterns
  if (/^(plan|planning|analyze)/i.test(normalized)) {
    return {
      intent: 'plan',
      confidence: 0.9,
      originalCommand: command,
      normalizedCommand: normalized,
      language: 'en'
    };
  }
  
  // Other patterns...
  if (/^(refine|revise|modify|update|change|edit)/i.test(normalized)) {
    return {
      intent: 'refine',
      confidence: 0.8,
      originalCommand: command,
      normalizedCommand: 'refine',
      language: 'en'
    };
  }
  
  if (/^(cancel|reject|no|abort|stop)/i.test(normalized)) {
    return {
      intent: 'cancel',
      confidence: 0.8,
      originalCommand: command,
      normalizedCommand: 'cancel',
      language: 'en'
    };
  }
  
  if (/^(r|review)/i.test(normalized)) {
    return {
      intent: 'review',
      confidence: 0.9,
      originalCommand: command,
      normalizedCommand: 'review',
      language: 'en'
    };
  }
  
  if (/^(go|proceed|continue|start|begin|lfg|let'?s\s+go|do\s+it)/i.test(normalized)) {
    return {
      intent: 'execute',
      confidence: 0.8,
      originalCommand: command,
      normalizedCommand: 'execute',
      language: 'en'
    };
  }
  
  // Default to codex
  return {
    intent: 'codex',
    confidence: 0.5,
    originalCommand: command,
    normalizedCommand: command,
    language: 'en'
  };
}

/**
 * Maps intent to task type
 */
export function intentToTaskType(intent: string): string | null {
  const mapping: Record<string, string> = {
    'approval': 'plan-approval-task',
    'plan': 'plan-task',
    'refine': 'plan-refinement-task',
    'cancel': 'plan-cancellation-task',
    'review': 'full-code-review',
    'execute': 'plan-execution-task',
    'codex': 'codex-task'
  };
  
  return mapping[intent] || null;
}