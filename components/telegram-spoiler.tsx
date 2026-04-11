"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TelegramSpoilerProps = {
  children: React.ReactNode;
  revealed?: boolean;
  onReveal?: () => void;
  className?: string;
  ariaLabel?: string;
};

const PARTICLE_DENSITY = 0.12;
const PARTICLE_MIN_SIZE = 0.5;
const PARTICLE_MAX_SIZE = 1.3;
const PARTICLE_MIN_SPEED = 0.06;
const PARTICLE_MAX_SPEED = 0.22;
const CONTENT_BLUR = 8;
const REVEAL_MS = 360;

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  flickerSpeed: number;
  flickerPhase: number;
};

function createParticles(width: number, height: number): Particle[] {
  const area = width * height;
  const count = Math.round(area * PARTICLE_DENSITY);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);

    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: PARTICLE_MIN_SIZE + Math.random() * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE),
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed,
      opacity: 0.35 + Math.random() * 0.5,
      flickerSpeed: 0.008 + Math.random() * 0.016,
      flickerPhase: Math.random() * Math.PI * 2
    });
  }

  return particles;
}

export function TelegramSpoiler({
  children,
  revealed = false,
  onReveal,
  className = "",
  ariaLabel
}: TelegramSpoilerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [phase, setPhase] = useState<"hidden" | "revealing" | "done">(revealed ? "done" : "hidden");

  useEffect(() => {
    if (revealed) {
      setPhase((p) => (p === "hidden" ? "revealing" : p));
    }
  }, [revealed]);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    timeRef.current += 1;

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const baseR = isDark ? 190 : 120;
    const baseG = isDark ? 200 : 130;
    const baseB = isDark ? 216 : 148;

    for (const p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < -2) p.x = width + 2;
      else if (p.x > width + 2) p.x = -2;
      if (p.y < -2) p.y = height + 2;
      else if (p.y > height + 2) p.y = -2;

      const flicker = 0.5 + 0.5 * Math.sin(timeRef.current * p.flickerSpeed + p.flickerPhase);
      const alpha = p.opacity * (0.7 + 0.3 * flicker);

      ctx.beginPath();
      ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
      ctx.fill();
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const root = canvas.closest("[data-spoiler-root]");
    const rect = root?.getBoundingClientRect();
    if (!rect) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    particlesRef.current = createParticles(rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (phase === "done") {
      stopAnimation();
      return;
    }

    initCanvas();
    animationFrameRef.current = requestAnimationFrame(animate);

    const canvas = canvasRef.current;
    const root = canvas?.closest("[data-spoiler-root]");
    const observer = new ResizeObserver(() => initCanvas());
    if (root) observer.observe(root);

    return () => {
      stopAnimation();
      observer.disconnect();
    };
  }, [phase, animate, initCanvas, stopAnimation]);

  const handleReveal = () => {
    if (phase !== "hidden") return;
    setPhase("revealing");
    onReveal?.();
  };

  useEffect(() => {
    if (phase !== "revealing") return;

    const overlay = overlayRef.current;
    if (!overlay) {
      setPhase("done");
      return;
    }

    const onEnd = () => setPhase("done");
    overlay.addEventListener("transitionend", onEnd);

    requestAnimationFrame(() => {
      overlay.style.opacity = "0";
    });

    const fallback = setTimeout(onEnd, REVEAL_MS + 50);
    return () => {
      overlay.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
    };
  }, [phase]);

  if (phase === "done") {
    return <div className={className}>{children}</div>;
  }

  const isHidden = phase === "hidden";

  return (
    <div
      data-spoiler-root
      role={isHidden ? "button" : undefined}
      tabIndex={isHidden ? 0 : undefined}
      onClick={isHidden ? handleReveal : undefined}
      onKeyDown={isHidden ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleReveal(); } } : undefined}
      aria-expanded={!isHidden}
      aria-label={isHidden ? ariaLabel : undefined}
      className={`relative block w-full overflow-hidden text-left ${isHidden ? "cursor-pointer" : ""} ${className}`}
    >
      <div className={isHidden ? "pointer-events-none select-none" : ""}>
        {children}
      </div>

      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          opacity: 1,
          transition: `opacity ${REVEAL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: phase === "revealing" ? "opacity" : "auto"
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${CONTENT_BLUR}px)`,
            WebkitBackdropFilter: `blur(${CONTENT_BLUR}px)`
          }}
        />
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
