"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TelegramSpoilerProps = {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
};

const PARTICLE_DENSITY = 0.12;
const PARTICLE_MIN_SIZE = 0.5;
const PARTICLE_MAX_SIZE = 1.3;
const PARTICLE_MIN_SPEED = 0.06;
const PARTICLE_MAX_SPEED = 0.22;
const CONTENT_BLUR = 8;
const REVEAL_MS = 340;

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
  className = "",
  ariaLabel
}: TelegramSpoilerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

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
    if (!overlayVisible) {
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
  }, [overlayVisible, animate, initCanvas, stopAnimation]);

  const handleClick = () => {
    if (isOpen) return;
    setIsOpen(true);
    requestAnimationFrame(() => {
      setOverlayVisible(false);
    });
  };

  return (
    <div
      data-spoiler-root
      role={!isOpen ? "button" : undefined}
      tabIndex={!isOpen ? 0 : undefined}
      onClick={!isOpen ? handleClick : undefined}
      onKeyDown={!isOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } } : undefined}
      aria-expanded={isOpen}
      aria-label={!isOpen ? ariaLabel : undefined}
      className={`relative block w-full overflow-hidden text-left ${!isOpen ? "cursor-pointer" : ""} ${className}`}
    >
      <div
        style={{
          filter: overlayVisible ? `blur(${CONTENT_BLUR}px)` : "blur(0px)",
          transition: `filter ${REVEAL_MS}ms ease-out`,
          pointerEvents: isOpen ? "auto" : "none",
          userSelect: isOpen ? "auto" : "none"
        }}
      >
        {children}
      </div>

      {overlayVisible || !isOpen ? (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            opacity: overlayVisible ? 1 : 0,
            transition: `opacity ${REVEAL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
      ) : null}
    </div>
  );
}
