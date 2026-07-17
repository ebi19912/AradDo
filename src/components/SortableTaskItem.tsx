import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "../types";
import { playNotificationSound } from "../utils/audio";
import {
  CheckSquare,
  Square,
  Share2,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  GripVertical,
} from "lucide-react";

interface SortableTaskItemProps {
  task: Task;
  theme: "light" | "dark";
  handleToggleComplete: (id: string, e?: React.MouseEvent) => void;
  setShareTargetTask: (task: Task | null) => void;
  setShareStatus: (status: "idle" | "sending" | "success" | "error") => void;
  setShareError: (error: string) => void;
  setEditingTask: (task: Task | null) => void;
  handleDeleteTask: (id: string) => void;
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({
  task,
  theme,
  handleToggleComplete,
  setShareTargetTask,
  setShareStatus,
  setShareError,
  setEditingTask,
  handleDeleteTask,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 rounded-2xl border flex items-start gap-4 transition-all duration-300 hover:scale-[1.015] hover:shadow-lg hover:border-nat-primary/60 dark:hover:border-nat-dark-primary/60 ${
        isDragging
          ? "opacity-50 ring-2 ring-indigo-500 scale-[1.02] shadow-2xl z-50 cursor-grabbing"
          : ""
      } ${
        task.completed
          ? theme === "dark"
            ? "bg-nat-dark-card/20 border-nat-dark-border/60 opacity-60 hover:opacity-90"
            : "bg-nat-card/50 border-nat-border/50 opacity-65 hover:opacity-90"
          : theme === "dark"
          ? "bg-nat-dark-card border-nat-dark-border shadow-sm shadow-black/10"
          : "bg-nat-card border-nat-border shadow-sm shadow-stone-200/50"
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`p-1 mt-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing text-nat-muted transition-colors`}
        title="کشیدن برای جابه‌جایی"
      >
        <GripVertical className="w-4 h-4 opacity-50 hover:opacity-100" />
      </div>

      {/* Completion check trigger */}
      <button
        onClick={(e) => handleToggleComplete(task.id, e)}
        className="mt-1 rounded-lg text-nat-primary dark:text-nat-dark-primary focus:outline-none flex-shrink-0 cursor-pointer"
      >
        {task.completed ? (
          <CheckSquare className="w-5 h-5 text-nat-primary dark:text-nat-dark-primary" />
        ) : (
          <Square className="w-5 h-5 text-nat-muted dark:text-nat-dark-muted" />
        )}
      </button>

      {/* Card Content body */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4
            className={`text-sm sm:text-md font-bold tracking-tight truncate ${
              task.completed ? "line-through text-nat-muted dark:text-nat-dark-muted" : ""
            }`}
          >
            {task.title}
          </h4>

          {/* Priority Tag */}
          <span
            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
              task.priority === "high"
                ? "bg-red-500/10 text-red-500"
                : task.priority === "medium"
                ? "bg-amber-500/10 text-amber-600"
                : "bg-green-500/10 text-green-600"
            }`}
          >
            {task.priority === "high" ? "مهم" : task.priority === "medium" ? "متوسط" : "عادی"}
          </span>

          {/* Category Tag */}
          <span className="text-[9px] bg-nat-primary/10 text-nat-primary dark:text-nat-dark-primary px-2 py-0.5 rounded-full font-semibold">
            {task.category}
          </span>
        </div>

        {task.notes && (
          <p className="text-xs text-gray-400 leading-relaxed mt-1.5 break-words">
            {task.notes}
          </p>
        )}

        {/* Date & alarm indications */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-[10px] text-nat-muted dark:text-nat-dark-muted border-t border-gray-700/10 dark:border-gray-800/40 pt-2">
          {task.dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-nat-muted" />
              تاریخ: {task.dueDate}
            </span>
          )}

          {task.reminderTime && (
            <span className="flex items-center gap-1.5 text-nat-primary dark:text-nat-dark-primary">
              <Clock className="w-3.5 h-3.5" />
              یادآوری: {task.reminderTime}
            </span>
          )}

          {task.completedAt && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              انجام شد در{" "}
              {new Date(task.completedAt).toLocaleTimeString("fa-IR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Card Action Buttons panel */}
      <div className="flex items-center gap-1 flex-shrink-0 self-center">
        {/* Share action */}
        <button
          onClick={() => {
            setShareTargetTask(task);
            setShareStatus("idle");
            setShareError("");
            playNotificationSound("click");
          }}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            theme === "dark"
              ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-nat-dark-primary"
              : "border-nat-border hover:bg-nat-sidebar text-nat-primary"
          }`}
          title="اشتراک‌گذاری با فضا"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Edit task */}
        {!task.completed && (
          <button
            onClick={() => {
              setEditingTask(task);
              playNotificationSound("click");
            }}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-amber-500"
                : "border-nat-border hover:bg-nat-sidebar text-amber-600"
            }`}
            title="ویرایش"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete task */}
        <button
          onClick={() => handleDeleteTask(task.id)}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            theme === "dark"
              ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-rose-500"
              : "border-nat-border hover:bg-nat-sidebar text-rose-600"
          }`}
          title="حذف فعالیت"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SortableTaskItem;
