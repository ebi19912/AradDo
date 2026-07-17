/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Task, Priority, Theme } from "../types";
import { PlusCircle, Save, X, Calendar, Clock, AlertTriangle, Tag, FileText } from "lucide-react";

interface TaskFormProps {
  onAddTask: (taskData: Omit<Task, "id" | "completed" | "createdAt">) => void;
  editingTask: Task | null;
  onUpdateTask: (task: Task) => void;
  onCancelEdit: () => void;
  theme: Theme;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function TaskForm({
  onAddTask,
  editingTask,
  onUpdateTask,
  onCancelEdit,
  theme,
  categories,
  setCategories,
}: TaskFormProps) {
  const isDark = theme === "dark";

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState("شخصی");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  const [validationError, setValidationError] = useState("");

  // Sync state if editing a task
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setNotes(editingTask.notes || "");
      setPriority(editingTask.priority);

      if (categories.includes(editingTask.category)) {
        setCategory(editingTask.category);
        setShowCustomCategoryInput(false);
      } else {
        setCategory("custom");
        setCustomCategory(editingTask.category);
        setShowCustomCategoryInput(true);
      }

      setDueDate(editingTask.dueDate || "");
      setReminderTime(editingTask.reminderTime || "");

      // Smooth scroll to form & focus title input so editing is obvious and intuitive
      setTimeout(() => {
        const formEl = document.getElementById("task-form");
        if (formEl) {
          formEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const titleInput = document.querySelector('input[placeholder="مثال: مطالعه کتاب توسعه فردی"]');
        if (titleInput) {
          (titleInput as HTMLInputElement).focus();
        }
      }, 100);
    } else {
      resetForm();
    }
  }, [editingTask]);

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setPriority("medium");
    setCategory("شخصی");
    setCustomCategory("");
    setShowCustomCategoryInput(false);
    setDueDate("");
    setReminderTime("");
    setValidationError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setValidationError("عنوان فعالیت نمی‌تواند خالی باشد.");
      return;
    }

    const selectedCategory = category === "custom" ? customCategory.trim() || "عمومی" : category;

    if (category === "custom" && customCategory.trim()) {
      const newCat = customCategory.trim();
      if (!categories.includes(newCat)) {
        setCategories((prev) => [...prev, newCat]);
      }
    }

    const taskPayload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      category: selectedCategory,
      dueDate: dueDate || undefined,
      reminderTime: reminderTime || undefined,
    };

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        ...taskPayload,
      });
    } else {
      onAddTask(taskPayload);
    }

    resetForm();
  };

  return (
    <form
      onSubmit={handleSubmit}
      id="task-form"
      className={`p-6 rounded-2xl border transition-all duration-300 ${
        isDark
          ? "bg-nat-dark-card border-nat-dark-border text-gray-200"
          : "bg-nat-card border-nat-border text-nat-dark shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-5 border-b border-gray-700/10 pb-4">
        <h3 className="text-md font-bold flex items-center gap-2">
          {editingTask ? (
            <span className="text-nat-primary dark:text-nat-dark-primary font-serif italic">ویرایش فعالیت</span>
          ) : (
            <span className="text-nat-primary dark:text-nat-dark-primary font-serif italic">افزودن فعالیت جدید</span>
          )}
        </h3>
        {editingTask && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 hover:bg-nat-hover/20 dark:hover:bg-nat-dark-sidebar/40 rounded-lg text-gray-400 hover:text-rose-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {validationError && (
        <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
          {validationError}
        </div>
      )}

      <div className="space-y-4">
        {/* Title Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium">عنوان فعالیت *</label>
          <input
            type="text"
            placeholder="مثال: مطالعه کتاب توسعه فردی"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (validationError) setValidationError("");
            }}
            className={`w-full px-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary ${
              isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
            }`}
          />
        </div>

        {/* Notes Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            توضیحات و یادداشت‌ها (اختیاری)
          </label>
          <textarea
            placeholder="جزئیات بیشتر را در اینجا یادداشت کنید..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`w-full px-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary resize-none ${
              isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
            }`}
          />
        </div>

        {/* Priority & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              اولویت فعالیت
            </label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    priority === p
                      ? p === "high"
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400"
                        : p === "medium"
                        ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400"
                        : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60 text-green-700 dark:text-green-400"
                      : isDark
                      ? "bg-nat-dark-sidebar border-nat-dark-border text-gray-400 hover:bg-nat-dark-card"
                      : "bg-nat-bg border-nat-border text-nat-muted hover:bg-nat-sidebar"
                  }`}
                >
                  {p === "high" ? "بالا" : p === "medium" ? "متوسط" : "پایین"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              دسته‌بندی کار
            </label>
            <select
              value={category}
              onChange={(e) => {
                const val = e.target.value;
                setCategory(val);
                setShowCustomCategoryInput(val === "custom");
              }}
              className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary ${
                isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
              }`}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="custom">دسته‌بندی سفارشی...</option>
            </select>
          </div>
        </div>

        {/* Custom Category Input (Conditional) */}
        {showCustomCategoryInput && (
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              placeholder="نام دسته‌بندی جدید را وارد کنید..."
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className={`w-full px-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary ${
                isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
              }`}
            />
          </div>
        )}

        {/* Due Date & Reminder Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              تاریخ انجام (مثال: 1403/05/20)
            </label>
            <input
              type="text"
              placeholder="YYYY/MM/DD (به تاریخ شمسی یا میلادی)"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full px-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary dir-ltr text-left font-mono ${
                isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
              }`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ساعت یادآوری (Push Alarm)
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary ${
                isDark ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
              }`}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            className="flex-1 py-2.5 bg-nat-primary dark:bg-nat-dark-primary hover:opacity-90 active:scale-[0.98] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {editingTask ? (
              <>
                <Save className="w-4 h-4" />
                ذخیره تغییرات
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                ثبت فعالیت جدید
              </>
            )}
          </button>
          {editingTask && (
            <button
              type="button"
              onClick={onCancelEdit}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all border cursor-pointer ${
                isDark
                  ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-gray-300"
                  : "border-nat-border hover:bg-nat-sidebar text-gray-600"
              }`}
            >
              انصراف
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
