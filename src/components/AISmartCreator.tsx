import React, { useState, useRef } from "react";
import { Sparkles, Upload, FileText, Image as ImageIcon, Loader2, X, AlertCircle, CheckCircle } from "lucide-react";
import { Task, Theme } from "../types";
import { playNotificationSound } from "../utils/audio";
import moment from "moment-jalaali";

interface AISmartCreatorProps {
  onTasksAdded: (tasks: any[]) => void;
  triggerNotification: (title: string, message: string, soundType: "click" | "complete" | "alarm" | "receive") => void;
  theme: Theme;
}

export default function AISmartCreator({ onTasksAdded, triggerNotification, theme }: AISmartCreatorProps) {
  const isDark = theme === "dark";
  const [promptText, setPromptText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers for file upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMessage("");
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("فرمت فایل نامعتبر است. فقط تصویر (PNG, JPG) یا سند (PDF) مورد قبول است.");
      playNotificationSound("alarm");
      return;
    }
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("اندازه فایل بسیار بزرگ است. حداکثر حجم مجاز ۱۰ مگابایت است.");
      playNotificationSound("alarm");
      return;
    }
    setSelectedFile(file);
    playNotificationSound("click");
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    playNotificationSound("click");
  };

  // Convert File to Base64 String
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:mimeType;base64, prefix
        const base64Data = result.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSmartPlan = async () => {
    if (!promptText.trim() && !selectedFile) {
      setErrorMessage("لطفاً متنی بنویسید یا فایلی (عکس/PDF) بارگذاری کنید.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);
    playNotificationSound("click");

    moment.loadPersian({ usePersianDigits: true, dialect: 'persian-modern' });
    const todayContext = `امروز ${moment().format("jDD jMMMM jYYYY (dddd)")} است و زمان فعلی دستگاه ${new Date().toLocaleTimeString("fa-IR")} می‌باشد.`;

    try {
      let res;
      const authToken = localStorage.getItem("authToken") || "";
      if (selectedFile) {
        // File Upload Processing
        const base64Data = await fileToBase64(selectedFile);
        res = await fetch("/api/ai/upload-file", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
          body: JSON.stringify({
            base64: base64Data,
            mimeType: selectedFile.type,
            todayContext,
          }),
        });
      } else {
        // Natural Language Parsing
        res = await fetch("/api/ai/parse-task", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
          body: JSON.stringify({
            prompt: promptText.trim(),
            todayContext,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "خطایی در تحلیل هوش مصنوعی به وجود آمد.");
      }

      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        onTasksAdded(data.tasks);
        triggerNotification(
          "برنامه‌ریزی هوشمند انجام شد ✨",
          `موفقیت‌آمیز: تعداد ${data.tasks.length} فعالیت جدید توسط هوش مصنوعی برنامه‌ریزی و ثبت شد.`,
          "complete"
        );
        // Clear state
        setPromptText("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        throw new Error("هیچ فعالیتی از متن یا فایل شما استخراج نشد. لطفاً واضح‌تر بنویسید.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "بروز خطا در اتصال به سرویس هوش مصنوعی.");
      playNotificationSound("alarm");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="ai-smart-creator"
      className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        isDark
          ? "bg-stone-900 border-indigo-950/40 text-gray-200 shadow-lg shadow-indigo-950/10"
          : "bg-white border-indigo-100 text-stone-900 shadow-sm hover:shadow-md"
      }`}
    >
      {/* Aesthetic glowing ring or accent indicator */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-2xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-4 border-b border-stone-200/50 dark:border-stone-800/40 pb-3">
        <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
        <h3 className="text-sm sm:text-md font-bold text-indigo-600 dark:text-indigo-400 font-serif italic">
          برنامه‌ریزی هوشمند با هوش مصنوعی Gemini
        </h3>
      </div>

      {errorMessage && (
        <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Natural Language Prompt Area */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            تایپ گفتاری / متنی کارهای امروز
          </label>
          <textarea
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            disabled={isLoading || !!selectedFile}
            rows={2}
            placeholder="مثال: فردا ساعت ۱۰ صبح کتاب بخونم، جلسه فنی ساعت ۲ بعد از ظهر دوشنبه رو با اولویت بالا هماهنگ کن..."
            className={`w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all ${
              selectedFile
                ? "bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                : isDark
                ? "bg-stone-800 border-stone-700 text-white"
                : "bg-stone-50 border-stone-200 text-stone-900 focus:bg-white"
            }`}
          />
        </div>

        {/* OR Separator */}
        <div className="flex items-center gap-2 text-stone-400 dark:text-stone-500 text-[10px]">
          <div className="flex-1 h-[1px] bg-stone-200 dark:bg-stone-800" />
          <span>یا بارگذاری پرونده تصویری / PDF</span>
          <div className="flex-1 h-[1px] bg-stone-200 dark:bg-stone-800" />
        </div>

        {/* File Drag and Drop Zone */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleFileChange}
            disabled={isLoading || !!promptText.trim()}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                if (!isLoading && !promptText.trim()) fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                promptText.trim()
                  ? "border-stone-200 dark:border-stone-800 bg-stone-100/30 dark:bg-stone-900/10 cursor-not-allowed"
                  : dragActive
                  ? "border-indigo-500 bg-indigo-500/5"
                  : isDark
                  ? "border-stone-700 hover:border-indigo-500/50 bg-stone-800/40 hover:bg-stone-800/70"
                  : "border-stone-200 hover:border-indigo-400/50 bg-stone-50 hover:bg-stone-50/20"
              }`}
            >
              <Upload className={`w-7 h-7 ${promptText.trim() ? "text-stone-300 dark:text-stone-600" : "text-indigo-500"}`} />
              <div className="text-[11px] font-semibold">
                {promptText.trim() ? (
                  <span className="text-stone-400">تحلیل متنی فعال است (فایل قفل شد)</span>
                ) : (
                  <span>فایل را به اینجا بکشید یا برای انتخاب کلیک کنید</span>
                )}
              </div>
              <p className="text-[9px] text-stone-400 dark:text-stone-500">
                فرمت‌های مجاز: عکس (PNG, JPG) یا اسناد متنی (PDF) تا حداکثر ۱۰ مگابایت
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {selectedFile.type === "application/pdf" ? (
                  <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                )}
                <div className="text-xs font-semibold truncate text-stone-700 dark:text-stone-200">
                  {selectedFile.name}
                  <div className="text-[9px] text-stone-400 dark:text-stone-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} مگابایت
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={removeFile}
                className="p-1 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Submit action button */}
        <button
          type="button"
          onClick={handleSmartPlan}
          disabled={isLoading || (!promptText.trim() && !selectedFile)}
          className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isLoading || (!promptText.trim() && !selectedFile)
              ? "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/20 text-white active:scale-[0.98]"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>درحال استخراج و برنامه‌ریزی کارهای شما...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-yellow-200 animate-bounce" />
              <span>
                {selectedFile ? "تحلیل فایل و استخراج کارها" : "برنامه‌ریزی هوشمند با Gemini"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
