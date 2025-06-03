// Test the new milestone creation template
const MILESTONE_CREATED_TEMPLATE = (milestoneUrl) => `
## 🎯 AI Development Plan Created!

I've analyzed your repository and created a comprehensive development milestone with prioritized tasks.

### 📍 **Your Milestone:** [View AI Development Plan](${milestoneUrl})

## 🚀 **Next Steps:**

### **Option 1: Approve & Create Issues (Recommended)**
Comment: \`@l approve\` to automatically create all planned issues and attach them to this milestone.

### **Option 2: Review & Refine First**
- Click the milestone link above to review the detailed plan
- Comment: \`@l refine [your feedback]\` to modify the plan based on your needs
- Example: \`@l refine focus more on security improvements\`

### **Option 3: Cancel Plan**
Comment: \`@l cancel\` if you want to reject this plan entirely.

## 📋 **What's in Your Plan:**
The milestone contains a detailed analysis with:
- 🚨 **Critical fixes** - Security & performance issues requiring immediate attention
- 📦 **Missing components** - Essential features your project needs
- 🔧 **Improvements** - Code quality and technical debt items  
- 💡 **Innovation ideas** - New features to enhance your project

## ⚡ **Quick Approval:**
Ready to proceed? Just comment \`@l approve\` and I'll create all the issues automatically!

---
*Powered by AI Development Planning* 🤖`;

// Test with example URL
const exampleUrl = "https://github.com/example/repo/milestone/1";
const result = MILESTONE_CREATED_TEMPLATE(exampleUrl);

console.log("=== NEW MILESTONE CREATION MESSAGE ===");
console.log(result);
console.log("\n=== MESSAGE LENGTH ===");
console.log(`${result.length} characters`);
console.log("\n✅ Template enhanced with clear next steps!");
