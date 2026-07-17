import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: "circle" | "square" | "triangle" | "leaf";
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
  scaleY: number;
  scaleYSpeed: number;
}

export default function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Organic task-completed color palette matching AradDo's natural aesthetic
  const COLORS = [
    "#6366f1", // Indigo Primary
    "#a7f3d0", // Mint Soft
    "#34d399", // Sage Green
    "#fbbf24", // Gold/Amber
    "#ec4899", // Peach Rose
    "#8b5cf6", // Lavendar/Violet
    "#38bdf8", // Sky blue
    "#f472b6", // Pastel pink
  ];

  const SHAPES: Array<"circle" | "square" | "triangle" | "leaf"> = [
    "circle",
    "square",
    "triangle",
    "leaf",
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Responsive Canvas Sizing
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Animation loop
    const updateAndDraw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // Gravity
        p.vx *= 0.98; // Air resistance
        p.vy *= 0.98; // Air resistance
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;
        p.scaleY += Math.sin(p.scaleYSpeed) * 0.1;

        // If particle has faded out or fell out of bounds, remove it
        if (p.opacity <= 0 || p.y > canvas.height + 50) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, p.scaleY);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        if (p.shape === "circle") {
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        } else if (p.shape === "square") {
          ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === "triangle") {
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
        } else if (p.shape === "leaf") {
          // Leaf shape path
          ctx.moveTo(0, -p.size / 1.5);
          ctx.quadraticCurveTo(p.size / 1.8, -p.size / 4, 0, p.size / 1.5);
          ctx.quadraticCurveTo(-p.size / 1.8, -p.size / 4, 0, -p.size / 1.5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Only continue loop if there are active particles
      if (particles.length > 0) {
        animationFrameRef.current = requestAnimationFrame(updateAndDraw);
      } else {
        animationFrameRef.current = null;
      }
    };

    // Trigger explosion event handler
    const triggerConfetti = (e: Event) => {
      const customEvent = e as CustomEvent;
      const originX = customEvent.detail?.x || window.innerWidth / 2;
      const originY = customEvent.detail?.y || window.innerHeight / 1.5;

      const newParticles: Particle[] = [];
      const particleCount = 100; // Multi-burst size

      for (let i = 0; i < particleCount; i++) {
        // High density velocity spread centered upwards
        const angle = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI * 0.8;
        const speed = 6 + Math.random() * 14;

        newParticles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 6 + Math.random() * 10,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          opacity: 1,
          decay: 0.008 + Math.random() * 0.012,
          scaleY: 1,
          scaleYSpeed: Math.random() * 0.2,
        });
      }

      particlesRef.current.push(...newParticles);

      // Start the loop if not already running
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAndDraw);
      }
    };

    window.addEventListener("trigger-confetti", triggerConfetti);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("trigger-confetti", triggerConfetti);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100] w-full h-full"
    />
  );
}
