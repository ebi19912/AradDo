/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  category: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number; // Timestamp of completion (vital for weekly progress chart)
  dueDate?: string;     // YYYY-MM-DD format
  reminderTime?: string; // HH:MM format
  order?: number;        // Explicit drag-and-drop order index
}

export interface SyncConfig {
  enabled: boolean;
  spaceId: string;
  passphrase: string;
  clientId: string;
  status: "idle" | "syncing" | "error" | "success";
  lastSyncedAt?: number;
}

export type Theme = "light" | "dark";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  taskId?: string;
}
