"use client";

import { MoreVertical } from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/lib/data/tasks";

interface TaskTableProps {
  tasks: Task[];
}

function StatusBadge({ status }: { status: TaskStatus }) {
  let bgColor: string;
  let textColor: string;

  switch (status) {
    case "Todo":
      bgColor = "rgba(139,92,246,0.12)";
      textColor = "var(--purple)";
      break;
    case "In Progress":
      bgColor = "rgba(6,182,212,0.12)";
      textColor = "var(--cyan)";
      break;
    case "In Review":
      bgColor = "rgba(245,158,11,0.12)";
      textColor = "var(--amber)";
      break;
    case "Done":
      bgColor = "rgba(16,185,129,0.12)";
      textColor = "var(--green)";
      break;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: bgColor,
        color: textColor,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: textColor }}
      />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  let bgColor: string;
  let textColor: string;

  switch (priority) {
    case "Low":
      bgColor = "rgba(16,185,129,0.12)";
      textColor = "var(--green)";
      break;
    case "Medium":
      bgColor = "rgba(245,158,11,0.12)";
      textColor = "var(--amber)";
      break;
    case "High":
      bgColor = "rgba(239,68,68,0.12)";
      textColor = "var(--red)";
      break;
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
      style={{
        background: bgColor,
        color: textColor,
      }}
    >
      {priority}
    </span>
  );
}

export function TaskTable({ tasks }: TaskTableProps) {
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
                Task Title
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Priority
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Assigned To
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Due Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                Progress
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, idx) => (
              <tr
                key={task.id}
                className="transition-colors hover:bg-[var(--accent)]"
                style={{
                  borderBottom:
                    idx < tasks.length - 1
                      ? "1px solid var(--border-light)"
                      : "none",
                }}
              >
                {/* Task Title */}
                <td className="px-6 py-4">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {task.title}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <StatusBadge status={task.status} />
                </td>

                {/* Priority */}
                <td className="px-6 py-4">
                  <PriorityBadge priority={task.priority} />
                </td>

                {/* Assigned To */}
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {task.assignedTo}
                  </span>
                </td>

                {/* Due Date */}
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">
                    {new Date(task.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </td>

                {/* Progress */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${task.completionPercentage}%`,
                          background:
                            task.completionPercentage === 100
                              ? "var(--green)"
                              : "var(--cyan)",
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-foreground">
                      {task.completionPercentage}%
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-center">
                  <button
                    className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[var(--border)] hover:text-foreground"
                    aria-label={`Actions for ${task.title}`}
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
