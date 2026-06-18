"use client";

import { FileArchive, FileText, MoreVertical, Table, Trash2 } from "lucide-react";

export type KnowledgeFileType = "pdf" | "docx" | "txt" | "md" | "csv";

export interface KnowledgeDocument {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface DocumentsTableProps {
  documents: KnowledgeDocument[];
  onDelete?: (id: string) => void;
}

const TYPE_STYLES: Record<
  string,
  { icon: typeof FileText; background: string; color: string; label: string }
> = {
  pdf: {
    icon: FileArchive,
    background: "rgba(239,68,68,0.12)",
    color: "var(--red)",
    label: "PDF",
  },
  docx: {
    icon: FileText,
    background: "rgba(6,182,212,0.12)",
    color: "var(--cyan)",
    label: "DOCX",
  },
  txt: {
    icon: FileText,
    background: "rgba(107,114,128,0.12)",
    color: "var(--muted-foreground)",
    label: "TXT",
  },
  md: {
    icon: FileText,
    background: "rgba(124,58,237,0.12)",
    color: "var(--purple)",
    label: "MD",
  },
  csv: {
    icon: Table,
    background: "rgba(16,185,129,0.12)",
    color: "var(--green)",
    label: "CSV",
  },
};

const DEFAULT_STYLE = {
  icon: FileText,
  background: "rgba(107,114,128,0.12)",
  color: "var(--muted-foreground)",
  label: "FILE",
};

function FileTypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type.toLowerCase()] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
      style={{ background: style.background, color: style.color }}
    >
      <Icon size={12} />
      {style.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTable({ documents, onDelete }: DocumentsTableProps) {
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
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Size
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Upload Date
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, idx) => (
              <tr
                key={doc.id}
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
                    {doc.name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <FileTypeBadge type={doc.file_type} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {formatBytes(doc.file_size)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {onDelete ? (
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-red-500"
                      aria-label={`Delete ${doc.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
                      aria-label={`Actions for ${doc.name}`}
                    >
                      <MoreVertical size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
