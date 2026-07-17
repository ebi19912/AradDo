/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { SyncConfig, Theme } from "../types";
import {
  Cloud,
  CloudOff,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Info,
  HelpCircle,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { getCryptoStatus } from "../utils/crypto";

interface SyncSettingsProps {
  syncConfig: SyncConfig;
  setSyncConfig: (config: SyncConfig) => void;
  onManualSync: () => void;
  theme: Theme;
}

export default function SyncSettings({
  syncConfig,
  setSyncConfig,
  onManualSync,
  theme,
}: SyncSettingsProps) {
  const isDark = theme === "dark";
  const [passphraseInput, setPassphraseInput] = useState(syncConfig.passphrase);
  const [spaceIdInput, setSpaceIdInput] = useState(syncConfig.spaceId);
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cryptoStatus = getCryptoStatus();

  const handleToggleSync = async () => {
    if (syncConfig.enabled) {
      // Disabling sync
      setSyncConfig({
        ...syncConfig,
        enabled: false,
        status: "idle",
      });
    } else {
      // Enabling sync requires at least a passphrase and space ID
      if (!passphraseInput.trim()) {
        setErrorMsg("لطفاً رمز عبور کلید امنیتی (E2EE) را وارد کنید.");
        return;
      }
      if (!spaceIdInput.trim()) {
        // Automatically generate a space ID
        try {
          const res = await fetch("/api/sync/create-space", { method: "POST" });
          const data = await res.json();
          if (data.success) {
            setSpaceIdInput(data.spaceId);
            setSyncConfig({
              ...syncConfig,
              enabled: true,
              spaceId: data.spaceId,
              passphrase: passphraseInput,
              status: "syncing",
            });
            setErrorMsg("");
          }
        } catch (err) {
          setErrorMsg("خطا در برقراری ارتباط با سرور ابری.");
        }
      } else {
        setSyncConfig({
          ...syncConfig,
          enabled: true,
          spaceId: spaceIdInput.trim().toUpperCase(),
          passphrase: passphraseInput,
          status: "syncing",
        });
        setErrorMsg("");
      }
    }
  };

  const handleGenerateNewSpace = async () => {
    try {
      const res = await fetch("/api/sync/create-space", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSpaceIdInput(data.spaceId);
        if (syncConfig.enabled) {
          setSyncConfig({
            ...syncConfig,
            spaceId: data.spaceId,
            status: "syncing",
          });
        }
      }
    } catch (err) {
      setErrorMsg("خطا در ایجاد فضای جدید ابری.");
    }
  };

  const handleCopySpaceId = () => {
    navigator.clipboard.writeText(syncConfig.spaceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = () => {
    if (!passphraseInput.trim()) {
      setErrorMsg("رمز عبور کلید امنیتی نمی‌تواند خالی باشد.");
      return;
    }
    if (!spaceIdInput.trim()) {
      setErrorMsg("شناسه همگام‌سازی نمی‌تواند خالی باشد.");
      return;
    }

    setSyncConfig({
      ...syncConfig,
      passphrase: passphraseInput,
      spaceId: spaceIdInput.trim().toUpperCase(),
      status: "syncing",
    });
    setErrorMsg("");
  };

  return (
    <div
      id="sync-settings-container"
      className={`p-6 rounded-2xl border transition-all duration-300 ${
        isDark
          ? "bg-nat-dark-card border-nat-dark-border text-gray-200"
          : "bg-nat-card border-nat-border text-nat-dark shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-5 border-b border-gray-700/10 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              syncConfig.enabled
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-gray-500/10 text-gray-400"
            }`}
          >
            {syncConfig.enabled ? (
              <Cloud className="w-5 h-5 animate-pulse text-nat-primary dark:text-nat-dark-primary" />
            ) : (
              <CloudOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-md font-semibold font-serif italic">همگام‌سازی ابری و امنیت سرتاسری (E2EE)</h3>
            <p className="text-xs text-nat-muted dark:text-nat-dark-muted mt-0.5">
              انتقال رمزگذاری شده و لحظه‌ای وظایف بین تمامی دستگاه‌ها
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleSync}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
            syncConfig.enabled ? "bg-nat-primary" : "bg-gray-300 dark:bg-nat-dark-sidebar"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              syncConfig.enabled ? "-translate-x-6" : "-translate-x-1"
            }`}
          />
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
          {errorMsg}
        </div>
      )}

      {!syncConfig.enabled ? (
        <div className="py-4 text-center">
          <p className="text-xs text-nat-muted dark:text-nat-dark-muted max-w-md mx-auto leading-relaxed mb-4">
            همگام‌سازی ابری را فعال کنید تا بتوانید وظایف خود را به صورت کاملاً رمزگذاری شده بین رایانه،
            تبلت و موبایل خود همگام کنید. با فعال‌سازی رمزنگاری سرتاسری، سرور نیز قادر به خواندن داده‌های شما نیست.
          </p>

          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            <input
              type="password"
              placeholder="کلید امنیتی (رمز عبور دلخواه برای رمزگذاری)"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm text-center focus:outline-none focus:ring-2 focus:ring-nat-primary ${
                isDark
                  ? "bg-nat-dark-sidebar border-nat-dark-border text-white"
                  : "bg-nat-bg border-nat-border text-nat-dark"
              }`}
            />
            <button
              onClick={handleToggleSync}
              className="w-full py-2.5 bg-nat-primary dark:bg-nat-dark-primary hover:opacity-90 active:scale-[0.98] text-white text-sm font-medium rounded-xl transition-all cursor-pointer"
            >
              فعال‌سازی همگام‌سازی ابری E2EE
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active Cloud Sync Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
                isDark ? "bg-nat-dark-sidebar/40 border-nat-dark-border" : "bg-nat-bg border-nat-border"
              }`}
            >
              <span className="text-xs text-nat-muted dark:text-nat-dark-muted flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                شناسه همگام‌سازی دستگاه (Space ID)
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-mono text-sm font-bold tracking-wider text-nat-primary dark:text-nat-dark-primary select-all">
                  {syncConfig.spaceId || "درحال صدور..."}
                </span>
                {syncConfig.spaceId && (
                  <button
                    onClick={handleCopySpaceId}
                    className="p-1 hover:bg-nat-hover/30 dark:hover:bg-nat-dark-sidebar/30 rounded transition-colors text-gray-400 hover:text-nat-primary dark:hover:text-nat-dark-primary cursor-pointer"
                    title="کپی شناسه"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-1 ${
                isDark ? "bg-nat-dark-sidebar/40 border-nat-dark-border" : "bg-nat-bg border-nat-border"
              }`}
            >
              <span className="text-xs text-nat-muted dark:text-nat-dark-muted flex items-center gap-1">
                <RefreshCw
                  className={`w-3.5 h-3.5 text-gray-500 ${
                    syncConfig.status === "syncing" ? "animate-spin text-nat-primary dark:text-nat-dark-primary" : ""
                  }`}
                />
                وضعیت همگام‌سازی ابری
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    syncConfig.status === "success"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : syncConfig.status === "syncing"
                      ? "bg-nat-primary/10 text-nat-primary dark:text-nat-dark-primary"
                      : syncConfig.status === "error"
                      ? "bg-rose-500/10 text-rose-500"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {syncConfig.status === "success"
                    ? "● همگام و متصل"
                    : syncConfig.status === "syncing"
                    ? "● در حال همگام‌سازی..."
                    : syncConfig.status === "error"
                    ? "● خطای ارتباط"
                    : "● آفلاین"}
                </span>

                <button
                  onClick={onManualSync}
                  className="text-xs font-semibold text-nat-primary dark:text-nat-dark-primary hover:opacity-80 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  بروزرسانی دستی
                </button>
              </div>
            </div>
          </div>

          {/* Key management & space join */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-nat-muted dark:text-nat-dark-muted uppercase tracking-wider">تنظیمات اتصال مجدد دستگاه‌ها</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-nat-muted dark:text-nat-dark-muted flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-gray-500" />
                  رمز عبور کلید امنیتی (E2EE Key)
                </label>
                <input
                  type="password"
                  placeholder="رمز عبور برای باز کردن قفل وظایف"
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  className={`px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-nat-primary ${
                    isDark
                      ? "bg-nat-dark-sidebar border-nat-dark-border text-white"
                      : "bg-nat-bg border-nat-border text-nat-dark"
                  }`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-nat-muted dark:text-nat-dark-muted flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                  اتصال به شناسه فضای مشترک دیگر
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="SPACE-XXXX-XXXX"
                    value={spaceIdInput}
                    onChange={(e) => setSpaceIdInput(e.target.value)}
                    className={`flex-1 px-3 py-2 text-xs font-mono uppercase rounded-xl border focus:outline-none focus:ring-1 focus:ring-nat-primary ${
                      isDark
                        ? "bg-nat-dark-sidebar border-nat-dark-border text-white"
                        : "bg-nat-bg border-nat-border text-nat-dark"
                    }`}
                  />
                  <button
                    onClick={handleGenerateNewSpace}
                    className={`px-3 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                      isDark
                        ? "border-nat-dark-border hover:bg-nat-dark-sidebar text-gray-300"
                        : "border-nat-border hover:bg-nat-sidebar text-gray-600"
                    }`}
                    title="ایجاد فضای جدید"
                  >
                    جدید
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-nat-primary dark:bg-nat-dark-primary hover:opacity-90 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                اعمال و همگام‌سازی کلید
              </button>
            </div>
          </div>

          {/* Security badge & brief explanation */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              isDark ? "bg-emerald-500/5 border-emerald-500/10" : "bg-emerald-500/5 border-emerald-500/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                    رمزنگاری سرتاسری فعال است
                  </span>
                  <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="text-nat-muted dark:text-nat-dark-muted hover:text-nat-primary dark:hover:text-nat-dark-primary text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showExplanation ? "بستن راهنما" : "توضیح بیشتر"}
                  </button>
                </div>
                <p className="text-xs text-nat-muted dark:text-nat-dark-muted leading-relaxed mt-1">
                  پروتکل فعال: <span className="font-mono text-emerald-400 font-medium">{cryptoStatus.method}</span>. تمامی عناوین و جزئیات وظایف شما قبل از خروج از مرورگر با کلید امنیتی شما رمزگذاری می‌شوند.
                </p>

                {showExplanation && (
                  <div className="mt-3 text-xs text-nat-muted dark:text-nat-dark-muted space-y-2 border-t border-emerald-500/10 pt-3 leading-relaxed">
                    <p>
                      <strong>رمزنگاری سرتاسری (E2EE) چیست؟</strong>
                      <br />
                      در این پلتفرم، ما از الگوریتم پیشرفته رمزنگاری متقارن AES-GCM 256 بیتی مرورگر شما استفاده می‌کنیم.
                      هنگامی که رمز عبوری را در کادر کلید امنیتی وارد می‌کنید، مرورگر با استفاده از تابع درهم‌ساز SHA-256 یک کلید رمزنگاری محلی تولید می‌کند.
                    </p>
                    <p>
                      <strong>چرا امنیت داده‌های شما تضمین شده است؟</strong>
                      <br />
                      ۱. رمز عبور کلید امنیتی شما هرگز به اینترنت یا سرور ما ارسال نمی‌شود.
                      <br />
                      ۲. سرور ابری ما فقط متن‌های نامفهوم رمزگذاری‌شده (Ciphertext) را ذخیره می‌کند.
                      <br />
                      ۳. برای اتصال موبایل یا دستگاه دیگر، کافیست همان شناسه فضا (Space ID) و رمز عبور را در آن دستگاه وارد کنید تا رمزگشایی کاملاً محلی انجام شود.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
