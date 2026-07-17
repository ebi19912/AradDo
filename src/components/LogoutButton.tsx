import React, { useState } from "react";
import { playNotificationSound } from "../utils/audio";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  onLogout: () => void;
  isDark: boolean;
}

export default function LogoutButton({ onLogout, isDark }: LogoutButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [walkerLeft, setWalkerLeft] = useState(6); // starts inside the door (6px)
  const [walkerOpacity, setWalkerOpacity] = useState(0);

  const handleLogoutClick = () => {
    if (isAnimating) return;

    setIsAnimating(true);
    playNotificationSound("click");

    // Timeline for logout:
    // 0ms: Open the door
    setDoorOpen(true);

    // 250ms: Character appears inside the door and starts walking out
    setTimeout(() => {
      setIsWalking(true);
      setWalkerOpacity(1);
      setWalkerLeft(-20); // walk outside (to -20px)
    }, 250);

    // 1100ms: Character completely out and fades away
    setTimeout(() => {
      setWalkerOpacity(0);
    }, 1100);

    // 1350ms: Close the door
    setTimeout(() => {
      setDoorOpen(false);
      setIsWalking(false);
    }, 1350);

    // 1800ms: Log out successfully
    setTimeout(() => {
      playNotificationSound("receive");
      onLogout();
      // Reset state for next time
      setIsAnimating(false);
      setWalkerLeft(6);
      setWalkerOpacity(0);
    }, 1800);
  };

  return (
    <button
      onClick={handleLogoutClick}
      disabled={isAnimating}
      className={`h-10 rounded-xl relative overflow-visible flex items-center justify-between px-4 font-semibold text-white transition-all duration-300 select-none cursor-pointer text-xs ${
        isAnimating
          ? "bg-gradient-to-r from-rose-700 to-red-700 scale-[0.98] shadow-inner"
          : "bg-gradient-to-r from-rose-500 to-red-600 hover:scale-[1.03] hover:shadow-md hover:shadow-rose-500/20 active:scale-[0.98]"
      }`}
      title="خروج از سیستم"
    >
      {/* Self-contained style block for animations (safe encapsulation) */}
      <style>{`
        @keyframes thighF_logout {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
        @keyframes thighB_logout {
          0%, 100% { transform: rotate(30deg); }
          50% { transform: rotate(-30deg); }
        }
        @keyframes bob_logout {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .leg-front-logout {
          animation: thighF_logout 0.35s infinite linear;
        }
        .leg-back-logout {
          animation: thighB_logout 0.35s infinite linear;
        }
        .bob-logout {
          animation: bob_logout 0.35s infinite ease-in-out;
        }
      `}</style>

      {/* Button Content */}
      <div className="flex items-center gap-1.5 pl-3">
        <LogOut className={`w-3.5 h-3.5 transition-transform duration-300 ${isAnimating ? "rotate-180 text-rose-200" : ""}`} />
        <span>{isAnimating ? "خروج..." : "خروج / Log Out"}</span>
      </div>

      {/* 3D Doorway box */}
      <div
        className="relative w-6 h-8 flex items-center justify-center mr-1"
        style={{ perspective: "100px" }}
      >
        {/* Dark Inside Doorway */}
        <div className="absolute inset-0 bg-stone-950 rounded-[3px] border border-stone-800/40 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Glowing inner door light */}
          <div className="w-full h-full bg-gradient-to-t from-yellow-500/20 via-rose-500/5 to-transparent absolute inset-0" />
        </div>

        {/* The Walking Human Character */}
        <div
          className="absolute bottom-0.5 w-2.5 h-5 flex flex-col items-center transition-all ease-in-out"
          style={{
            left: `${walkerLeft}px`,
            opacity: walkerOpacity,
            transitionDuration: "1200ms",
          }}
        >
          <div className={`flex flex-col items-center relative ${isWalking ? "bob-logout" : ""}`}>
            {/* Character Head */}
            <div className="w-1.25 h-1.25 bg-rose-100 rounded-full shadow-sm" />
            {/* Character Body */}
            <div className="w-1 h-2.5 bg-white rounded-[1px] -mt-[1px] relative flex justify-center">
              {/* Leg Front */}
              <div
                className={`w-[1px] h-1.25 bg-rose-200 absolute top-[2px] left-[0.5px] origin-top ${
                  isWalking ? "leg-front-logout" : ""
                }`}
              />
              {/* Leg Back */}
              <div
                className={`w-[1px] h-1.25 bg-rose-300 absolute top-[2px] right-[0.5px] origin-top ${
                  isWalking ? "leg-back-logout" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* 3D Hinged Door Panel */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-rose-400 to-rose-500 rounded-[3px] border border-rose-300/40 shadow-sm origin-right transition-transform duration-500 ease-in-out"
          style={{
            transform: doorOpen ? "rotateY(75deg)" : "rotateY(0deg)",
          }}
        >
          {/* Door Handle */}
          <div className="absolute left-[2px] top-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-yellow-400 rounded-full shadow-sm" />
        </div>
      </div>
    </button>
  );
}
