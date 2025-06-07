# @l plan Troubleshooting Flowchart Guide

This document provides visual troubleshooting flowcharts to help diagnose and resolve common issues with the `@l plan` feature.

## Diagram Legend

```mermaid
flowchart LR
    subgraph Legend["🎨 Color Code Legend"]
        A[🔵 Start/Entry Points]
        B[🟠 Decision Points]
        C[🟢 Fix Actions]
        D[🟣 Configuration Tasks]
        E[🔴 Error States]
        F[🟡 Warning/Fallback]
    end
    
    classDef startNode fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef checkNode fill:#fff8e1,stroke:#f57c00,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef configNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef errorNode fill:#ffebee,stroke:#f44336,stroke-width:2px,color:#000
    classDef warningNode fill:#fff8e1,stroke:#ffc107,stroke-width:2px,color:#000
    
    class A startNode
    class B checkNode
    class C fixNode
    class D configNode
    class E errorNode
    class F warningNode
```

## Main Troubleshooting Flowchart

```mermaid
flowchart TD
    Start([🔍 Issue with @l plan?]) --> Check1{🤖 Bot responds?}
    
    Check1 -->|No| NoResponse[❌ No Response Issues]
    Check1 -->|Yes| Check2{⚠️ Error message?}
    
    Check2 -->|Rate Limit| RateLimit[🕐 Rate Limit Issues]
    Check2 -->|Milestone Error| Milestone[📌 Milestone Issues]
    Check2 -->|API Error| APIError[🔌 API Issues]
    Check2 -->|Other Error| Check3{📍 Which phase?}
    Check2 -->|No Error| Check4{✅ Expected result?}
    
    Check3 -->|Plan Creation| PlanIssues[📋 Plan Creation Issues]
    Check3 -->|Approval| ApprovalIssues[👍 Approval Issues]
    Check3 -->|Issue Creation| IssueIssues[🎫 Issue Creation Problems]
    
    Check4 -->|No| UnexpectedBehavior[🤔 Unexpected Behavior]
    Check4 -->|Yes| Success([🎉 Working Correctly!])
    
    NoResponse --> NoResponseFlow
    RateLimit --> RateLimitFlow
    Milestone --> MilestoneFlow
    APIError --> APIFlow
    PlanIssues --> PlanFlow
    ApprovalIssues --> ApprovalFlow
    IssueIssues --> IssueFlow
    UnexpectedBehavior --> BehaviorFlow
    
    %% Color coding for better visual hierarchy
    classDef startNode fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000
    classDef errorNode fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    classDef successNode fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef decisionNode fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef processNode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    
    class Start startNode
    class Success successNode
    class NoResponse,RateLimit,Milestone,APIError,PlanIssues,ApprovalIssues,IssueIssues,UnexpectedBehavior errorNode
    class Check1,Check2,Check3,Check4 decisionNode
```

## 1. No Response Issues

```mermaid
flowchart TD
    NoResponseFlow([🤖 Bot Not Responding]) --> NR1{📝 Command format correct?}
    
    NR1 -->|❌ No| NR1Fix[✅ Use: @l plan or @l plan &lt;query&gt;]
    NR1 -->|✅ Yes| NR2{📢 Bot mentioned correctly?}
    
    NR2 -->|❌ No| NR2Fix[✅ Use @l with space after]
    NR2 -->|✅ Yes| NR3{📱 GitHub App installed?}
    
    NR3 -->|❌ No| NR3Fix[⚙️ Install GitHub App on repository]
    NR3 -->|✅ Yes| NR4{🔗 Webhook configured?}
    
    NR4 -->|❌ No| NR4Fix[🔧 Configure webhook URL in GitHub App settings]
    NR4 -->|✅ Yes| NR5{🚀 Service running?}
    
    NR5 -->|❌ No| NR5Fix[🔍 Check Trigger.dev deployment status]
    NR5 -->|✅ Yes| NR6{📊 Check logs}
    
    NR6 --> NR6Fix[📋 Review application logs for errors]
    
    %% Color coding for visual clarity
    classDef startNode fill:#e3f2fd,stroke:#1976d2,stroke-width:3px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#388e3c,stroke-width:2px,color:#000
    classDef checkNode fill:#fff8e1,stroke:#f57c00,stroke-width:2px,color:#000
    classDef configNode fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000
    
    class NoResponseFlow startNode
    class NR1Fix,NR2Fix,NR6Fix fixNode
    class NR3Fix,NR4Fix,NR5Fix configNode
    class NR1,NR2,NR3,NR4,NR5,NR6 checkNode
```

### Quick Fixes:
- ✅ Correct format: `@l plan` or `@l plan add authentication`
- ✅ Ensure space after `@l`
- ✅ Verify GitHub App is installed on the repository
- ✅ Check webhook delivery in GitHub settings

## 2. Rate Limit Issues

```mermaid
flowchart TD
    RateLimitFlow([🕐 Rate Limit Error]) --> RL1{⚡ Which rate limit?}
    
    RL1 -->|Plan Creation| RL2[📊 5 plans/minute/repo limit]
    RL1 -->|GitHub API| RL3[🐙 GitHub API rate limit]
    RL1 -->|OpenAI API| RL4[🤖 OpenAI rate limit]
    
    RL2 --> RL2Fix[⏱️ Wait 60 seconds and retry]
    RL3 --> RL3Check{🔍 Check remaining}
    RL4 --> RL4Fix[📈 Check OpenAI usage dashboard]
    
    RL3Check -->|How?| RL3How[💻 curl -H 'Authorization: token YOUR_TOKEN'<br/>https://api.github.com/rate_limit]
    RL3Check -->|Exhausted| RL3Fix[⏳ Wait for reset or use different token]
    RL3Check -->|Available| RL3Debug[🔧 Check retry logic in logs]
    
    %% Enhanced styling with better visual hierarchy
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef limitNode fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef techNode fill:#e0f2f1,stroke:#009688,stroke-width:2px,color:#000
    
    class RateLimitFlow startNode
    class RL2,RL3,RL4 limitNode
    class RL2Fix,RL3Fix,RL4Fix fixNode
    class RL3Check checkNode
    class RL3How,RL3Debug techNode
```

### Solutions:
```typescript
// Temporary override for testing
const config = {
  maxIssues: 5,           // Reduce from 20
  retryDelay: 3000,       // Increase from 1000
  batchSize: 1            // Reduce from 3
};

// Check rate limit status
const checkRateLimit = async (octokit) => {
  const { data } = await octokit.rateLimit.get();
  console.log('Remaining:', data.rate.remaining);
  console.log('Reset at:', new Date(data.rate.reset * 1000));
};
```

## 3. Milestone Creation Issues

```mermaid
flowchart TD
    MilestoneFlow([📌 Milestone Issues]) --> M1{🚨 Error type?}
    
    M1 -->|Already exists| M2[🔄 Duplicate milestone name]
    M1 -->|Validation failed| M3[❌ Invalid milestone data]
    M1 -->|Permission denied| M4[🔒 Insufficient permissions]
    M1 -->|Not found| M5[🔍 Repository access issue]
    
    M2 --> M2Fix[⚡ System now uses unique timestamps<br/>📥 Update to latest version]
    M3 --> M3Check{🔍 Check milestone data}
    M4 --> M4Fix[🔐 Grant 'Issues' write permission to GitHub App]
    M5 --> M5Fix[✅ Verify repository name and owner]
    
    M3Check -->|Title too long| M3Fix1[📏 Titles limited to 255 chars]
    M3Check -->|Invalid date| M3Fix2[📅 Check date format]
    M3Check -->|Empty description| M3Fix3[🔧 Check AI response parsing]
    
    %% Enhanced color scheme for better categorization
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef errorNode fill:#ffebee,stroke:#f44336,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#fff8e1,stroke:#ff9800,stroke-width:2px,color:#000
    classDef configNode fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px,color:#000
    
    class MilestoneFlow startNode
    class M2,M3,M4,M5 errorNode
    class M2Fix,M4Fix,M5Fix,M3Fix1,M3Fix2,M3Fix3 fixNode
    class M3Check checkNode
```

### Debug Commands:
```bash
# List existing milestones
gh api /repos/OWNER/REPO/milestones --jq '.[].title'

# Check permissions
gh api /repos/OWNER/REPO/collaborators/APP_USERNAME/permission

# Manual milestone creation test
gh api /repos/OWNER/REPO/milestones \
  --method POST \
  --field title="Test Milestone $(date +%s)" \
  --field description="Test"
```

## 4. API Error Issues

```mermaid
flowchart TD
    APIFlow([🔌 API Errors]) --> API1{🤔 Which API?}
    
    API1 -->|GitHub| GH1{📊 Status code?}
    API1 -->|OpenAI| OAI1{⚠️ Error type?}
    
    GH1 -->|401| GH401[🔐 Authentication failed]
    GH1 -->|403| GH403[🚫 Forbidden/Rate limit]
    GH1 -->|404| GH404[🔍 Resource not found]
    GH1 -->|422| GH422[📝 Validation error]
    GH1 -->|500+| GH500[🔧 GitHub server error]
    
    OAI1 -->|401| OAI401[🔑 Invalid API key]
    OAI1 -->|429| OAI429[⏱️ Rate limit exceeded]
    OAI1 -->|500+| OAI500[🤖 OpenAI server error]
    OAI1 -->|Timeout| OAITimeout[⏰ Request timeout]
    
    GH401 --> GH401Fix[✅ Check GITHUB_APP_ID and GITHUB_PRIVATE_KEY]
    GH403 --> GH403Fix[🔍 Check permissions and rate limits]
    GH404 --> GH404Fix[✅ Verify repository exists and accessible]
    GH422 --> GH422Fix[📋 Check request payload in logs]
    GH500 --> GH500Fix[🔄 Retry with exponential backoff]
    
    OAI401 --> OAI401Fix[🔧 Verify OPENAI_API_KEY environment variable]
    OAI429 --> OAI429Fix[📊 Check OpenAI usage limits]
    OAI500 --> OAI500Fix[⚠️ Fallback analysis will be used]
    OAITimeout --> OAITimeoutFix[⚙️ Increase OPENAI_TIMEOUT_MS]
    
    %% Enhanced styling for API error categorization
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef apiNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef githubError fill:#ffebee,stroke:#f44336,stroke-width:2px,color:#000
    classDef openaiError fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef warningNode fill:#fff8e1,stroke:#ffc107,stroke-width:2px,color:#000
    
    class APIFlow startNode
    class API1 apiNode
    class GH1 apiNode
    class OAI1 apiNode
    class GH401,GH403,GH404,GH422,GH500 githubError
    class OAI401,OAI429,OAI500,OAITimeout openaiError
    class GH401Fix,GH403Fix,GH404Fix,GH422Fix,GH500Fix,OAI401Fix,OAI429Fix,OAITimeoutFix fixNode
    class OAI500Fix warningNode
```

### Environment Check:
```bash
# Verify environment variables
echo "GitHub App ID: ${GITHUB_APP_ID:+SET}"
echo "GitHub Private Key: ${GITHUB_PRIVATE_KEY:+SET}"
echo "OpenAI API Key: ${OPENAI_API_KEY:+SET}"

# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  --fail --silent --show-error
```

## 5. Plan Creation Issues

```mermaid
flowchart TD
    PlanFlow([📋 Plan Creation Problems]) --> P1{🚨 Issue type?}
    
    P1 -->|No analysis| P2[🤖 AI analysis failed]
    P1 -->|Incomplete plan| P3[📄 Partial analysis]
    P1 -->|Wrong focus| P4[🎯 Query not processed]
    P1 -->|Too slow| P5[⏱️ Performance issue]
    
    P2 --> P2Check{📊 Check logs}
    P3 --> P3Fix[✂️ Check content truncation]
    P4 --> P4Fix[🔍 Verify user query extraction]
    P5 --> P5Check{📁 Repository size?}
    
    P2Check -->|OpenAI error| P2Fix1[⚠️ Using fallback analysis]
    P2Check -->|Parse error| P2Fix2[🔧 Check JSON parsing]
    
    P3Fix --> P3Solution[📏 Reduce MAX_CONTENT_LENGTH]
    P4Fix --> P4Solution[⚙️ Check command parser logic]
    
    P5Check -->|Large| P5Fix1[📉 Reduce MAX_REPO_ANALYSIS_FILES]
    P5Check -->|Normal| P5Fix2[📊 Check API response times]
    
    %% Enhanced styling for plan creation issues
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef issueNode fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef warningNode fill:#fff8e1,stroke:#ffc107,stroke-width:2px,color:#000
    classDef configNode fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px,color:#000
    
    class PlanFlow startNode
    class P2,P3,P4,P5 issueNode
    class P3Solution,P4Solution,P5Fix1,P5Fix2 fixNode
    class P2Check,P5Check checkNode
    class P2Fix1 warningNode
    class P3Fix,P4Fix,P2Fix2 configNode
```

### Debugging Code:
```typescript
// Add debug logging
logger.info("User query extracted", { 
  userQuery: userQuery || 'none',
  originalMessage: payload.message 
});

// Test query extraction
const testQueries = [
  "@l plan add authentication",
  "@l planning implement API",
  "@l analyze improve performance"
];

testQueries.forEach(query => {
  const parsed = parseCommand(query);
  console.log(`Query: ${query}`);
  console.log(`Extracted: ${parsed.userQuery}`);
});
```

## 6. Approval Phase Issues

```mermaid
flowchart TD
    ApprovalFlow([👍 Approval Problems]) --> A1{🔍 Issue type?}
    
    A1 -->|No milestone found| A2[🔍 Cannot find milestone]
    A1 -->|Parse error| A3[📋 Cannot parse milestone]
    A1 -->|Enhancement failed| A4[🤖 GPT enhancement error]
    A1 -->|Creation failed| A5[🎫 Issue creation error]
    
    A2 --> A2Check{📌 Milestone exists?}
    A3 --> A3Fix[🔧 Check milestone format]
    A4 --> A4Fix[⚙️ Using basic descriptions]
    A5 --> A5Check{📍 Which phase?}
    
    A2Check -->|❌ No| A2Fix1[🚀 Run @l plan first]
    A2Check -->|✅ Yes| A2Fix2[📝 Check bot comment history]
    
    A5Check -->|Creation| A5Fix1[🔒 Check GitHub permissions]
    A5Check -->|Attachment| A5Fix2[🔄 Retry attachment logic]
    
    %% Improved visual design with role-based colors
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef issueNode fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    classDef fixActionNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef warningNode fill:#fff8e1,stroke:#ffc107,stroke-width:2px,color:#000
    classDef configNode fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px,color:#000
    
    class ApprovalFlow startNode
    class A2,A3,A4,A5 issueNode
    class A2Fix1,A2Fix2,A5Fix1,A5Fix2 fixActionNode
    class A2Check,A5Check checkNode
    class A4Fix warningNode
    class A3Fix configNode
```

### Manual Verification:
```typescript
// Find milestone manually
const findMilestone = async (octokit, owner, repo) => {
  const { data: milestones } = await octokit.issues.listMilestones({
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'desc',
    per_page: 5
  });
  
  return milestones.find(m => 
    m.title.includes('AI Development Plan')
  );
};
```

## 7. Issue Creation Problems

```mermaid
flowchart TD
    IssueFlow([🎫 Issue Problems]) --> I1{❓ Problem type?}
    
    I1 -->|Not created| I2[❌ Issue creation failed]
    I1 -->|Not attached| I3[🔗 Milestone attachment failed]
    I1 -->|Wrong labels| I4[🏷️ Label application failed]
    I1 -->|Too many/few| I5[📊 Issue count problem]
    
    I2 --> I2Check{📋 Error in logs?}
    I3 --> I3Fix[🔄 Automatic retry attempted]
    I4 --> I4Fix[✅ Verify labels exist]
    I5 --> I5Check{📈 How many created?}
    
    I2Check -->|Validation| I2Fix1[📏 Check title length < 256]
    I2Check -->|Permissions| I2Fix2[🔒 Need Issues write permission]
    I2Check -->|Rate limit| I2Fix3[⏱️ Batch processing active]
    
    I3Fix --> I3Result{🔍 Still failed?}
    I3Result -->|Yes| I3Manual[🛠️ Manual fix needed]
    I3Result -->|No| I3Success[✅ Retry succeeded]
    
    I5Check -->|0| I5Fix1[📊 Check error logs]
    I5Check -->|> limit| I5Fix2[⚙️ Adjust PLAN_MAX_ISSUES]
    
    %% Enhanced styling for issue creation problems
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef problemNode fill:#ffebee,stroke:#f44336,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef configNode fill:#fff3e0,stroke:#ff9800,stroke-width:2px,color:#000
    classDef successNode fill:#e0f2f1,stroke:#009688,stroke-width:2px,color:#000
    classDef manualNode fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#000
    
    class IssueFlow startNode
    class I2,I3,I4,I5 problemNode
    class I2Fix1,I2Fix2,I2Fix3,I5Fix1,I5Fix2 fixNode
    class I2Check,I5Check,I3Result checkNode
    class I3Fix,I4Fix configNode
    class I3Success successNode
    class I3Manual manualNode
```

### Manual Fix for Attachments:
```typescript
// Fix milestone attachments manually
const fixAttachments = async (octokit, owner, repo, issueNumbers, milestoneNumber) => {
  for (const issueNumber of issueNumbers) {
    try {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        milestone: milestoneNumber
      });
      console.log(`✅ Fixed issue #${issueNumber}`);
    } catch (error) {
      console.error(`❌ Failed to fix #${issueNumber}:`, error.message);
    }
  }
};
```

## 8. Unexpected Behavior

```mermaid
flowchart TD
    BehaviorFlow([🤔 Unexpected Behavior]) --> B1{What's unexpected?}
    
    B1 -->|Wrong analysis| B2[📊 Analysis quality issue]
    B1 -->|Missing features| B3[🔍 Feature detection issue] 
    B1 -->|Bad estimates| B4[⏱️ Estimation accuracy]
    B1 -->|Poor prioritization| B5[📊 Priority assignment]
    
    B2 --> B2Check{Repository type?}
    B3 --> B3Fix[🔧 Check file analysis depth]
    B4 --> B4Fix[📏 Review T-shirt sizing]
    B5 --> B5Fix[🎯 Check MoSCoW logic]
    
    B2Check -->|Non-standard| B2Fix1[💬 Add context in query]
    B2Check -->|Large| B2Fix2[📈 Increase analysis limits]
    
    %% Professional color scheme for behavioral analysis
    classDef startNode fill:#e8eaf6,stroke:#3f51b5,stroke-width:3px,color:#000
    classDef behaviorNode fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px,color:#000
    classDef fixNode fill:#e8f5e8,stroke:#4caf50,stroke-width:2px,color:#000
    classDef checkNode fill:#fff8e1,stroke:#ff9800,stroke-width:2px,color:#000
    classDef improveNode fill:#e0f2f1,stroke:#009688,stroke-width:2px,color:#000
    
    class BehaviorFlow startNode
    class B2,B3,B4,B5 behaviorNode
    class B3Fix,B4Fix,B5Fix,B2Fix1,B2Fix2 fixNode
    class B2Check checkNode
```

### Improvement Strategies:
```bash
# Provide more context
@l plan add authentication for React SPA with JWT tokens

# Focus on specific areas
@l plan analyze backend API performance issues

# Request specific prioritization
@l plan focus on security vulnerabilities and critical bugs
```

## Quick Reference Card

### Common Error Messages and Solutions

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| "Rate limit exceeded" | Too many requests | Wait 60 seconds |
| "No recent milestone found" | Haven't run `@l plan` | Run `@l plan` first |
| "already_exists" | Duplicate milestone | Update to latest version |
| "Bad credentials" | Invalid GitHub auth | Check APP_ID and PRIVATE_KEY |
| "Invalid API key" | OpenAI key issue | Verify OPENAI_API_KEY |
| "Timeout" | Slow API response | Increase timeout settings |
| "Validation failed" | Invalid data format | Check logs for details |

### Health Check Commands

```bash
# 1. Check bot is responding
echo "Test comment" | gh issue comment ISSUE_NUMBER --body-file -

# 2. Verify webhook delivery
# Go to: Settings > GitHub Apps > Your App > Advanced > Recent Deliveries

# 3. Check service logs
trigger.dev logs --task plan-task --limit 50

# 4. Test API connections
# GitHub
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit

# OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 5. Verify environment
env | grep -E "(GITHUB|OPENAI|PLAN_)" | sed 's/=.*/=***/'
```

### Emergency Fixes

```typescript
// Force fallback analysis (bypass OpenAI)
process.env.FORCE_FALLBACK_ANALYSIS = 'true';

// Reduce load for testing
process.env.PLAN_MAX_ISSUES = '5';
process.env.MAX_REPO_ANALYSIS_FILES = '100';

// Increase timeouts
process.env.OPENAI_TIMEOUT_MS = '180000'; // 3 minutes
process.env.RETRY_DELAY_MS = '5000'; // 5 seconds

// Disable enhancement (basic issues only)
process.env.SKIP_ISSUE_ENHANCEMENT = 'true';
```

## Escalation Path

If none of the above solutions work:

1. **Enable Debug Logging**
   ```typescript
   process.env.LOG_LEVEL = 'debug';
   ```

2. **Check Complete Logs**
   - Application logs
   - GitHub webhook logs
   - Trigger.dev execution logs

3. **Test Minimal Configuration**
   - Reduce all limits to minimum
   - Test with simple commands
   - Verify basic connectivity

4. **File an Issue**
   Include:
   - Exact command used
   - Error messages
   - Repository size/type
   - Recent logs
   - Environment configuration (redacted)

## Prevention Best Practices

1. **Monitor Rate Limits**
   - Set up alerts for approaching limits
   - Implement usage tracking
   - Plan for peak usage

2. **Regular Health Checks**
   - Weekly API connectivity tests
   - Monthly performance reviews
   - Quarterly configuration audits

3. **Graceful Degradation**
   - Fallback analysis ready
   - Reduced functionality modes
   - Clear error messaging

4. **Documentation**
   - Keep runbooks updated
   - Document custom configurations
   - Maintain troubleshooting log

---

*Last Updated: [Current Date]*
*Version: 1.0*