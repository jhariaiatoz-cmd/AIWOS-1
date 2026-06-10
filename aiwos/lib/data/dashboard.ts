import type { StatCard, Department, Activity, TopAgent } from "@/lib/types";

export const statCards: StatCard[] = [
  {
    label: "Total Agents",
    value: "128",
    delta: "+12% from last week",
    deltaType: "up",
    icon: "Bot",
    color: "var(--purple)",
    bgColor: "rgba(124,58,237,0.12)",
  },
  {
    label: "Running Tasks",
    value: "342",
    delta: "+10% from last week",
    deltaType: "up",
    icon: "Play",
    color: "var(--cyan)",
    bgColor: "rgba(6,182,212,0.12)",
  },
  {
    label: "Tasks Completed",
    value: "1,245",
    delta: "+24% from last week",
    deltaType: "up",
    icon: "CheckCircle",
    color: "var(--green)",
    bgColor: "rgba(16,185,129,0.12)",
  },
  {
    label: "Total Cost (Today)",
    value: "$23.45",
    delta: "-8% from yesterday",
    deltaType: "down",
    icon: "DollarSign",
    color: "var(--amber)",
    bgColor: "rgba(245,158,11,0.12)",
  },
];

export const departments: Department[] = [
  {
    name: "Development",
    count: 24,
    progress: 82,
    icon: "Code2",
    color: "var(--purple)",
    bgColor: "rgba(124,58,237,0.12)",
  },
  {
    name: "Sales & Marketing",
    count: 18,
    progress: 76,
    icon: "Megaphone",
    color: "var(--amber)",
    bgColor: "rgba(245,158,11,0.12)",
  },
  {
    name: "HR",
    count: 15,
    progress: 68,
    icon: "Users",
    color: "var(--pink)",
    bgColor: "rgba(236,72,153,0.12)",
  },
  {
    name: "Finance",
    count: 12,
    progress: 74,
    icon: "Coins",
    color: "var(--green)",
    bgColor: "rgba(16,185,129,0.12)",
  },
  {
    name: "Support",
    count: 20,
    progress: 90,
    icon: "Headphones",
    color: "var(--cyan)",
    bgColor: "rgba(6,182,212,0.12)",
  },
  {
    name: "Research",
    count: 17,
    progress: 71,
    icon: "Telescope",
    color: "var(--red)",
    bgColor: "rgba(239,68,68,0.12)",
  },
];

export const recentActivities: Activity[] = [
  {
    id: "1",
    agent: "Marketing Agent",
    action: "completed a task",
    time: "2 min ago",
    color: "var(--green)",
  },
  {
    id: "2",
    agent: "Code Assistant",
    action: "pushed code to repo",
    time: "8 min ago",
    color: "var(--cyan)",
  },
  {
    id: "3",
    agent: "Finance Agent",
    action: "generated report",
    time: "15 min ago",
    color: "var(--amber)",
  },
  {
    id: "4",
    agent: "HR Agent",
    action: "screened 25 resumes",
    time: "20 min ago",
    color: "var(--purple)",
  },
  {
    id: "5",
    agent: "Support Agent",
    action: "resolved 32 tickets",
    time: "25 min ago",
    color: "var(--pink)",
  },
  {
    id: "6",
    agent: "Research Agent",
    action: "compiled market analysis",
    time: "31 min ago",
    color: "var(--red)",
  },
  {
    id: "7",
    agent: "Data Analyst",
    action: "updated dashboard metrics",
    time: "44 min ago",
    color: "var(--cyan)",
  },
  {
    id: "8",
    agent: "DevOps Agent",
    action: "deployed new service",
    time: "1 hr ago",
    color: "var(--green)",
  },
];

export const topAgents: TopAgent[] = [
  { name: "Research Agent", score: 97, color: "var(--purple)" },
  { name: "Code Assistant", score: 94, color: "var(--cyan)" },
  { name: "Support Agent", score: 92, color: "var(--green)" },
  { name: "Data Analyst", score: 90, color: "var(--amber)" },
  { name: "Finance Agent", score: 89, color: "var(--pink)" },
];

export const commandSuggestions = [
  { emoji: "🏗️", text: "Build Hospital Management System" },
  { emoji: "📊", text: "Generate Market Research" },
  { emoji: "📢", text: "Create Sales Campaign" },
  { emoji: "👤", text: "Hire React Developer" },
];
