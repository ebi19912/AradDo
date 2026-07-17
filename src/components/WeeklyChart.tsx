/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Task } from "../types";
import { CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import moment from "moment-jalaali";

interface WeeklyChartProps {
  tasks: Task[];
  theme: "light" | "dark";
}

const PERSIAN_DAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
  "شنبه",
];

export default function WeeklyChart({ tasks, theme }: WeeklyChartProps) {
  const chartData = useMemo(() => {
    // Let's calculate the completion stats for the last 7 calendar days
    moment.loadPersian({ usePersianDigits: true, dialect: 'persian-modern' });
    const now = new Date();
    const daysData = Array.from({ length: 7 })
      .map((_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      })
      .map((date) => {
        const timestampStart = date.getTime();
        const timestampEnd = timestampStart + 24 * 60 * 60 * 1000;

        // Count tasks completed on this day
        const completedCount = tasks.filter((t) => {
          if (!t.completed || !t.completedAt) return false;
          return t.completedAt >= timestampStart && t.completedAt < timestampEnd;
        }).length;

        // Count total tasks created/due on or before this day and not completed, or completed on this day
        const totalActiveCount = tasks.filter((t) => {
          const createdBefore = t.createdAt < timestampEnd;
          if (!createdBefore) return false;
          if (!t.completed) return true;
          return t.completedAt && t.completedAt >= timestampStart;
        }).length;

        const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday...
        const label = PERSIAN_DAYS[dayIndex];
        const jm = moment(date);
        const shortDate = jm.format("jMM/jDD");

        return {
          label,
          shortDate,
          completed: completedCount,
          active: totalActiveCount,
          dateStr: jm.format("dddd"),
        };
      });

    return daysData;
  }, [tasks]);

  const stats = useMemo(() => {
    const totalCompleted = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Daily average
    const totalCompletedInLast7Days = chartData.reduce((sum, d) => sum + d.completed, 0);
    const dailyAverage = (totalCompletedInLast7Days / 7).toFixed(1);

    return {
      percentage,
      totalCompleted,
      dailyAverage,
    };
  }, [tasks, chartData]);

  const isDark = theme === "dark";

  return (
    <div
      id="weekly-chart-container"
      className={`p-5 rounded-2xl border transition-colors duration-300 ${
        isDark
          ? "bg-nat-dark-card border-nat-dark-border text-gray-200"
          : "bg-nat-card border-nat-border text-nat-dark shadow-sm"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 font-serif italic">
            <TrendingUp className="w-5 h-5 text-nat-primary dark:text-nat-dark-primary" />
            نمودار پیشرفت هفتگی
          </h3>
          <p className="text-xs text-nat-muted dark:text-nat-dark-muted mt-1">
            بررسی آماری عملکرد و وظایف تکمیل شده در ۷ روز گذشته
          </p>
        </div>

        <div className="flex gap-4">
          <div className="text-right">
            <span className="text-xs text-nat-muted dark:text-nat-dark-muted block">نرخ موفقیت</span>
            <span className="font-mono text-lg font-bold text-nat-primary dark:text-nat-dark-primary">
              %{stats.percentage}
            </span>
          </div>
          <div className="text-right border-r border-gray-700/20 pr-4">
            <span className="text-xs text-nat-muted dark:text-nat-dark-muted block">میانگین روزانه</span>
            <span className="font-mono text-lg font-bold text-nat-primary dark:text-nat-dark-primary">
              {stats.dailyAverage}
            </span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? "#3A3A31" : "#DCD9CE"}
            />
            <XAxis
              dataKey="label"
              stroke={isDark ? "#8E8E7D" : "#9A9A8A"}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={isDark ? "#8E8E7D" : "#9A9A8A"}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1D1D17" : "#FFFFFF",
                borderColor: isDark ? "#3A3A31" : "#DCD9CE",
                borderRadius: "12px",
                color: isDark ? "#EBE9E0" : "#2D2D24",
                direction: "rtl",
                textAlign: "right",
              }}
              labelFormatter={(label, items) => {
                const item = items[0]?.payload;
                return `${label} (${item?.shortDate || ""})`;
              }}
            />
            <Bar dataKey="completed" radius={[4, 4, 0, 0]} barSize={32}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.completed > 0 ? (isDark ? "#949472" : "#7C7C5F") : isDark ? "#26261F" : "#EBE9E0"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 items-center justify-between text-xs border-t border-gray-700/10 pt-4">
        <span className="flex items-center gap-1.5 text-nat-muted dark:text-nat-dark-muted">
          <Calendar className="w-4 h-4 text-nat-muted" />
          نمایش پویای پیشرفت
        </span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-nat-primary dark:bg-nat-dark-primary block"></span>
            تکمیل شده
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-nat-sidebar dark:bg-nat-dark-sidebar block"></span>
            بدون فعالیت
          </span>
        </div>
      </div>
    </div>
  );
}
