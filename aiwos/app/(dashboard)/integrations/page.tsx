"use client";

import { useMemo, useState } from "react";
import { Database, HardDrive, Mail, Plus } from "lucide-react";
import {
  IntegrationCard,
  type IntegrationStatus,
} from "@/components/integrations/IntegrationCard";
import { SummaryCard } from "@/components/common/SummaryCard";

type IntegrationLogoType =
  | "slack"
  | "jira"
  | "salesforce"
  | "gmail"
  | "github"
  | "drive"
  | "postgres";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  logo: IntegrationLogoType;
}

const initialIntegrations: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Route workspace messages, alerts, and approvals.",
    status: "connected",
    logo: "slack",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Sync tasks, issues, sprint updates, and delivery signals.",
    status: "connected",
    logo: "jira",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Bring account, opportunity, and customer context into AIWOS.",
    status: "disconnected",
    logo: "salesforce",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Connect inbox activity for triage, summaries, and follow-ups.",
    status: "connected",
    logo: "gmail",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Track repositories, pull requests, issues, and code activity.",
    status: "connected",
    logo: "github",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Index shared documents, folders, and project resources.",
    status: "connected",
    logo: "drive",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Connect structured operational data for agent workflows.",
    status: "disconnected",
    logo: "postgres",
  },
];

function LogoMark({ type }: { type: IntegrationLogoType }) {
  if (type === "slack") {
    return (
      <div className="grid h-10 w-10 grid-cols-2 gap-1 rounded-lg bg-[#111827] p-2">
        <span className="rounded-sm bg-[#36C5F0]" />
        <span className="rounded-sm bg-[#2EB67D]" />
        <span className="rounded-sm bg-[#E01E5A]" />
        <span className="rounded-sm bg-[#ECB22E]" />
      </div>
    );
  }

  if (type === "gmail") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f2937] text-[#EA4335]">
        <Mail size={21} />
      </div>
    );
  }

  if (type === "drive") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f2937] text-[#34A853]">
        <HardDrive size={21} />
      </div>
    );
  }

  if (type === "postgres") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#17324d] text-[#7dd3fc]">
        <Database size={21} />
      </div>
    );
  }

  const logoStyles = {
    jira: {
      label: "J",
      background: "linear-gradient(135deg, #2684ff, #0052cc)",
    },
    github: {
      label: "GH",
      background: "linear-gradient(135deg, #0d1117, #30363d)",
    },
    salesforce: {
      label: "S",
      background: "linear-gradient(135deg, #00a1e0, #0f7fbd)",
    },
  } satisfies Record<
    Exclude<IntegrationLogoType, "slack" | "gmail" | "drive" | "postgres">,
    { label: string; background: string }
  >;

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
      style={{ background: logoStyles[type].background }}
    >
      {logoStyles[type].label}
    </div>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(initialIntegrations);

  const stats = useMemo(() => {
    const connected = integrations.filter(
      (integration) => integration.status === "connected"
    ).length;

    return {
      total: integrations.length,
      connected,
      disconnected: integrations.length - connected,
    };
  }, [integrations]);

  const handleToggle = (id: string) => {
    setIntegrations((currentIntegrations) =>
      currentIntegrations.map((integration) =>
        integration.id === id
          ? {
              ...integration,
              status:
                integration.status === "connected"
                  ? "disconnected"
                  : "connected",
            }
          : integration
      )
    );
  };

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect your favorite tools with AIWOS.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Add Integration
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Integrations" value={stats.total} />
        <SummaryCard label="Connected" value={stats.connected} tone="green" />
        <SummaryCard
          label="Disconnected"
          value={stats.disconnected}
          tone="amber"
        />
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold">{integrations.length}</span>{" "}
          available integrations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            name={integration.name}
            description={integration.description}
            status={integration.status}
            logo={<LogoMark type={integration.logo} />}
            onToggle={() => handleToggle(integration.id)}
          />
        ))}
      </div>
    </div>
  );
}
