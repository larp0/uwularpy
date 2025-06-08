# Multi-Repository Aggregated Planning and Reporting

## Overview

The multi-repository feature enables users to generate consolidated development plans across multiple repositories, providing teams with aggregated visibility for large projects, monorepos, or distributed microservice architectures.

## Features

### 🌐 Cross-Repository Analysis
- Analyze multiple repositories simultaneously with proper concurrency and rate limiting
- Generate aggregated insights across all specified repositories
- Identify cross-repository opportunities for consolidation and integration

### 🔗 Smart Repository Parsing
- Support multiple repository specification formats
- Automatic validation of GitHub repository names
- Graceful handling of mixed owner/repo formats

### 📊 Consolidated Reporting
- Aggregated critical fixes, missing components, and improvements
- Cross-repository opportunity identification
- Consolidated priority recommendations
- Individual repository breakdowns within unified milestone

### ⚡ Performance & Reliability
- Concurrent repository processing with configurable limits
- Automatic rate limiting and retry mechanisms
- Graceful degradation when repositories are inaccessible
- Timeout protection for individual repository analysis

## Usage

### Basic Multi-Repository Planning

```bash
# Analyze multiple repositories in the same organization
@l multi-plan repo1,repo2,repo3

# Analyze repositories across different organizations
@l multi-plan facebook/react,microsoft/typescript,vercel/next.js

# Mixed format: some with explicit owners, some using current owner
@l multi-plan my-frontend,external-org/shared-lib,my-backend
```

### Alternative Command Formats

```bash
# Using 'multi-repo' command
@l multi-repo frontend,backend,docs

# Using 'aggregate' command  
@l aggregate service-a,service-b,service-c

# Via @uwularpy mention
@uwularpy multi-plan repo1,repo2
```

## Command Parsing

The system supports flexible repository specifications:

### Supported Formats

1. **Repository names only**: `repo1,repo2,repo3`
   - Uses the current repository's owner for all repositories
   
2. **Owner/repository format**: `owner1/repo1,owner2/repo2`
   - Explicit owner specification for each repository
   
3. **Mixed format**: `repo1,owner2/repo2,repo3`
   - Combines both formats as needed

### Repository Validation

- Repository names must be valid GitHub identifiers
- 1-39 characters in length
- Alphanumeric characters, hyphens, underscores, and dots allowed
- Cannot start or end with hyphens
- Cannot contain consecutive dots (`..`)

### Examples

```bash
# ✅ Valid repository specifications
@l multi-plan my-app,my-docs,my-api
@l multi-plan facebook/react,microsoft/typescript
@l multi-plan frontend,backend-org/auth-service,mobile

# ❌ Invalid repository names (will be filtered out)
@l multi-plan valid-repo,invalid..repo,toolong-repository-name-exceeding-github-limits
# → Only 'valid-repo' will be processed
```

## Workflow

### 1. Command Recognition
- Parse multi-repository command with repository specifications
- Validate repository names and fill in missing owners
- Route to `multi-plan-task` for processing

### 2. Multi-Repository Ingestion
- Process repositories in batches (max 5 concurrent)
- Apply rate limiting and timeout protection
- Handle authentication across different organizations
- Graceful error handling for inaccessible repositories

### 3. Individual Repository Analysis
- Perform comprehensive analysis on each accessible repository
- Use existing single-repository analysis pipeline
- Generate detailed insights for each repository

### 4. Aggregated Analysis
- Combine findings from all repositories
- Generate cross-repository insights using AI
- Identify shared components and integration opportunities
- Create consolidated priority recommendations

### 5. Milestone Creation
- Create comprehensive multi-repository milestone
- Include individual repository breakdowns
- Highlight cross-repository opportunities
- Provide actionable consolidated priorities

## Technical Implementation

### Core Components

#### Multi-Plan Task (`multi-plan-task`)
- **Duration**: 30 minutes (extended for multiple repositories)
- **Machine**: large-2x (increased resources for concurrent processing)
- **Implementation**: `/src/trigger/multi-plan-implementation.ts`

#### Command Parser Extensions
- **File**: `/src/lib/command-parser.ts`
- **New Properties**: `isMultiRepoCommand`, `repositories[]`
- **Validation**: GitHub repository name validation

#### Context Extensions
- **File**: `/src/services/task-types.ts`
- **New Properties**: `isMultiRepo`, `repositories[]`
- **Backward Compatibility**: All existing single-repo functionality preserved

### Configuration

```typescript
// Multi-repository processing limits
const MAX_CONCURRENT_REPOS = 5;     // Concurrent repository processing
const REPO_TIMEOUT_MS = 300000;     // 5 minutes per repository
const MAX_CONTENT_LENGTH = 8000;    // Content limit per repository
const RETRY_ATTEMPTS = 3;           // Retry failed operations
const RETRY_DELAY_MS = 1000;        // Base delay for retries
```

### Rate Limiting

- **Multi-Plan Creation**: Max 2 per minute per repository
- **Repository Processing**: Batched with delays between batches
- **API Calls**: Exponential backoff with retry mechanisms

## Error Handling

### Graceful Degradation
- Continues processing when some repositories are inaccessible
- Provides detailed error reporting for failed repositories
- Includes partial results in final milestone

### Common Error Scenarios

1. **Repository Not Found**: Marked as inaccessible, continues with others
2. **Permission Denied**: Reported in milestone, analysis continues
3. **Rate Limit Exceeded**: Automatic retry with exponential backoff
4. **Timeout**: Individual repository timeout protection
5. **Network Issues**: Retry mechanisms with progressive delays

## Output Format

### Multi-Repository Milestone

The generated milestone includes:

```markdown
# 🌐 Multi-Repository Development Plan

## 📊 Repository Overview
- Analyzed Repositories: ✅ org1/repo1, ✅ org2/repo2, ✅ org3/repo3
- Inaccessible Repositories: ❌ private-org/restricted-repo

## 🔗 Cross-Repository Opportunities
- Shared component library consolidation opportunities
- Common authentication service implementation
- Unified CI/CD pipeline standardization

## 📋 Consolidated Priorities
- Address 15 critical security issues across repositories
- Implement 23 missing components for feature completeness
- Establish cross-repository development standards

## 🚨 Critical Fixes (aggregated across all repos)
- [org1/repo1] Security vulnerability in authentication module
- [org2/repo2] Performance bottleneck in data processing pipeline
- [org3/repo3] Memory leak in background task processor

## 📦 Missing Components (aggregated across all repos)
- [org1/repo1] Comprehensive error handling middleware
- [org2/repo2] API rate limiting implementation
- [org3/repo3] Health check endpoint configuration

...
```

### Next Steps Integration

After milestone creation, users can:

1. **Approve Plan**: `@l approve` - Creates detailed issues for implementation
2. **Refine Plan**: `@l refine [feedback]` - Modifies plan based on requirements  
3. **Cancel Plan**: `@l cancel` - Rejects the proposed plan

## Benefits

### For Development Teams
- **Unified Visibility**: Single view across multiple repositories
- **Efficiency**: Batch analysis reduces manual effort
- **Consistency**: Standardized approach across all repositories
- **Prioritization**: Clear cross-repository priority guidance

### For Project Management
- **Resource Planning**: Understand effort across entire project ecosystem
- **Risk Assessment**: Identify critical issues spanning multiple repositories
- **Coordination**: Plan cross-repository dependencies and integrations
- **Reporting**: Consolidated status and progress tracking

### For Architecture Teams
- **Pattern Recognition**: Identify common issues and opportunities
- **Consolidation**: Spot shared component and service opportunities
- **Standardization**: Drive consistency across repository ecosystem
- **Innovation**: Cross-pollinate ideas between different repositories

## Best Practices

### Repository Selection
- Group related repositories for maximum insight value
- Include core dependencies and shared libraries
- Consider organizational boundaries and access permissions
- Limit to manageable number (recommend 3-10 repositories)

### Command Usage
- Use explicit owner/repo format for cross-organizational analysis
- Verify repository access before initiating analysis
- Consider repository size and complexity for planning purposes
- Use descriptive repository names for better milestone clarity

### Follow-up Actions
- Review generated milestone before approval
- Coordinate with repository owners for implementation
- Consider cross-repository dependencies in execution order
- Track progress across all repositories consistently

## Limitations

### Current Constraints
- Maximum 5 concurrent repository processing
- 30-minute total analysis time limit
- Requires appropriate GitHub access permissions
- Limited to publicly accessible or authorized repositories

### Future Enhancements
- Organization-wide repository discovery
- Dependency graph analysis across repositories  
- Automated cross-repository issue creation
- Integration with project management tools
- Enhanced cross-repository metrics and reporting

## Troubleshooting

### Common Issues

**"No repositories were accessible for analysis"**
- Verify repository names and owners are correct
- Check GitHub access permissions for all repositories
- Ensure repositories exist and are not private/restricted

**"Rate limit exceeded for multi-plan creation"**
- Wait 1 minute between multi-repository plan requests
- Consider breaking large repository sets into smaller groups

**"Repository analysis timed out"**
- Large repositories may exceed individual timeout limits
- Consider analyzing smaller subsets of repositories
- Check repository size and complexity

**"Invalid repository name"**
- Ensure repository names follow GitHub naming conventions
- Remove invalid characters or excessively long names
- Verify repository exists and is spelled correctly

## Example Workflows

### Microservices Architecture
```bash
# Analyze entire microservices ecosystem
@l multi-plan auth-service,user-service,payment-service,notification-service

# Cross-organizational services
@l multi-plan myorg/frontend,partner-org/shared-lib,myorg/backend
```

### Monorepo Components
```bash
# Analyze related packages within organization
@l multi-plan web-app,mobile-app,shared-components,design-system
```

### Full-Stack Application
```bash
# Complete application stack analysis
@l multi-plan frontend,backend,database-migrations,infrastructure
```

This multi-repository feature significantly enhances uwularpy's capabilities for teams managing complex, distributed software projects by providing the aggregated visibility and planning capabilities needed for effective coordination and development.