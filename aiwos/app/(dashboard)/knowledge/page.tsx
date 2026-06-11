"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  DocumentsTable,
  type KnowledgeDocument,
} from "@/components/knowledge/DocumentsTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";

const documentsData: KnowledgeDocument[] = [
  {
    id: "doc-1",
    name: "Company Policies.pdf",
    type: "PDF",
    uploadedBy: "John Doe",
    uploadDate: "2025-05-10",
    usedByAgents: ["HR Agent", "Support Agent"],
  },
  {
    id: "doc-2",
    name: "Product Docs",
    type: "Folder",
    uploadedBy: "Jane Smith",
    uploadDate: "2025-05-17",
    usedByAgents: ["Code Assistant", "Research Agent"],
  },
  {
    id: "doc-3",
    name: "API Documentation.pdf",
    type: "PDF",
    uploadedBy: "John Doe",
    uploadDate: "2025-05-12",
    usedByAgents: ["Code Assistant", "DevOps Agent"],
  },
  {
    id: "doc-4",
    name: "Market Research Q2.docx",
    type: "Docx",
    uploadedBy: "Mila Johnson",
    uploadDate: "2025-05-15",
    usedByAgents: ["Research Agent"],
  },
  {
    id: "doc-5",
    name: "Financial Guidelines.pdf",
    type: "PDF",
    uploadedBy: "Sarah Wilson",
    uploadDate: "2025-05-14",
    usedByAgents: ["Finance Agent"],
  },
  {
    id: "doc-6",
    name: "Customer Feedback.csv",
    type: "CSV",
    uploadedBy: "Alex Rivera",
    uploadDate: "2025-05-19",
    usedByAgents: ["Support Agent", "Marketing Agent"],
  },
];

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return documentsData.filter((document) => {
      return (
        document.name.toLowerCase().includes(query) ||
        document.type.toLowerCase().includes(query) ||
        document.uploadedBy.toLowerCase().includes(query) ||
        document.usedByAgents.some((agent) =>
          agent.toLowerCase().includes(query)
        )
      );
    });
  }, [searchQuery]);

  return (
    <div className="min-h-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage documents and data for your agents.
          </p>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none"
          style={{ background: "var(--purple)" }}
        >
          <Plus size={16} />
          Add Document
        </button>
      </div>

      <div className="mb-6">
        <SearchInput
          label="Search documents"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search documents..."
        />
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold">{filteredDocuments.length}</span>{" "}
          of <span className="font-semibold">{documentsData.length}</span>{" "}
          documents
        </p>
      </div>

      {filteredDocuments.length > 0 ? (
        <DocumentsTable documents={filteredDocuments} />
      ) : (
        <EmptyState
          title="No documents found"
          description="Try changing your search terms."
        />
      )}
    </div>
  );
}
