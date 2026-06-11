"use client";

import { FileArchive, FileText, Folder, MoreVertical, Table } from "lucide-react";

export type DocumentFileType = "PDF" | "Docx" | "Folder" | "CSV";

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: DocumentFileType;
  uploadedBy: string;
  uploadDate: string;
  usedByAgents: string[];
}

interface DocumentsTableProps {
  documents: KnowledgeDocument[];
}

function FileTypeBadge({ type }: { type: DocumentFileType }) {
  const styles = {
    PDF: {
      icon: FileArchive,
      background: "rgba(239,68,68,0.12)",
      color: "var(--red)",
    },
    Docx: {
      icon: FileText,
      background: "rgba(6,182,212,0.12)",
      color: "var(--cyan)",
    },
    Folder: {
      icon: Folder,
      background: "rgba(245,158,11,0.12)",
      color: "var(--amber)",
    },
    CSV: {
      icon: Table,
      background: "rgba(16,185,129,0.12)",
      color: "var(--green)",
    },
  } satisfies Record<
    DocumentFileType,
    {
      icon: typeof FileText;
      background: string;
      color: string;
    }
  >;

  const Icon = styles[type].icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: styles[type].background,
        color: styles[type].color,
      }}
    >
      <Icon size={12} />
      {type}
    </span>
  );
}

function AgentUsage({ agents }: { agents: string[] }) {
  if (agents.length === 0) {
    return <span className="text-sm text-muted-foreground">Not used</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {agents.map((agent) => (
        <span
          key={agent}
          className="rounded-full px-2 py-1 text-xs font-medium"
          style={{
            background: "rgba(124,58,237,0.12)",
            color: "var(--purple)",
          }}
        >
          {agent}
        </span>
      ))}
    </div>
  );
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border-light)",
                background: "var(--surface)",
              }}
            >
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Document Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                File Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Uploaded By
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Upload Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Used By Agents
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document, idx) => (
              <tr
                key={document.id}
                className="transition-colors hover:bg-[var(--accent)]"
                style={{
                  borderBottom:
                    idx < documents.length - 1
                      ? "1px solid var(--border-light)"
                      : "none",
                }}
              >
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-foreground">
                    {document.name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <FileTypeBadge type={document.type} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {document.uploadedBy}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(document.uploadDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <AgentUsage agents={document.usedByAgents} />
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
                    aria-label={`Actions for ${document.name}`}
                  >
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
