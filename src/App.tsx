/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Task, SyncConfig, Theme, NotificationItem } from "./types";
import { encryptData, decryptData } from "./utils/crypto";
import { playNotificationSound } from "./utils/audio";
import TaskForm from "./components/TaskForm";
import WeeklyChart from "./components/WeeklyChart";
import SyncSettings from "./components/SyncSettings";
import LoginScreen from "./components/LoginScreen";
import LogoutButton from "./components/LogoutButton";
import ConfettiCanvas from "./components/ConfettiCanvas";
import SortableTaskItem from "./components/SortableTaskItem";
import AISmartCreator from "./components/AISmartCreator";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import moment from "moment-jalaali";
import {
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Share2,
  Search,
  Bell,
  Calendar,
  Clock,
  Sparkles,
  Moon,
  Sun,
  Activity,
  UserCheck,
  CheckCircle,
  Inbox,
  Send,
  X,
  AlertCircle,
  Hash,
} from "lucide-react";

// Mock tasks to populate the app on first boot with realistic daily content
const INITIAL_TASKS: Task[] = [
  {
    id: "task-1",
    title: "برنامه‌ریزی و طراحی معماری پلتفرم",
    notes: "طراحی سناریوهای رمزنگاری سرتاسری و مدیریت همگام‌سازی ابری",
    priority: "high",
    category: "کاری",
    completed: true,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    completedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
    dueDate: moment().subtract(3, "days").format("jYYYY/jMM/jDD"),
    order: 0,
  },
  {
    id: "task-2",
    title: "پیاده‌سازی تست نفوذ رمزنگاری AES-GCM",
    notes: "بررسی کارکرد رمزگشایی محلی در لایه مرورگر دستگاه‌های دوم",
    priority: "medium",
    category: "درس",
    completed: false,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    dueDate: moment().add(1, "days").format("jYYYY/jMM/jDD"),
    reminderTime: "10:30",
    order: 1,
  },
  {
    id: "task-3",
    title: "ورزش روزانه و پیاده‌روی سریع در پارک",
    notes: "۳۰ دقیقه دویدن برای افزایش بهره‌وری ذهنی و سلامتی جسمانی",
    priority: "low",
    category: "سلامت",
    completed: false,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    dueDate: moment().format("jYYYY/jMM/jDD"),
    reminderTime: "18:00",
    order: 2,
  },
];

export default function App() {
  // User Session State
  const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
    return localStorage.getItem("loggedInUser");
  });

  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    return (saved as Theme) || "dark";
  });

  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("categories");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["شخصی", "کاری", "درس", "سلامت", "خرید", "مالی"];
  });

  useEffect(() => {
    localStorage.setItem("categories", JSON.stringify(categories));
  }, [categories]);

  // Local clock state
  const [currentTime, setCurrentTime] = useState("");

  // Tasks and Editing
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Sync and Networking Config
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
    const saved = localStorage.getItem("syncConfig");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      enabled: false,
      spaceId: "",
      passphrase: "",
      clientId: Math.random().toString(36).substring(7),
      status: "idle",
    };
  });

  // Shared Task Inbox (Received from other users via P2P share endpoint)
  const [sharedInbox, setSharedInbox] = useState<any[]>([]);

  // Task share modal target
  const [shareTargetTask, setShareTargetTask] = useState<Task | null>(null);
  const [shareTargetSpaceId, setShareTargetSpaceId] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [shareError, setShareError] = useState("");

  // Personalised Active Push Notifications/Toasts List
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeToast, setActiveToast] = useState<{ id: string; title: string; message: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");

  // Get list of unique categories available in existing tasks
  const uniqueCategories = useMemo(() => {
    const cats = new Set(tasks.map((t) => t.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [tasks]);

  // Synchronise system-level theme and Tailwind classes on boot
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Clock updating
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial load of Tasks
  useEffect(() => {
    const localTasksStr = localStorage.getItem("tasks");
    if (localTasksStr) {
      try {
        const parsed = JSON.parse(localTasksStr) as Task[];
        const withOrder = parsed.map((t, idx) => ({
          ...t,
          order: t.order !== undefined ? t.order : idx,
        }));
        setTasks(withOrder);
      } catch (err) {
        setTasks(INITIAL_TASKS);
      }
    } else {
      setTasks(INITIAL_TASKS);
      localStorage.setItem("tasks", JSON.stringify(INITIAL_TASKS));
    }
  }, []);

  // Persist tasks in localStorage + Sync with Cloud if enabled
  const saveTasksAndMaybeSync = useCallback(
    async (updatedTasks: Task[], forceCloudUpload = false) => {
      setTasks(updatedTasks);
      localStorage.setItem("tasks", JSON.stringify(updatedTasks));

      if (syncConfig.enabled && syncConfig.spaceId && syncConfig.passphrase) {
        setSyncConfig((prev) => ({ ...prev, status: "syncing" }));
        try {
          // Encrypt tasks list for E2EE cloud sync
          const encryptedTasks = await Promise.all(
            updatedTasks.map(async (t) => {
              const encryptedStr = await encryptData(JSON.stringify(t), syncConfig.passphrase);
              return {
                id: t.id,
                encryptedData: encryptedStr,
                updatedAt: t.createdAt, // Or completed timestamp
              };
            })
          );

          // Post to server
          const res = await fetch(`/api/sync/space/${syncConfig.spaceId}/update`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Client-ID": syncConfig.clientId,
            },
            body: JSON.stringify({ tasks: encryptedTasks }),
          });

          if (res.ok) {
            setSyncConfig((prev) => ({ ...prev, status: "success", lastSyncedAt: Date.now() }));
          } else {
            setSyncConfig((prev) => ({ ...prev, status: "error" }));
          }
        } catch (err) {
          console.error("Cloud sync fail:", err);
          setSyncConfig((prev) => ({ ...prev, status: "error" }));
        }
      }
    },
    [syncConfig]
  );

  // Synchronise when Sync configuration changes (E.g. when E2EE key is entered)
  useEffect(() => {
    localStorage.setItem("syncConfig", JSON.stringify(syncConfig));
  }, [syncConfig]);

  // Pull updates from the Cloud space
  const fetchAndDecryptFromCloud = useCallback(async () => {
    if (!syncConfig.enabled || !syncConfig.spaceId || !syncConfig.passphrase) return;

    setSyncConfig((prev) => ({ ...prev, status: "syncing" }));
    try {
      const res = await fetch(`/api/sync/space/${syncConfig.spaceId}`);
      if (!res.ok) {
        if (res.status === 404) {
          // Space is new/deleted, push current tasks to populate it
          saveTasksAndMaybeSync(tasks);
          return;
        }
        throw new Error("Failed to fetch space");
      }

      const spaceData = await res.json();
      const encryptedTasks = spaceData.tasks || [];

      // Decrypt each E2EE task
      const decrypted: Task[] = [];
      let decError = false;

      for (const t of encryptedTasks) {
        try {
          const plainStr = await decryptData(t.encryptedData, syncConfig.passphrase);
          const taskObj = JSON.parse(plainStr);
          decrypted.push(taskObj);
        } catch (err) {
          decError = true;
          console.error("Decrypt error on item", t.id, err);
        }
      }

      if (decError) {
        setSyncConfig((prev) => ({ ...prev, status: "error" }));
        triggerNotification("خطای کلید امنیتی", "رمزگشایی ابری با خطا مواجه شد. لطفاً کلید امنیتی را بررسی کنید.", "alarm");
        return;
      }

      // Sync Inbox shared tasks as well
      const inbox = spaceData.inbox || [];
      const decryptedInbox = [];
      for (const t of inbox) {
        try {
          const plainStr = await decryptData(t.encryptedData, syncConfig.passphrase);
          const taskObj = JSON.parse(plainStr);
          decryptedInbox.push({
            inboxId: t.id,
            senderSpaceId: t.senderSpaceId,
            sharedAt: t.sharedAt,
            task: taskObj,
          });
        } catch {
          // Ignore items with incompatible keys
        }
      }

      setSharedInbox(decryptedInbox);

      // Merge tasks (local vs cloud). For simple sync, cloud overwrites if cloud is newer
      // Or simply accept cloud state
      setTasks(decrypted);
      localStorage.setItem("tasks", JSON.stringify(decrypted));
      setSyncConfig((prev) => ({ ...prev, status: "success", lastSyncedAt: Date.now() }));
    } catch (err) {
      console.error("Fetch and decrypt failed:", err);
      setSyncConfig((prev) => ({ ...prev, status: "error" }));
    }
  }, [syncConfig.enabled, syncConfig.spaceId, syncConfig.passphrase, syncConfig.clientId, tasks, saveTasksAndMaybeSync]);

  // Real-time server SSE connections for multi-device synchronisation & instant shares
  useEffect(() => {
    if (!syncConfig.enabled || !syncConfig.spaceId) return;

    const sseUrl = `/api/sync/subscribe?spaceId=${syncConfig.spaceId}&clientId=${syncConfig.clientId}`;
    const sse = new EventSource(sseUrl);

    sse.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "sync") {
          // Cloud data updated by another device, pull immediately
          fetchAndDecryptFromCloud();
        } else if (data.type === "share") {
          // Direct real-time share notification from another device!
          playNotificationSound("receive");
          triggerNotification(
            "دریافت وظیفه جدید",
            `فعالیتی از طرف شناسه ${data.senderSpaceId} برای شما ارسال شد.`,
            "receive"
          );
          fetchAndDecryptFromCloud();
        }
      } catch (err) {
        console.error("SSE parsing error", err);
      }
    };

    sse.onerror = () => {
      setSyncConfig((prev) => ({ ...prev, status: "error" }));
    };

    // Perform initial pull on connect
    fetchAndDecryptFromCloud();

    return () => {
      sse.close();
    };
  }, [syncConfig.enabled, syncConfig.spaceId, syncConfig.passphrase]);

  // Trigger interactive visual and sound alarms for task reminders
  const triggerNotification = (title: string, message: string, soundType: "complete" | "alarm" | "receive" | "click") => {
    playNotificationSound(soundType);

    const newNotif: NotificationItem = {
      id: Math.random().toString(36).substring(7),
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setActiveToast({ id: newNotif.id, title, message });

    // Toast auto-closes
    setTimeout(() => {
      setActiveToast((prev) => (prev?.id === newNotif.id ? null : prev));
    }, 6000);
  };

  // Cron/Interval checking active tasks for hourly alarms/reminders (Personalized push alarm simulation)
  useEffect(() => {
    const checkReminders = () => {
      moment.loadPersian({ usePersianDigits: true, dialect: 'persian-modern' });
      const now = new Date();
      const todayStr = moment().format("jYYYY/jMM/jDD");
      const curHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      tasks.forEach((task) => {
        if (!task.completed && task.dueDate === todayStr && task.reminderTime === curHourMin) {
          const alarmId = `alarm-${task.id}-${curHourMin}`;
          if (!localStorage.getItem(alarmId)) {
            localStorage.setItem(alarmId, "fired");
            triggerNotification(
              "🔔 یادآوری وظیفه روزانه",
              `فعالیت شما «${task.title}» هم اکنون زمان انجام آن است!`,
              "alarm"
            );
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 12000); // Check every 12 seconds
    return () => clearInterval(interval);
  }, [tasks]);

  // Handler: Add a task
  const handleAddTask = (taskData: Omit<Task, "id" | "completed" | "createdAt" | "order">) => {
    const minOrder = tasks.length > 0 ? Math.min(...tasks.map((t) => t.order ?? 0)) : 0;
    const newTask: Task = {
      ...taskData,
      id: "task-" + Math.random().toString(36).substring(7),
      completed: false,
      createdAt: Date.now(),
      order: minOrder - 1,
    };
    const updated = [newTask, ...tasks];
    saveTasksAndMaybeSync(updated);
    triggerNotification("فعالیت جدید ثبت شد", `عنوان: ${newTask.title}`, "click");
  };

  // Handler: Add tasks extracted by AI
  const handleAITasksAdded = (newAITasks: any[]) => {
    const minOrder = tasks.length > 0 ? Math.min(...tasks.map((t) => t.order ?? 0)) : 0;

    const formatted: Task[] = newAITasks.map((t, idx) => ({
      id: "task-ai-" + Math.random().toString(36).substring(7),
      title: t.title,
      notes: t.notes || undefined,
      priority: t.priority || "medium",
      category: t.category || "شخصی",
      completed: false,
      createdAt: Date.now(),
      dueDate: t.dueDate || undefined,
      reminderTime: t.reminderTime || undefined,
      order: minOrder - 1 - idx,
    }));

    const updated = [...formatted, ...tasks];
    saveTasksAndMaybeSync(updated);
  };

  // Handler: Complete / Uncomplete task
  const handleToggleComplete = (id: string, e?: React.MouseEvent) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        if (nextCompleted) {
          playNotificationSound("complete");
          triggerNotification("تبریک! وظیفه انجام شد 🎉", `فعالیت «${t.title}» با موفقیت تیک خورد.`, "complete");

          // Trigger custom canvas-confetti particle explosion at click coordinates!
          const x = e ? e.clientX : window.innerWidth / 2;
          const y = e ? e.clientY : window.innerHeight / 1.5;
          window.dispatchEvent(new CustomEvent("trigger-confetti", { detail: { x, y } }));
        } else {
          playNotificationSound("click");
        }
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? Date.now() : undefined,
        };
      }
      return t;
    });
    saveTasksAndMaybeSync(updated);
  };

  // Handler: Update an edited task
  const handleUpdateTask = (updatedTask: Task) => {
    const updated = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t));
    saveTasksAndMaybeSync(updated);
    setEditingTask(null);
    triggerNotification("ویرایش انجام شد", `تغییرات فعالیت «${updatedTask.title}» ثبت گردید.`, "click");
  };

  // Handler: Delete task
  const handleDeleteTask = (id: string) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    const updated = tasks.filter((t) => t.id !== id);
    saveTasksAndMaybeSync(updated);
    triggerNotification("فعالیت حذف شد", `فعالیت «${taskToDelete?.title || ""}» با موفقیت حذف گردید.`, "click");
  };

  // Handler: Reorder tasks via Drag and Drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = filteredTasks.findIndex((t) => t.id === active.id);
    const overIndex = filteredTasks.findIndex((t) => t.id === over.id);

    if (activeIndex !== -1 && overIndex !== -1) {
      const reorderedFiltered = [...filteredTasks];
      const [movedItem] = reorderedFiltered.splice(activeIndex, 1);
      reorderedFiltered.splice(overIndex, 0, movedItem);

      // Get all order indices sorted ascending
      const orders = filteredTasks.map((t) => t.order ?? 0).sort((a, b) => a - b);
      const useIndexes = orders.length === 0;

      const updatedFiltered = reorderedFiltered.map((task, idx) => ({
        ...task,
        order: useIndexes ? idx : orders[idx],
      }));

      // Merge updated orders back into main tasks
      const updatedTasks = tasks.map((t) => {
        const found = updatedFiltered.find((ft) => ft.id === t.id);
        return found ? found : t;
      });

      saveTasksAndMaybeSync(updatedTasks);
      playNotificationSound("click");
    }
  };

  // Share Modal: Send encrypted task to target space
  const handleShareTask = async () => {
    if (!shareTargetTask || !shareTargetSpaceId.trim()) return;

    setShareStatus("sending");
    setShareError("");

    try {
      // Ensure E2EE key is configured
      if (!syncConfig.passphrase) {
        throw new Error("لطفاً ابتدا رمز عبور کلید امنیتی (E2EE) را در تنظیمات وارد کنید.");
      }

      // Encrypt the task data with the current passphrase
      const encryptedStr = await encryptData(JSON.stringify(shareTargetTask), syncConfig.passphrase);

      const res = await fetch(`/api/sync/space/${shareTargetSpaceId.trim().toUpperCase()}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderSpaceId: syncConfig.spaceId || "دستگاه فرستنده",
          encryptedData: encryptedStr,
          taskId: shareTargetTask.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShareStatus("success");
        triggerNotification("اشتراک‌گذاری موفق", `فعالیت با موفقیت برای شناسه ${shareTargetSpaceId} ارسال شد.`, "click");
        setTimeout(() => {
          setShareTargetTask(null);
          setShareTargetSpaceId("");
          setShareStatus("idle");
        }, 2000);
      } else {
        setShareStatus("error");
        setShareError(data.error || "خطا در برقراری ارتباط با فضا.");
      }
    } catch (err: any) {
      setShareStatus("error");
      setShareError(err.message || "بروز خطا در ارسال وظیفه.");
    }
  };

  // Inbox handler: Accept a shared task
  const handleAcceptShared = async (inboxItem: any) => {
    const minOrder = tasks.length > 0 ? Math.min(...tasks.map((t) => t.order ?? 0)) : 0;
    const taskToAdd: Task = {
      ...inboxItem.task,
      id: "task-shared-" + Math.random().toString(36).substring(7),
      createdAt: Date.now(),
      completed: false,
      completedAt: undefined,
      order: minOrder - 1,
    };

    const updated = [taskToAdd, ...tasks];
    saveTasksAndMaybeSync(updated);

    // Remove from Inbox on server
    try {
      await fetch(`/api/sync/space/${syncConfig.spaceId}/inbox/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: inboxItem.inboxId }),
      });
    } catch (err) {
      console.error("Error clearing inbox item:", err);
    }

    setSharedInbox((prev) => prev.filter((item) => item.inboxId !== inboxItem.inboxId));
    triggerNotification("پذیرش وظیفه", `وظیفه «${taskToAdd.title}» به لیست کارهای شما اضافه شد.`, "complete");
  };

  // Inbox handler: Reject a shared task
  const handleRejectShared = async (inboxItem: any) => {
    try {
      await fetch(`/api/sync/space/${syncConfig.spaceId}/inbox/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: inboxItem.inboxId }),
      });
    } catch (err) {
      console.error("Error clearing inbox item:", err);
    }

    setSharedInbox((prev) => prev.filter((item) => item.inboxId !== inboxItem.inboxId));
    triggerNotification("رد وظیفه", "وظیفه اشتراک‌گذاری شده حذف گردید.", "click");
  };

  // Filter tasks based on Search, Status, Priority, Category
  const filteredTasks = useMemo(() => {
    const list = tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "all" ? true : statusFilter === "completed" ? t.completed : !t.completed;

      const matchPriority = priorityFilter === "all" ? true : t.priority === priorityFilter;

      const matchCategory = categoryFilter === "all" ? true : t.category === categoryFilter;

      return matchSearch && matchStatus && matchPriority && matchCategory;
    });

    return [...list].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return b.createdAt - a.createdAt;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  const activeCount = tasks.filter((t) => !t.completed).length;

  if (!loggedInUser) {
    return (
      <div
        dir="rtl"
        className={`min-h-screen font-sans transition-colors duration-300 ${
          theme === "dark" ? "bg-gradient-to-br from-nat-dark-bg to-[#252520] text-gray-100" : "bg-gradient-to-br from-nat-bg to-[#eae6d8] text-nat-dark"
        }`}
      >
        <LoginScreen
          onLogin={(username, spaceId) => {
            setLoggedInUser(username);
            localStorage.setItem("loggedInUser", username);
            if (spaceId) {
              setSyncConfig((prev) => {
                const updated = {
                  ...prev,
                  enabled: true,
                  spaceId,
                  passphrase: `${username}-secret`,
                  status: "success" as const,
                };
                localStorage.setItem("syncConfig", JSON.stringify(updated));
                return updated;
              });
            }
          }}
          isDark={theme === "dark"}
        />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen font-sans transition-colors duration-300 ${
        theme === "dark" ? "bg-gradient-to-br from-nat-dark-bg to-[#252520] text-gray-100" : "bg-gradient-to-br from-nat-bg to-[#eae6d8] text-nat-dark"
      }`}
    >
      {/* Canvas-based Confetti Explosion Overlay */}
      <ConfettiCanvas />
      {/* Real-time Push Alert Banner (Fades in on triggers) */}
      {activeToast && (
        <div className="fixed top-5 left-5 right-5 md:left-auto md:w-96 z-50 animate-bounce">
          <div className="bg-nat-primary dark:bg-nat-dark-primary text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-nat-border dark:border-nat-dark-border">
            <Bell className="w-6 h-6 flex-shrink-0 animate-pulse mt-0.5" />
            <div className="flex-1">
              <h5 className="font-bold text-sm">{activeToast.title}</h5>
              <p className="text-xs text-indigo-100 mt-1">{activeToast.message}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-indigo-200 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Header Layout */}
      <header
        className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
          theme === "dark" ? "bg-nat-dark-sidebar/80 border-nat-dark-border" : "bg-nat-sidebar/80 border-nat-border shadow-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 relative">
              <div className="absolute inset-0.5 rounded-xl border border-white/10" />
              <svg className="w-6 h-6 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M25 75 L45 30 L55 30 L75 75" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40 60 H60" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M50 75 L62 87 L90 50" stroke="#34D399" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold tracking-tight font-serif italic text-nat-primary dark:text-nat-dark-primary">آراددو (AradDo)</h1>
              <p className="text-[10px] text-nat-muted dark:text-nat-dark-muted">سلام {loggedInUser} عزیز • مدیریت وظایف با رمزنگاری E2EE</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live UTC/Local Digital Clock */}
            <div className="hidden sm:flex flex-col text-left px-3 py-1 border border-nat-border dark:border-nat-dark-border rounded-xl bg-nat-sidebar/20 dark:bg-nat-dark-sidebar/20 font-mono text-xs text-nat-primary dark:text-nat-dark-primary font-medium">
              <span className="text-[9px] text-nat-muted dark:text-nat-dark-muted">زمان فعلی دستگاه</span>
              <span>{currentTime || "--:--:--"}</span>
            </div>

            {/* Interactive Logout Door Animation Button */}
            <LogoutButton
              onLogout={() => {
                setLoggedInUser(null);
                localStorage.removeItem("loggedInUser");
                localStorage.removeItem("syncConfig");
                localStorage.removeItem("tasks");
                setTasks([]);
                setSyncConfig({
                  enabled: false,
                  spaceId: "",
                  passphrase: "",
                  clientId: Math.random().toString(36).substring(7),
                  status: "idle",
                });
              }}
              isDark={theme === "dark"}
            />

            {/* Dark/Light mode switcher */}
            <button
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                playNotificationSound("click");
              }}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                theme === "dark"
                  ? "bg-nat-dark-sidebar border-nat-dark-border text-amber-400 hover:bg-nat-dark-card"
                  : "bg-nat-bg border-nat-border text-nat-primary hover:bg-nat-sidebar"
              }`}
              title={theme === "dark" ? "حالت روز" : "حالت شب"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar Area: Forms & Controls (Left Column, spans 5 cols) */}
          <div className="lg:col-span-5 space-y-6">

            {/* AI Smart Task & File Extractor Planner */}
            <AISmartCreator
              onTasksAdded={handleAITasksAdded}
              triggerNotification={triggerNotification}
              theme={theme}
            />

            {/* Task Form (Adding / Editing) */}
            <TaskForm
              onAddTask={handleAddTask}
              editingTask={editingTask}
              onUpdateTask={handleUpdateTask}
              onCancelEdit={() => setEditingTask(null)}
              theme={theme}
              categories={categories}
              setCategories={setCategories}
            />

            {/* Cloud Sync & Security Settings */}
            <SyncSettings
              syncConfig={syncConfig}
              setSyncConfig={setSyncConfig}
              onManualSync={fetchAndDecryptFromCloud}
              theme={theme}
            />

            {/* Weekly Analytical Progress Chart */}
            <WeeklyChart tasks={tasks} theme={theme} />

          </div>

          {/* Task Operations Area (Right Column, spans 7 cols) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Interactive Search & Filter Deck */}
            <div
              className={`p-5 rounded-2xl border backdrop-blur-xl transition-all ${
                theme === "dark" ? "bg-nat-dark-card border-nat-dark-border" : "bg-nat-card border-nat-border shadow-lg"
              }`}
            >
              <div className="flex flex-col gap-4">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-nat-muted" />
                  <input
                    type="text"
                    placeholder="جستجو در میان فعالیت‌ها و یادداشت‌ها..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full pr-10 pl-4 py-3 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary transition-all ${
                      theme === "dark" ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
                    }`}
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                  {/* Status buttons */}
                  <div className="flex bg-nat-sidebar/20 dark:bg-nat-dark-sidebar/20 p-1 rounded-xl border border-nat-border dark:border-nat-dark-border">
                    {(["all", "active", "completed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setStatusFilter(s);
                          playNotificationSound("click");
                        }}
                        className={`px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          statusFilter === s
                            ? "bg-nat-primary dark:bg-nat-dark-primary text-white"
                            : "text-nat-muted dark:text-nat-dark-muted hover:text-nat-primary dark:hover:text-nat-dark-primary"
                        }`}
                      >
                        {s === "all" ? "همه" : s === "active" ? "فعال" : "تکمیل شده"}
                      </button>
                    ))}
                  </div>

                  {/* Priority dropdown */}
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-nat-primary ${
                      theme === "dark" ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
                    }`}
                  >
                    <option value="all">اولویت: همه</option>
                    <option value="high">اولویت: بالا</option>
                    <option value="medium">اولویت: متوسط</option>
                    <option value="low">اولویت: پایین</option>
                  </select>

                  {/* Category Filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-nat-primary ${
                      theme === "dark" ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
                    }`}
                  >
                    <option value="all">دسته‌بندی: همه</option>
                    {uniqueCategories
                      .filter((c) => c !== "all")
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Direct P2P Shares Inbox Alert Section */}
            {sharedInbox.length > 0 && (
              <div className="bg-nat-sidebar/40 dark:bg-nat-dark-sidebar/40 border border-nat-border dark:border-nat-dark-border rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-nat-primary dark:text-nat-dark-primary flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  صندوق دریافت کارهای اشتراک‌گذاری شده ({sharedInbox.length})
                </h4>
                <div className="space-y-3">
                  {sharedInbox.map((item) => (
                    <div
                      key={item.inboxId}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        theme === "dark" ? "bg-nat-dark-card border-nat-dark-border" : "bg-nat-card border-nat-border shadow-lg"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] text-nat-muted dark:text-nat-dark-muted block mb-1">
                          فرستنده: <span className="font-mono text-nat-primary dark:text-nat-dark-primary">{item.senderSpaceId}</span>
                        </span>
                        <h5 className="text-xs sm:text-sm font-semibold">{item.task?.title}</h5>
                        {item.task?.notes && (
                          <p className="text-[11px] text-nat-muted dark:text-nat-dark-muted mt-1">{item.task.notes}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nat-sidebar/50 dark:bg-nat-dark-sidebar/50 text-nat-muted dark:text-nat-dark-muted">
                            دسته‌بندی: {item.task?.category}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nat-sidebar/50 dark:bg-nat-dark-sidebar/50 text-nat-muted dark:text-nat-dark-muted">
                            اولویت: {item.task?.priority === "high" ? "بالا" : item.task?.priority === "medium" ? "متوسط" : "پایین"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleAcceptShared(item)}
                          className="px-3 py-1.5 bg-nat-primary dark:bg-nat-dark-primary hover:opacity-90 text-white text-[10px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer"
                        >
                          پذیرش کار
                        </button>
                        <button
                          onClick={() => handleRejectShared(item)}
                          className={`px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-colors border cursor-pointer ${
                            theme === "dark"
                              ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-gray-400"
                              : "border-nat-border hover:bg-nat-sidebar text-gray-500"
                          }`}
                        >
                          رد کردن
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Cards Deck */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-nat-muted dark:text-nat-dark-muted font-semibold">
                  نمایش {filteredTasks.length} از {tasks.length} فعالیت روزانه
                </span>
                {activeCount > 0 && (
                  <span className="text-[10px] bg-nat-primary/10 text-nat-primary dark:text-nat-dark-primary px-2.5 py-1 rounded-full font-bold">
                    {activeCount} کار انجام نشده باقی مانده
                  </span>
                )}
              </div>

              {filteredTasks.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-nat-border dark:border-nat-dark-border rounded-3xl">
                  <Inbox className="w-12 h-12 text-nat-muted mx-auto mb-3" />
                  <p className="text-sm text-nat-muted dark:text-nat-dark-muted">هیچ فعالیتی یافت نشد.</p>
                  <p className="text-[11px] text-nat-muted dark:text-nat-dark-muted mt-1">با فرم سمت چپ می‌توانید کارهای امروز خود را ثبت کنید.</p>
                </div>
              ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {filteredTasks.map((task) => (
                        <SortableTaskItem
                          key={task.id}
                          task={task}
                          theme={theme}
                          handleToggleComplete={handleToggleComplete}
                          setShareTargetTask={setShareTargetTask}
                          setShareStatus={setShareStatus}
                          setShareError={setShareError}
                          setEditingTask={setEditingTask}
                          handleDeleteTask={handleDeleteTask}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Notification logs history */}
            {notifications.length > 0 && (
              <div
                className={`p-5 rounded-2xl border backdrop-blur-xl transition-all ${
                  theme === "dark" ? "bg-nat-dark-card border-nat-dark-border" : "bg-nat-card border-nat-border shadow-lg"
                }`}
              >
                <h4 className="text-xs font-bold text-nat-muted dark:text-nat-dark-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-nat-primary dark:text-nat-dark-primary" />
                  تاریخچه اعلان‌ها و هشدارهای دریافتی
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2.5 pr-1">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="text-xs flex items-start gap-2 border-b border-gray-700/10 dark:border-gray-800/40 pb-2 last:border-none"
                    >
                      <span className="text-[10px] text-nat-muted dark:text-nat-dark-muted font-mono mt-0.5">
                        {new Date(notif.timestamp).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <div className="flex-1">
                        <strong className="text-gray-200 dark:text-gray-100 block font-semibold">{notif.title}</strong>
                        <p className="text-[11px] text-nat-muted dark:text-nat-dark-muted mt-0.5">{notif.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* Share Modal Dialog */}
      {shareTargetTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl backdrop-blur-2xl transition-all ${
              theme === "dark" ? "bg-nat-dark-card border-nat-dark-border text-gray-100" : "bg-nat-card border-nat-border text-nat-dark"
            }`}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/10 dark:border-gray-800">
              <h3 className="text-md font-bold flex items-center gap-2 text-nat-primary dark:text-nat-dark-primary font-serif italic">
                <Send className="w-5 h-5" />
                اشتراک‌گذاری فعالیت (E2EE)
              </h3>
              <button
                onClick={() => setShareTargetTask(null)}
                className="p-1.5 hover:bg-nat-hover/20 dark:hover:bg-nat-dark-sidebar/40 rounded-lg text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-nat-sidebar/40 dark:bg-nat-dark-sidebar/40 border border-nat-border dark:border-nat-dark-border">
                <span className="text-[10px] text-nat-muted dark:text-nat-dark-muted block mb-0.5">فعالیت انتخابی شما:</span>
                <span className="text-sm font-bold text-nat-primary dark:text-nat-dark-primary">{shareTargetTask.title}</span>
                {shareTargetTask.notes && (
                  <p className="text-xs text-nat-muted dark:text-nat-dark-muted mt-1 truncate">{shareTargetTask.notes}</p>
                )}
              </div>

              {shareError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {shareError}
                </div>
              )}

              {shareStatus === "success" && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  فعالیت با موفقیت ارسال شد!
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-nat-muted dark:text-nat-dark-muted font-medium">کد فضای مقصد (Recipient Space ID)</label>
                <input
                  type="text"
                  placeholder="SPACE-XXXX-XXXX"
                  value={shareTargetSpaceId}
                  onChange={(e) => setShareTargetSpaceId(e.target.value)}
                  disabled={shareStatus === "sending" || shareStatus === "success"}
                  className={`w-full px-4 py-2.5 text-center text-sm font-mono tracking-wider rounded-xl border focus:outline-none focus:ring-2 focus:ring-nat-primary uppercase ${
                    theme === "dark" ? "bg-nat-dark-sidebar border-nat-dark-border text-white" : "bg-nat-bg border-nat-border text-nat-dark"
                  }`}
                />
                <p className="text-[10px] text-nat-muted dark:text-nat-dark-muted leading-relaxed mt-1">
                  * فعالیت شما با استفاده از رمز عبور کلید امنیتی (E2EE) شما کاملاً رمزگذاری شده و فرستاده می‌شود. دریافت‌کننده باید همان رمز عبور امنیتی را در تنظیمات خود داشته باشد تا بتواند آن را رمزگشایی و مشاهده کند.
                </p>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShareTargetTask(null)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    theme === "dark"
                      ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-gray-300"
                      : "border-nat-border hover:bg-nat-sidebar text-gray-600"
                  }`}
                >
                  انصراف
                </button>
                <button
                  onClick={handleShareTask}
                  disabled={shareStatus === "sending" || shareStatus === "success" || !shareTargetSpaceId.trim()}
                  className="px-5 py-2 bg-nat-primary dark:bg-nat-dark-primary hover:opacity-90 disabled:bg-gray-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {shareStatus === "sending" ? "درحال ارسال..." : "ارسال وظیفه"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Humble Footer info credit line */}
      <footer
        className={`border-t py-6 text-center text-[11px] transition-colors ${
          theme === "dark" ? "border-nat-dark-border text-nat-dark-muted bg-nat-dark-sidebar/20" : "border-nat-border text-nat-muted bg-nat-sidebar/20"
        }`}
      >
        <p>آراددو (AradDo) • پلتفرم ارگانیک مدیریت هوشمند وظایف با همگام‌سازی ابری و رمزنگاری سرتاسری AES-GCM</p>
      </footer>
    </div>
  );
}
