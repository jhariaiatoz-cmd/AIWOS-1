export type AgentStatus = "online" | "busy" | "offline";

export interface Conversation {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentInitials: string;
  agentColor: string;
  status: AgentStatus;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export type ProjectPriority = "High" | "Medium" | "Low";
export type ProjectComplexity = "High" | "Medium" | "Low";

export interface ProjectRecommendationMetadata {
  type: "project_recommendation";
  name: string;
  description: string;
  milestones: string[];
  tasks: string[];
  priority: ProjectPriority;
  complexity: ProjectComplexity;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: "user" | "agent";
  content: string;
  timestamp: string;
  metadata?: ProjectRecommendationMetadata | null;
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    agentId: "agent-1",
    agentName: "Atlas",
    agentRole: "Research Analyst",
    agentInitials: "AT",
    agentColor: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    status: "online",
    lastMessage: "I've completed the market analysis report. Ready for review.",
    lastMessageAt: "2m ago",
    unread: 2,
  },
  {
    id: "conv-2",
    agentId: "agent-2",
    agentName: "Nova",
    agentRole: "Content Writer",
    agentInitials: "NV",
    agentColor: "linear-gradient(135deg, #06b6d4, #0891b2)",
    status: "busy",
    lastMessage: "Working on the blog post draft. Will have it ready by 3 PM.",
    lastMessageAt: "15m ago",
    unread: 0,
  },
  {
    id: "conv-3",
    agentId: "agent-3",
    agentName: "Orion",
    agentRole: "Data Engineer",
    agentInitials: "OR",
    agentColor: "linear-gradient(135deg, #10b981, #059669)",
    status: "online",
    lastMessage: "Pipeline migration completed successfully. All tests passing.",
    lastMessageAt: "1h ago",
    unread: 0,
  },
  {
    id: "conv-4",
    agentId: "agent-4",
    agentName: "Lyra",
    agentRole: "UX Designer",
    agentInitials: "LY",
    agentColor: "linear-gradient(135deg, #ec4899, #db2777)",
    status: "offline",
    lastMessage: "Wireframes for the new dashboard are ready.",
    lastMessageAt: "3h ago",
    unread: 0,
  },
  {
    id: "conv-5",
    agentId: "agent-5",
    agentName: "Vega",
    agentRole: "DevOps Engineer",
    agentInitials: "VG",
    agentColor: "linear-gradient(135deg, #f59e0b, #d97706)",
    status: "busy",
    lastMessage: "Deployment to staging environment is in progress.",
    lastMessageAt: "5h ago",
    unread: 1,
  },
  {
    id: "conv-6",
    agentId: "agent-6",
    agentName: "Zephyr",
    agentRole: "QA Engineer",
    agentInitials: "ZP",
    agentColor: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    status: "offline",
    lastMessage: "Test suite for v2.3 is complete. Found 3 bugs.",
    lastMessageAt: "Yesterday",
    unread: 0,
  },
];

export const MESSAGES: Message[] = [
  // conv-1: Atlas
  { id: "m1", conversationId: "conv-1", sender: "agent", content: "Good morning! I've been working on the Q3 market analysis. The data shows a 12% uptick in the target segment.", timestamp: "9:14 AM" },
  { id: "m2", conversationId: "conv-1", sender: "user", content: "That's great news. Can you break that down by region?", timestamp: "9:16 AM" },
  { id: "m3", conversationId: "conv-1", sender: "agent", content: "Sure. North America leads with 18% growth, followed by EMEA at 9% and APAC at 8%. I've also identified three emerging markets worth targeting.", timestamp: "9:18 AM" },
  { id: "m4", conversationId: "conv-1", sender: "user", content: "Which emerging markets?", timestamp: "9:20 AM" },
  { id: "m5", conversationId: "conv-1", sender: "agent", content: "Southeast Asia — particularly Vietnam and Indonesia — and also the Gulf region. Combined TAM is estimated at $2.4B by 2026.", timestamp: "9:22 AM" },
  { id: "m6", conversationId: "conv-1", sender: "agent", content: "I've completed the market analysis report. Ready for review.", timestamp: "9:45 AM" },

  // conv-2: Nova
  { id: "m7", conversationId: "conv-2", sender: "user", content: "Hey Nova, how's the blog post coming along?", timestamp: "10:00 AM" },
  { id: "m8", conversationId: "conv-2", sender: "agent", content: "Making good progress! I've finished the introduction and first two sections. The angle is \"AI-augmented workflows in 2026\" — resonating well with the brief.", timestamp: "10:05 AM" },
  { id: "m9", conversationId: "conv-2", sender: "user", content: "Sounds good. What's the target word count?", timestamp: "10:07 AM" },
  { id: "m10", conversationId: "conv-2", sender: "agent", content: "Working on the blog post draft. Will have it ready by 3 PM.", timestamp: "10:10 AM" },

  // conv-3: Orion
  { id: "m11", conversationId: "conv-3", sender: "agent", content: "Starting the pipeline migration now. ETA is about 45 minutes.", timestamp: "8:00 AM" },
  { id: "m12", conversationId: "conv-3", sender: "user", content: "Sounds good. Ping me when it's done.", timestamp: "8:02 AM" },
  { id: "m13", conversationId: "conv-3", sender: "agent", content: "Pipeline migration completed successfully. All tests passing.", timestamp: "8:52 AM" },

  // conv-4: Lyra
  { id: "m14", conversationId: "conv-4", sender: "user", content: "Lyra, any update on the dashboard wireframes?", timestamp: "7:30 AM" },
  { id: "m15", conversationId: "conv-4", sender: "agent", content: "Wireframes for the new dashboard are ready. I'll send the Figma link shortly.", timestamp: "7:35 AM" },

  // conv-5: Vega
  { id: "m16", conversationId: "conv-5", sender: "user", content: "Can you push the latest build to staging?", timestamp: "6:00 AM" },
  { id: "m17", conversationId: "conv-5", sender: "agent", content: "On it. Running pre-deployment checks now.", timestamp: "6:01 AM" },
  { id: "m18", conversationId: "conv-5", sender: "agent", content: "Deployment to staging environment is in progress.", timestamp: "6:10 AM" },

  // conv-6: Zephyr
  { id: "m19", conversationId: "conv-6", sender: "agent", content: "Ran the full test suite for v2.3. Results: 142 passed, 3 failed.", timestamp: "Yesterday 4:00 PM" },
  { id: "m20", conversationId: "conv-6", sender: "user", content: "What are the 3 failures?", timestamp: "Yesterday 4:05 PM" },
  { id: "m21", conversationId: "conv-6", sender: "agent", content: "Test suite for v2.3 is complete. Found 3 bugs. I've filed issues for each — #247, #248, and #249.", timestamp: "Yesterday 4:15 PM" },
];
