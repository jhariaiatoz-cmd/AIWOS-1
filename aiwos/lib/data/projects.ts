export type ProjectStatus = "Active" | "On Hold" | "Completed";

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  agentCount: number;
  agents: Array<{
    id: string;
    name: string;
    initials: string;
    avatarColor: string;
  }>;
  startDate: string;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
}

export const projectsData: Project[] = [
  {
    id: "1",
    title: "E-Commerce Platform",
    description: "Build a comprehensive e-commerce platform with payments",
    status: "Active",
    progress: 65,
    agentCount: 5,
    agents: [
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a2",
        name: "UX Designer",
        initials: "UD",
        avatarColor: "linear-gradient(135deg, #ef4444, #ec4899)",
      },
      {
        id: "a3",
        name: "QA Tester",
        initials: "QT",
        avatarColor: "linear-gradient(135deg, #7c3aed, #06b6d4)",
      },
      {
        id: "a4",
        name: "DevOps Engineer",
        initials: "DE",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a5",
        name: "Security Auditor",
        initials: "SA",
        avatarColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
    ],
    startDate: "2025-05-01",
    dueDate: "2025-08-15",
    priority: "High",
  },
  {
    id: "2",
    title: "Mobile App Redesign",
    description: "Complete redesign of mobile application UI/UX",
    status: "Active",
    progress: 45,
    agentCount: 3,
    agents: [
      {
        id: "a2",
        name: "UX Designer",
        initials: "UD",
        avatarColor: "linear-gradient(135deg, #ef4444, #ec4899)",
      },
      {
        id: "a9",
        name: "Content Creator",
        initials: "CC",
        avatarColor: "linear-gradient(135deg, #10b981, #f59e0b)",
      },
      {
        id: "a6",
        name: "HR Manager",
        initials: "HM",
        avatarColor: "linear-gradient(135deg, #ec4899, #7c3aed)",
      },
    ],
    startDate: "2025-05-15",
    dueDate: "2025-07-30",
    priority: "Medium",
  },
  {
    id: "3",
    title: "Data Analytics Dashboard",
    description: "Create real-time analytics dashboard for business metrics",
    status: "Active",
    progress: 80,
    agentCount: 4,
    agents: [
      {
        id: "a4",
        name: "Data Analyst",
        initials: "DA",
        avatarColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a13",
        name: "QA Tester",
        initials: "QT",
        avatarColor: "linear-gradient(135deg, #7c3aed, #06b6d4)",
      },
      {
        id: "a14",
        name: "SEO Specialist",
        initials: "SS",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
    ],
    startDate: "2025-04-01",
    dueDate: "2025-06-30",
    priority: "High",
  },
  {
    id: "4",
    title: "Customer Support AI",
    description: "Develop AI-powered customer support chatbot",
    status: "On Hold",
    progress: 30,
    agentCount: 3,
    agents: [
      {
        id: "a3",
        name: "Support Agent",
        initials: "SA",
        avatarColor: "linear-gradient(135deg, #10b981, #f59e0b)",
      },
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a10",
        name: "Security Auditor",
        initials: "SA",
        avatarColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
    ],
    startDate: "2025-06-01",
    dueDate: "2025-08-20",
    priority: "Medium",
  },
  {
    id: "5",
    title: "API Documentation",
    description: "Complete API documentation and developer portal",
    status: "Completed",
    progress: 100,
    agentCount: 2,
    agents: [
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a9",
        name: "Content Creator",
        initials: "CC",
        avatarColor: "linear-gradient(135deg, #10b981, #f59e0b)",
      },
    ],
    startDate: "2025-03-15",
    dueDate: "2025-05-20",
    priority: "Medium",
  },
  {
    id: "6",
    title: "Infrastructure Migration",
    description: "Migrate infrastructure to cloud platform",
    status: "Active",
    progress: 55,
    agentCount: 4,
    agents: [
      {
        id: "a8",
        name: "DevOps Engineer",
        initials: "DE",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a10",
        name: "Security Auditor",
        initials: "SA",
        avatarColor: "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
      {
        id: "a15",
        name: "Network Admin",
        initials: "NA",
        avatarColor: "linear-gradient(135deg, #10b981, #f59e0b)",
      },
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
    ],
    startDate: "2025-05-20",
    dueDate: "2025-09-10",
    priority: "High",
  },
  {
    id: "7",
    title: "Market Research Initiative",
    description: "Comprehensive market research and competitive analysis",
    status: "Active",
    progress: 70,
    agentCount: 3,
    agents: [
      {
        id: "a5",
        name: "Research Agent",
        initials: "RA",
        avatarColor: "linear-gradient(135deg, #7c3aed, #06b6d4)",
      },
      {
        id: "a14",
        name: "SEO Specialist",
        initials: "SS",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a7",
        name: "Marketing Strategist",
        initials: "MS",
        avatarColor: "linear-gradient(135deg, #7c3aed, #06b6d4)",
      },
    ],
    startDate: "2025-04-10",
    dueDate: "2025-07-15",
    priority: "Medium",
  },
  {
    id: "8",
    title: "HR Management System",
    description: "Build comprehensive HR management system",
    status: "Completed",
    progress: 100,
    agentCount: 3,
    agents: [
      {
        id: "a6",
        name: "HR Manager",
        initials: "HM",
        avatarColor: "linear-gradient(135deg, #ec4899, #7c3aed)",
      },
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
      {
        id: "a13",
        name: "QA Tester",
        initials: "QT",
        avatarColor: "linear-gradient(135deg, #7c3aed, #06b6d4)",
      },
    ],
    startDate: "2025-02-01",
    dueDate: "2025-05-10",
    priority: "High",
  },
  {
    id: "9",
    title: "Financial Reporting Automation",
    description: "Automate financial reporting and compliance",
    status: "Active",
    progress: 40,
    agentCount: 2,
    agents: [
      {
        id: "a5",
        name: "Finance Agent",
        initials: "FA",
        avatarColor: "linear-gradient(135deg, #ef4444, #ec4899)",
      },
      {
        id: "a1",
        name: "Code Assistant",
        initials: "CA",
        avatarColor: "linear-gradient(135deg, #06b6d4, #10b981)",
      },
    ],
    startDate: "2025-05-25",
    dueDate: "2025-08-30",
    priority: "High",
  },
];

export const projectStatuses: ProjectStatus[] = ["Active", "On Hold", "Completed"];
