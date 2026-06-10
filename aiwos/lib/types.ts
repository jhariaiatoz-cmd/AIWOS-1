export type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export type StatCard = {
  label: string;
  value: string;
  delta: string;
  deltaType: "up" | "down";
  icon: string;
  color: string;
  bgColor: string;
};

export type Department = {
  name: string;
  count: number;
  progress: number;
  icon: string;
  color: string;
  bgColor: string;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  department: string;
  status: "Active" | "Idle" | "Paused";
  tasks: number;
  performance: number;
  avatarColor: string;
  initials: string;
};

export type Activity = {
  id: string;
  agent: string;
  action: string;
  time: string;
  color: string;
};

export type TopAgent = {
  name: string;
  score: number;
  color: string;
};
