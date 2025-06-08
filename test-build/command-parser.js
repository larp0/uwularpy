"use strict";
// Utility functions for parsing commands from GitHub comments
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCommand = parseCommand;
exports.getTaskType = getTaskType;
/**
 * Parses a repository list string into an array of owner/repo objects
 * Supports formats like: "owner1/repo1,owner2/repo2" or "repo1,repo2" (using current owner)
 * @param repoString The string containing repository specifications
 * @returns Array of repository objects
 */
function parseRepositoryList(repoString) {
    var repositories = [];
    if (!repoString || typeof repoString !== 'string') {
        return repositories;
    }
    // Split by comma and clean up each repo specification
    var repoSpecs = repoString.split(',').map(function (spec) { return spec.trim(); }).filter(function (spec) { return spec.length > 0; });
    for (var _i = 0, repoSpecs_1 = repoSpecs; _i < repoSpecs_1.length; _i++) {
        var spec = repoSpecs_1[_i];
        if (spec.includes('/')) {
            // Format: owner/repo
            var _a = spec.split('/').map(function (part) { return part.trim(); }), owner = _a[0], repo = _a[1];
            if (owner && repo && isValidGitHubName(owner) && isValidGitHubName(repo)) {
                repositories.push({ owner: owner, repo: repo });
            }
        }
        else {
            // Format: repo (we'll need to use the current repository's owner)
            if (isValidGitHubName(spec)) {
                // We'll fill in the owner later from the webhook context
                repositories.push({ owner: '', repo: spec });
            }
        }
    }
    return repositories;
}
/**
 * Validates GitHub repository/owner names
 * @param name The name to validate
 * @returns true if valid GitHub name
 */
function isValidGitHubName(name) {
    // GitHub names can contain alphanumeric characters, hyphens, underscores, and dots
    // Must not start or end with hyphen, must be 1-39 characters
    // Must not contain consecutive dots
    return /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(name) &&
        name.length <= 39 &&
        name.length >= 1 &&
        !name.includes('..');
}
/**
 * Strips HTML and markdown tags from text for safety
 * @param text The text to sanitize
 * @returns Sanitized text
 */
function sanitizeText(text) {
    if (typeof text !== 'string')
        return '';
    // Remove HTML tags
    var sanitized = text.replace(/<[^>]*>/g, '');
    // Remove markdown links but keep the text
    sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove markdown formatting
    sanitized = sanitized.replace(/[*_`~]/g, '');
    // Remove potential script injection attempts
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    return sanitized.trim();
}
/**
 * Parses a GitHub comment to extract uwularpy commands
 * Enhanced with safety checks and edge case handling
 * @param comment The comment text to parse
 * @returns ParsedCommand object with extracted information
 */
function parseCommand(comment) {
    // Validate input
    if (!comment || typeof comment !== 'string') {
        return {
            command: '',
            fullText: '',
            isMention: false
        };
    }
    // Sanitize the comment to prevent potential security issues
    var sanitizedComment = sanitizeText(comment);
    // Check for length limits to prevent abuse
    if (sanitizedComment.length > 10000) {
        console.warn('Comment too long, truncating for processing');
        var truncated = sanitizedComment.slice(0, 10000);
        return parseCommand(truncated);
    }
    // Check if the comment mentions @uwularpy, @l, or self@ with various patterns
    // Handle multiple mentions by taking the first one
    // IMPORTANT: @l should only trigger when at the beginning of the message
    var mentionPatterns = [
        /^\s*@uwularpy\b/i,
        /self@/i
    ];
    // Check for @l only at the beginning (after optional whitespace)
    var atLBeginningPattern = /^\s*@l\b/i;
    var hasUwularpy = mentionPatterns.some(function (pattern) { return pattern.test(sanitizedComment); });
    var hasAtLAtBeginning = atLBeginningPattern.test(sanitizedComment);
    var isMention = hasUwularpy || hasAtLAtBeginning;
    if (!isMention) {
        return {
            command: '',
            fullText: sanitizedComment,
            isMention: false
        };
    }
    // Extract text after the mention (case-insensitive, allow for punctuation/whitespace)
    // Updated regex to handle edge cases better, including self@ prefix
    // For @l, only match if it's at the beginning of the message
    var match;
    if (hasAtLAtBeginning) {
        // For @l at beginning, extract everything after @l
        match = sanitizedComment.match(/^\s*@l\s*([\s\S]*?)(?=@\w+|$)/i);
    }
    else if (hasUwularpy) {
        // For @uwularpy or self@, use the original logic (can be anywhere)
        match = sanitizedComment.match(/@(uwularpy)\s*([\s\S]*?)(?=@\w+|$)/i) ||
            sanitizedComment.match(/self@\s*(.+?)(?=@\w+|$)/i);
    }
    var textAfterMention = '';
    if (match) {
        if (match[0].startsWith('self@')) {
            // For self@ mentions, the command is in match[1]
            textAfterMention = (match[1] || '').trim();
        }
        else if (hasAtLAtBeginning) {
            // For @l at beginning, the command is in match[1]
            textAfterMention = (match[1] || '').trim();
        }
        else {
            // For @uwularpy mentions, the command is in match[2]
            textAfterMention = (match[2] || '').trim();
        }
    }
    // Additional cleanup to handle any hidden characters or extra whitespace
    textAfterMention = textAfterMention.replace(/\s+/g, ' ').trim();
    // Handle edge case where mention is at the end with no command
    if (!textAfterMention && (/@(uwularpy)\s*$/i.test(sanitizedComment) || /self@\s*$/i.test(sanitizedComment) || /^\s*@l\s*$/i.test(sanitizedComment))) {
        return {
            command: '',
            fullText: '',
            isMention: true
        };
    }
    // Extract user query for plan commands
    var userQuery = '';
    var planCommandMatch = textAfterMention.match(/^(plan|planning|analyze)\s+(.+)$/i);
    var refineCommandMatch = textAfterMention.match(/^(refine|revise|modify|update|change|edit)\s+(.+)$/i);
    if (planCommandMatch) {
        userQuery = planCommandMatch[2].trim();
    }
    else if (refineCommandMatch) {
        userQuery = refineCommandMatch[2].trim();
    }
    // Check if this is a "@l dev " command specifically
    var isDevCommand = textAfterMention.toLowerCase().startsWith('dev ');
    // Check if this is a multi-repository command
    var isMultiRepoCommand = textAfterMention.toLowerCase().startsWith('multi-plan ') ||
        textAfterMention.toLowerCase().startsWith('multi-repo ') ||
        textAfterMention.toLowerCase().startsWith('aggregate ');
    // Parse repositories for multi-repo commands
    var repositories = [];
    if (isMultiRepoCommand) {
        var repoMatch = textAfterMention.match(/^(?:multi-plan|multi-repo|aggregate)\s+(.+)$/i);
        if (repoMatch) {
            var repoString = repoMatch[1].trim();
            repositories = parseRepositoryList(repoString);
        }
    }
    return {
        command: textAfterMention.trim().toLowerCase(),
        fullText: textAfterMention,
        isMention: true,
        userQuery: userQuery,
        isDevCommand: isDevCommand,
        isMultiRepoCommand: isMultiRepoCommand,
        repositories: repositories
    };
}
/**
 * Determines the task type based on the parsed command
 * Now uses AI to understand intent, typos, and multiple languages
 * @param parsedCommand The parsed command object
 * @param context Optional context for better AI classification
 * @returns The task type to trigger
 */
function getTaskType(parsedCommand) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedCommand, directApprovalPatterns;
        return __generator(this, function (_a) {
            if (!parsedCommand || !parsedCommand.isMention) {
                return [2 /*return*/, null];
            }
            // If no command text, analyze the thread and provide general response
            if (!parsedCommand.command) {
                return [2 /*return*/, 'general-response-task'];
            }
            normalizedCommand = parsedCommand.command.toLowerCase().trim();
            directApprovalPatterns = ['approve', 'yes', 'y', 'ok', 'okay', 'lgtm'];
            if (directApprovalPatterns.includes(normalizedCommand)) {
                console.log('[getTaskType] Direct match for approval command:', normalizedCommand);
                return [2 /*return*/, 'plan-approval-task'];
            }
            if (normalizedCommand === 'plan' || normalizedCommand === 'planning' || normalizedCommand === 'analyze' ||
                normalizedCommand.startsWith('plan ') || normalizedCommand.startsWith('planning ') || normalizedCommand.startsWith('analyze ')) {
                console.log('[getTaskType] Direct match for plan command:', normalizedCommand);
                return [2 /*return*/, 'plan-task'];
            }
            // Check for multi-repository planning commands
            if (parsedCommand.isMultiRepoCommand ||
                normalizedCommand.startsWith('multi-plan') ||
                normalizedCommand.startsWith('multi-repo') ||
                normalizedCommand.startsWith('aggregate')) {
                console.log('[getTaskType] Direct match for multi-repo plan command:', normalizedCommand);
                return [2 /*return*/, 'multi-plan-task'];
            }
            if (normalizedCommand === 'review' || normalizedCommand === 'r') {
                console.log('[getTaskType] Direct match for review command:', normalizedCommand);
                return [2 /*return*/, 'full-code-review'];
            }
            // Before checking dev commands, let's check for multi-word approval commands
            // using the comprehensive isApprovalCommand function
            if (isApprovalCommand(normalizedCommand)) {
                console.log('[getTaskType] Multi-word approval command detected:', normalizedCommand);
                return [2 /*return*/, 'plan-approval-task'];
            }
            // IMPORTANT: Only "@l dev " commands should trigger codex-task
            if (parsedCommand.isDevCommand) {
                console.log('[getTaskType] Detected dev command, routing to codex-task:', normalizedCommand);
                return [2 /*return*/, 'codex-task'];
            }
            // For other @l commands, we analyze the thread and provide contextual responses
            // This fetches all messages from the thread and generates appropriate responses
            console.log('[getTaskType] Non-dev @l command detected, routing to general response:', normalizedCommand);
            return [2 /*return*/, 'general-response-task'];
        });
    });
}
/**
 * Checks if a command is an approval command for milestone decomposition
 * @param command The normalized command to check
 * @returns true if the command is an approval
 */
function isApprovalCommand(command) {
    var approvalPatterns = [
        'y',
        'yes',
        'ok',
        'okay',
        'approve',
        'i approve',
        'lgtm',
        'ship it',
        'looks good',
        'go ahead'
    ];
    // Debug logging
    console.log('[isApprovalCommand] Checking command:', command);
    // Simple direct match first
    if (approvalPatterns.includes(command)) {
        console.log('[isApprovalCommand] Direct match found');
        return true;
    }
    // Check if command starts with any approval pattern
    var startsWithApproval = approvalPatterns.some(function (pattern) {
        return command === pattern || command.startsWith(pattern + ' ');
    });
    if (startsWithApproval) {
        console.log('[isApprovalCommand] Starts with approval pattern');
        return true;
    }
    // Check for common variations
    if (/^(ship\s+it|looks\s+good|go\s+ahead)/i.test(command)) {
        console.log('[isApprovalCommand] Matches common variation');
        return true;
    }
    console.log('[isApprovalCommand] No approval pattern matched');
    return false;
}
/**
 * Checks if a command is a refinement command for milestone modification
 * @param command The normalized command to check
 * @returns true if the command is a refinement request
 */
function isRefinementCommand(command) {
    var refinementPatterns = [
        'refine',
        'revise',
        'modify',
        'update',
        'change',
        'edit'
    ];
    return refinementPatterns.includes(command);
}
/**
 * Checks if a command is a cancellation command for milestone rejection
 * @param command The normalized command to check
 * @returns true if the command is a cancellation request
 */
function isCancellationCommand(command) {
    var cancellationPatterns = [
        'cancel',
        'reject',
        'no',
        'n',
        'abort',
        'stop'
    ];
    return cancellationPatterns.includes(command);
}
/**
 * Checks if a command is an execution confirmation command
 * @param command The normalized command to check
 * @returns true if the command is an execution confirmation
 */
function isExecutionConfirmationCommand(command) {
    var confirmationPatterns = [
        'go',
        'proceed',
        'continue',
        'start',
        'begin',
        'lfg',
        'let\'s go',
        'do it'
    ];
    return confirmationPatterns.includes(command);
}
