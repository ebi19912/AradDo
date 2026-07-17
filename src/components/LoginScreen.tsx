import React, { useState, useEffect } from "react";
import { playNotificationSound } from "../utils/audio";
import { LogIn, Sparkles, User, Lock, Heart, Shield, Eye, EyeOff, KeyRound, Check, HelpCircle } from "lucide-react";

interface LoginScreenProps {
  onLogin: (username: string, spaceId?: string) => void;
  isDark: boolean;
}

function getPasswordStrength(pass: string) {
  if (!pass) {
    return {
      entropy: 0,
      level: 0,
      label: "هیچ رمزی وارد نشده است",
      crackedIn: "ورود بدون امنیت",
      color: "text-stone-400 dark:text-stone-500",
      progress: 0,
    };
  }

  let pool = 0;
  if (/[a-z]/.test(pass)) pool += 26;
  if (/[A-Z]/.test(pass)) pool += 26;
  if (/[0-9]/.test(pass)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pass)) pool += 32;

  const entropy = Math.round(pass.length * Math.log2(pool || 1));

  if (entropy < 16) {
    return {
      entropy,
      level: 0,
      label: "سنجاق سر خمیده (Paperclip)",
      crackedIn: "کشف و نفوذ در لحظه (بسیار ضعیف)",
      color: "text-red-500 dark:text-red-400",
      progress: 25,
    };
  } else if (entropy < 41) {
    return {
      entropy,
      level: 1,
      label: "قفل آویز چمدان (Padlock)",
      crackedIn: "کشف در کمتر از ۲ ثانیه (ضعیف)",
      color: "text-amber-500 dark:text-amber-400",
      progress: 50,
    };
  } else if (entropy < 61) {
    return {
      entropy,
      level: 2,
      label: "قفل شب‌بند فولادی (Deadbolt)",
      crackedIn: "کشف در حدود ۵ روز (ایمن و مناسب)",
      color: "text-blue-500 dark:text-blue-400",
      progress: 75,
    };
  } else {
    return {
      entropy,
      level: 3,
      label: "درب گاوصندوق بزرگ بانکی (Bank Vault)",
      crackedIn: "کشف در ۳ هزار سال! (فوق‌العاده امن)",
      color: "text-emerald-500 dark:text-emerald-400",
      progress: 100,
    };
  }
}

export default function LoginScreen({ onLogin, isDark }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [walkerLeft, setWalkerLeft] = useState(-20); // starts outside left of door (-20px)
  const [walkerOpacity, setWalkerOpacity] = useState(0);
  const [greeting, setGreeting] = useState("خوش آمدید");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const strength = getPasswordStrength(password);

  // Determine smart greeting based on local hour
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 11) {
      setGreeting("صبح زیبایتان بخیر");
    } else if (hour < 15) {
      setGreeting("ظهر بخیر و شادکامی");
    } else if (hour < 19) {
      setGreeting("عصر بخیر و آرامش");
    } else {
      setGreeting("شب خوش و آرام");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("لطفاً نام کاربری خود را وارد کنید");
      return;
    }
    if (!password) {
      setError("لطفاً گذرواژه خود را وارد کنید");
      return;
    }
    setError("");
    setSuccess("");
    if (isAnimating) return;

    try {
      const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "خطایی در برقراری ارتباط رخ داد.");
        playNotificationSound("alarm");
        return;
      }

      // Success
      if (isRegisterMode) {
        setSuccess("حساب کاربری با موفقیت ساخته شد! درحال بارگذاری...");
      }
      setIsAnimating(true);
      playNotificationSound("click");

      // Start timeline animation
      setDoorOpen(true);

      setTimeout(() => {
        setIsWalking(true);
        setWalkerOpacity(1);
        setWalkerLeft(6); // walk inside door center (6px)
      }, 250);

      setTimeout(() => {
        setWalkerOpacity(0);
      }, 1100);

      setTimeout(() => {
        setDoorOpen(false);
        setIsWalking(false);
      }, 1350);

      setTimeout(() => {
        playNotificationSound("complete");
        onLogin(data.username, data.spaceId);
      }, 1800);

    } catch (err) {
      setError("سیستم با اختلال مواجه شد. لطفاً دوباره تلاش کنید.");
      playNotificationSound("alarm");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden select-none bg-gradient-to-br from-indigo-50/30 to-purple-50/30 dark:from-stone-900 dark:to-indigo-950/30">
      {/* Self-contained CSS for animations */}
      <style>{`
        @keyframes thighF {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
        @keyframes thighB {
          0%, 100% { transform: rotate(30deg); }
          50% { transform: rotate(-30deg); }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(4deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-6deg); }
        }
        @keyframes glow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }
        .animate-float-slow {
          animation: float-slow 12s infinite ease-in-out;
        }
        .animate-float-medium {
          animation: float-medium 8s infinite ease-in-out;
        }
        .animate-glow-pulse {
          animation: glow-pulse 6s infinite ease-in-out;
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s infinite ease-in-out;
        }
        .animate-wiggle {
          animation: wiggle 0.5s infinite ease-in-out;
        }
        .leg-front-anim {
          animation: thighF 0.35s infinite linear;
        }
        .leg-back-anim {
          animation: thighB 0.35s infinite linear;
        }
        .bob-anim {
          animation: bob 0.35s infinite ease-in-out;
        }
      `}</style>

      {/* Cinematic Background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-indigo-500/10 to-transparent blur-[80px] pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-purple-500/5 to-transparent blur-[100px] pointer-events-none animate-glow-pulse" style={{ animationDelay: "2s" }} />

      {/* Floating Organic Elements */}
      <div className="absolute top-[15%] left-[10%] w-8 h-8 rounded-tr-3xl rounded-bl-3xl bg-indigo-500/10 border border-indigo-500/10 animate-float-slow pointer-events-none" />
      <div className="absolute bottom-[20%] right-[12%] w-6 h-6 rounded-tl-3xl rounded-br-3xl bg-purple-500/10 border border-purple-500/5 animate-float-medium pointer-events-none" style={{ animationDelay: "1.5s" }} />

      <div className="w-full max-w-md relative z-10 my-8">
        <div
          id="login-card"
          className={`p-6 sm:p-8 rounded-3xl border shadow-2xl backdrop-blur-md transition-all duration-500 ${
            isDark
              ? "bg-stone-900/90 border-stone-800 text-gray-200"
              : "bg-white/95 border-stone-200 text-stone-900"
          }`}
        >
          {/* Brand Identity / App Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 mb-4 animate-float-medium relative">
              {/* Outer stylish ring */}
              <div className="absolute inset-0.5 rounded-2xl border border-white/20" />
              <svg className="w-10 h-10 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Minimalist 'A' + Checkmark combined icon */}
                <path d="M25 75 L45 30 L55 30 L75 75" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M40 60 H60" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                {/* Overlaid vibrant checkmark */}
                <path d="M50 75 L62 87 L90 50" stroke="#34D399" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold tracking-tight font-serif italic text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              آراددو • AradDo
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
              {greeting} • فضای آرام‌بخش و ایمن مدیریت کارهای شما
            </p>
          </div>

          {/* Registration / Login Mode Tabs */}
          <div className="grid grid-cols-2 p-1 gap-1 mb-6 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              disabled={isAnimating}
              onClick={() => {
                setIsRegisterMode(false);
                setError("");
                setSuccess("");
                playNotificationSound("click");
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                !isRegisterMode
                  ? "bg-white dark:bg-stone-700 text-indigo-600 dark:text-white shadow-sm"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              }`}
            >
              ورود به حساب
            </button>
            <button
              type="button"
              disabled={isAnimating}
              onClick={() => {
                setIsRegisterMode(true);
                setError("");
                setSuccess("");
                playNotificationSound("click");
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                isRegisterMode
                  ? "bg-white dark:bg-stone-700 text-indigo-600 dark:text-white shadow-sm"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              }`}
            >
              ثبت نام حساب جدید
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl text-center leading-relaxed">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl text-center leading-relaxed">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input with Animated Container */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                نام یا نام کاربری شما
              </label>
              <input
                type="text"
                placeholder="مثال: sohrab_sepehri"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError("");
                }}
                disabled={isAnimating}
                className={`w-full px-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  isDark
                    ? "bg-stone-800 border-stone-700 text-white focus:bg-stone-800/40"
                    : "bg-stone-50 border-stone-200 text-stone-900 focus:bg-white"
                }`}
              />
            </div>

            {/* Password Input with Visibility Switch */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                {isRegisterMode ? "گذرواژه امنیتی جدید" : "گذرواژه حساب کاربری"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="رمز عبور خود را وارد کنید..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={isAnimating}
                  className={`w-full px-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all pl-10 ${
                    isDark
                      ? "bg-stone-800 border-stone-700 text-white focus:bg-stone-800/40"
                      : "bg-stone-50 border-stone-200 text-stone-900 focus:bg-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* --- SIGNATURE VAULT PASSWORD STRENGTH ANIMATION PANEL --- */}
            {password && (
              <div className="p-4 rounded-2xl border bg-stone-50/50 dark:bg-stone-800/30 border-stone-200/60 dark:border-stone-700/60 space-y-3 transition-all duration-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                    سطح قفل امنیتی:
                  </span>
                  <span className={`font-bold transition-colors ${strength.color}`}>
                    {strength.label}
                  </span>
                </div>

                {/* Animated progress bar */}
                <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-amber-500 via-blue-500 to-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${strength.progress}%` }}
                  />
                </div>

                {/* Estimation and entropy */}
                <div className="flex justify-between items-center text-[10px] text-stone-400 dark:text-stone-500">
                  <span>آنتروپی کلید: {strength.entropy} بیت</span>
                  <span className={`font-semibold ${strength.color}`}>{strength.crackedIn}</span>
                </div>

                {/* Interactive Animated Locks Sandbox (inspired by the referenced Video) */}
                <div className="pt-2 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 mb-2">شبیه‌ساز سه‌بعدی مکانیسم قفل امنیتی</span>

                  {/* Lock Showcase Stage */}
                  <div className="w-full h-28 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center bg-stone-100/50 dark:bg-stone-950/20 relative overflow-hidden">

                    {/* Level 0: Paperclip wiggles unstable */}
                    {strength.level === 0 && (
                      <div className="flex flex-col items-center gap-1 animate-wiggle text-red-500">
                        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M6 3v12a6 6 0 0 0 12 0V8a4 4 0 0 0-8 0v7a2 2 0 0 0 4 0V8" />
                        </svg>
                        <span className="text-[9px] font-bold">بدون ایمنی • کاغذ گیره سیمی</span>
                      </div>
                    )}

                    {/* Level 1: Padlock clicks shut */}
                    {strength.level === 1 && (
                      <div className="flex flex-col items-center gap-1 text-amber-500">
                        <svg className="w-12 h-12 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                          <path d="M12 15V17" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                        <span className="text-[9px] font-bold">قفل آویز آسیب‌پذیر</span>
                      </div>
                    )}

                    {/* Level 2: Deadbolt slides robustly */}
                    {strength.level === 2 && (
                      <div className="flex flex-col items-center gap-1 text-blue-500">
                        <svg className="w-14 h-12 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="6" width="18" height="12" rx="2" />
                          <rect x="10" y="10" width="8" height="4" fill="currentColor" opacity="0.8" className="animate-pulse" />
                          <circle cx="7" cy="12" r="1.5" fill="currentColor" />
                        </svg>
                        <span className="text-[9px] font-bold">قفل شب‌بند فولادی نیمه‌سنگین</span>
                      </div>
                    )}

                    {/* Level 3: Bank Vault massive wheel rotating */}
                    {strength.level === 3 && (
                      <div className="flex flex-col items-center gap-1 text-emerald-500">
                        <svg
                          className="w-14 h-14"
                          style={{
                            transform: `rotate(${password.length * 36}deg)`,
                            transition: "transform 150ms ease-out"
                          }}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="12" r="3" />
                          <line x1="12" y1="3" x2="12" y2="9" />
                          <line x1="12" y1="15" x2="12" y2="21" />
                          <line x1="3" y1="12" x2="9" y2="12" />
                          <line x1="15" y1="12" x2="21" y2="12" />
                          <circle cx="12" cy="6" r="1" fill="currentColor" />
                          <circle cx="12" cy="18" r="1" fill="currentColor" />
                          <circle cx="6" cy="12" r="1" fill="currentColor" />
                          <circle cx="18" cy="12" r="1" fill="currentColor" />
                        </svg>
                        <span className="text-[9px] font-bold animate-pulse">گاوصندوق بانکی فوق‌امنیتی فعال</span>
                      </div>
                    )}
                  </div>

                  {/* Vault Lock Matrix Indicators */}
                  <div className="grid grid-cols-4 gap-1 w-full mt-2">
                    {["سنجاق", "قفل آویز", "شب‌بند", "خزانه‌بانک"].map((lName, idx) => (
                      <div
                        key={idx}
                        className={`py-1 rounded-md text-[9px] text-center border font-semibold ${
                          strength.level === idx
                            ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 scale-[1.02]"
                            : "bg-transparent border-stone-200 dark:border-stone-800 text-stone-400 opacity-50"
                        }`}
                      >
                        {lName}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Guidance Alert */}
            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              * آراددو از رمزنگاری سرتاسری AES-GCM پشتیبانی می‌کند. کارهای شما قبل از ارسال به ابر، با کلید اختصاصی مشتق شده از گذرواژه‌تان رمزگذاری می‌شوند و در حافظه محلی ذخیره می‌گردند.
            </div>

            {/* 3D DOOR ANIMATION LOGIN / REGISTER BUTTON */}
            <button
              type="submit"
              disabled={isAnimating}
              className={`w-full h-14 rounded-2xl relative overflow-visible flex items-center justify-between px-6 font-semibold text-white transition-all duration-300 select-none cursor-pointer group ${
                isAnimating
                  ? "bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 scale-[0.98] shadow-inner"
                  : "bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.99]"
              }`}
            >
              {/* Left Side: Label */}
              <div className="flex items-center gap-2">
                <LogIn className={`w-5 h-5 transition-transform duration-300 ${isAnimating ? "rotate-90 text-yellow-300" : ""}`} />
                <span className="text-xs sm:text-sm tracking-wide">
                  {isAnimating
                    ? isRegisterMode
                      ? "در حال ایجاد حساب..."
                      : "در حال بازگشایی گاوصندوق..."
                    : isRegisterMode
                    ? "ثبت نام و ایجاد فضای امنیتی"
                    : "ورود به فضای آرام آراددو / LOG IN"}
                </span>
              </div>

              {/* Right Side: 3D Door and walking character box */}
              <div
                className="relative w-8 h-10 flex items-center justify-center"
                style={{ perspective: "150px" }}
              >
                {/* Dark Inner Doorway */}
                <div className="absolute inset-0 bg-stone-950 rounded-[4px] border border-stone-800/50 overflow-hidden shadow-inner flex items-center justify-center">
                  <div className="w-full h-full bg-gradient-to-t from-yellow-500/30 via-indigo-500/5 to-transparent absolute inset-0" />
                </div>

                {/* The Walking Human Character */}
                <div
                  className={`absolute bottom-1 w-3 h-6 flex flex-col items-center transition-all ease-in-out`}
                  style={{
                    left: `${walkerLeft}px`,
                    opacity: walkerOpacity,
                    transitionDuration: "1200ms",
                  }}
                >
                  <div className={`flex flex-col items-center relative ${isWalking ? "bob-anim" : ""}`}>
                    <div className="w-1.5 h-1.5 bg-yellow-200 rounded-full shadow-sm" />
                    <div className="w-1.25 h-3.25 bg-white rounded-[1px] -mt-[1px] relative flex justify-center">
                      <div
                        className={`w-[1px] h-1.5 bg-indigo-200 absolute top-[3px] left-[1px] origin-top ${
                          isWalking ? "leg-front-anim" : ""
                        }`}
                      />
                      <div
                        className={`w-[1px] h-1.5 bg-indigo-300 absolute top-[3px] right-[1px] origin-top ${
                          isWalking ? "leg-back-anim" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* 3D Hinged Door Panel */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[4px] border border-indigo-400/40 shadow-md origin-right transition-transform duration-500 ease-in-out`}
                  style={{
                    transform: doorOpen ? "rotateY(75deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Door Handle */}
                  <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-1 h-1 bg-yellow-400 rounded-full shadow-sm border border-yellow-500/30" />
                </div>
              </div>
            </button>
          </form>

          {/* Secure details footer badge */}
          <div className="mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-center gap-5 text-[10px] text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              ضد هک AES-GCM
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              طراحی ارگانیک و پویا
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
