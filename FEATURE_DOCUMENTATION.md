# Self-Message Protection and Mermaid Diagram Detection Features

## Self-Message Protection with "self@" Prefix

### Overview
The bot now has protection against triggering itself from its own messages. By default, the bot ignores all messages from the user "uwularpy". However, you can force the bot to process its own messages by using the "self@" prefix.

### Usage
- **Normal bot message**: `@l plan` (from uwularpy user) → Ignored
- **Self-triggered message**: `self@ plan` (from uwularpy user) → Processed
- **User message**: `@l plan` (from any other user) → Processed normally

### Use Cases
This is useful for:
- Testing bot functionality 
- Manual intervention scenarios
- Debug and development workflows

## Enhanced Mermaid Diagram Detection

### Overview  
The approval process now actively searches for and references mermaid diagrams found in the thread. When you run `@l approve`, the system will:

1. Search all comments in the thread for mermaid code blocks
2. Include information about found diagrams in the approval response
3. Consider these diagrams when generating implementation guidance

### Improved Milestone Finding
The milestone search logic has been enhanced with:
- Multiple URL pattern matching for better reliability
- Better error handling and debugging
- Support for various milestone reference formats
- Comprehensive logging for troubleshooting

### Expected Behavior
When you run `@l approve` after a thread contains mermaid diagrams:
- The system will report: "📊 **Mermaid Diagrams Found:** I found X mermaid diagram(s) in this thread"
- The diagrams will be considered in the implementation planning process

## Testing the Changes

### Self-Protection Test
1. Create a comment as the uwularpy bot: `@l plan` → Should be ignored
2. Create a comment as the uwularpy bot: `self@ plan` → Should be processed
3. Create a comment as any other user: `@l plan` → Should be processed normally

### Mermaid Detection Test
1. Add a mermaid diagram to a thread:
   ```mermaid
   graph TD
     A[Start] --> B[Process]
     B --> C[End]
   ```
2. Run `@l approve` 
3. Check that the response mentions finding the mermaid diagram

Both features are backward compatible and don't affect existing functionality.