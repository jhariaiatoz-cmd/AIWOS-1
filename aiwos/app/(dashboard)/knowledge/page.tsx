"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DocumentsTable,
} from "@/components/knowledge/DocumentsTable";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";
import { knowledgeApi } from "@/lib/api/knowledge";
import { useAuthStore } from "@/lib/store/auth";

const ACCEPTED = ".pdf,.docx,.txt,.md,.csv";

export default function KnowledgePage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents = [], isPending } = useQuery({
    queryKey: ["knowledge", currentOrgId],
    queryFn: () => knowledgeApi.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeApi.upload(currentOrgId!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", currentOrgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", currentOrgId] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  const filtered = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(q) ||
      doc.file_type.toLowerCase().includes(q)
    );
  });

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

        <div className="flex items-center gap-2">
          {uploadMutation.isPending && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              Uploading…
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={!currentOrgId || uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px focus:ring-2 focus:ring-primary/25 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            style={{ background: "var(--purple)" }}
          >
            <Upload size={15} />
            Upload Document
          </button>
        </div>
      </div>

      {uploadMutation.isError && (
        <div
          className="mb-4 rounded-lg px-4 py-2.5 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "var(--red)" }}
        >
          Upload failed. Supported formats: PDF, DOCX, TXT, MD, CSV.
        </div>
      )}

      <div className="mb-6">
        <SearchInput
          label="Search documents"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search documents…"
        />
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="mr-2 animate-spin" />
          Loading documents…
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-semibold">{filtered.length}</span> of{" "}
              <span className="font-semibold">{documents.length}</span>{" "}
              documents
            </p>
          </div>

          {filtered.length > 0 ? (
            <DocumentsTable
              documents={filtered}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ) : (
            <EmptyState
              title={documents.length === 0 ? "No documents yet" : "No documents found"}
              description={
                documents.length === 0
                  ? "Upload a PDF, DOCX, TXT, MD, or CSV file to get started."
                  : "Try changing your search terms."
              }
            />
          )}
        </>
      )}
    </div>
  );
}
