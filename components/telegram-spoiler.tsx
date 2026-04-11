"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TelegramSpoilerProps = {
  children: React.ReactNode;
  revealed?: boolean;
  onReveal?: () => void;
  className?: string;
  ariaLabel?: string;
};

const PARTICLE_DENSITY = 0.18;
const PARTICLE_MIN_SIZE = 0.5;
const PARTICLE_MAX_SIZE = 1.3;
const PARTICLE_MIN_SPEED = 0.06;
const PARTICLE_MAX_SPEED = 0.22;
const CONTENT_BLUR = 10;
const REVEAL_DURATION = 380;

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
      opacity: 0.3 + Math.random() * 0.55,
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
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [isRevealed, setIsRevealed] = useState(revealed);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const revealStartRef = useRef(0);

  useEffect(() => {
    if (revealed && !isRevealed) {
      setIsAnimatingOut(true);
      revealStartRef.current = performance.now();
    }

    setIsRevealed(revealed);
  }, [revealed, isRevealed]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    timeRef.current += 1;

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const baseR = isDark ? 200 : 255;
    const baseG = isDark ? 210 : 255;
    const baseB = isDark ? 224 : 255;

    for (const particle of particles) {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.x < -2) {
        particle.x = width + 2;
      } else if (particle.x > width + 2) {
        particle.x = -2;
      }

      if (particle.y < -2) {
        particle.y = height + 2;
      } else if (particle.y > height + 2) {
        particle.y = -2;
      }

      const flicker = 0.5 + 0.5 * Math.sin(timeRef.current * particle.flickerSpeed + particle.flickerPhase);
      const alpha = particle.opacity * (0.7 + 0.3 * flicker);

      ctx.beginPath();
      ctx.arc(particle.x * dpr, particle.y * dpr, particle.size * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
      ctx.fill();
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isRevealed && !isAnimatingOut) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }

      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resizeCanvas();
    animationFrameRef.current = requestAnimationFrame(animate);

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });

    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }

      observer.disconnect();
    };
  }, [isRevealed, isAnimatingOut, animate]);

  const handleReveal = () => {
    setIsAnimatingOut(true);
    revealStartRef.current = performance.now();
    setIsRevealed(true);
    onReveal?.();

    setTimeout(() => {
      setIsAnimatingOut(false);
    }, REVEAL_DURATION);
  };

  const isFullyRevealed = isRevealed && !isAnimatingOut;

  if (isFullyRevealed) {
    return <div className={className}>{children}</div>;
  }

  if (isAnimatingOut) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {children}

        <div
          className="absolute inset-0 ui-telegram-spoiler-bg"
          aria-hidden="true"
          style={{
            animation: `spoiler-fade-out ${REVEAL_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleReveal}
      className={`group relative block w-full overflow-hidden text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
      aria-expanded={false}
      aria-label={ariaLabel}
    >
      <div
        className="pointer-events-none select-none"
        style={{
          filter: `blur(${CONTENT_BLUR}px) saturate(0.86) contrast(0.96)`,
          transform: "scale(1.04)",
          transformOrigin: "center",
          opacity: 0.6
        }}
      >
        {children}
      </div>

      <div
        className="absolute inset-0 ui-telegram-spoiler-bg"
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </button>
  );
}
