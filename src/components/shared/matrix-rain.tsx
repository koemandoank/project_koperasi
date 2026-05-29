"use client";

import { useEffect, useRef } from "react";

interface MatrixRainProps {
  color?: string; // e.g. "rgba(15, 76, 58, 0.08)"
  fontSize?: number;
}

export function MatrixRain({ color = "rgba(15, 76, 58, 0.08)", fontSize = 14 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Columns configuration
    const columns = Math.floor(canvas.width / fontSize);
    const rainDrops: number[] = [];

    // Initialize drops
    for (let x = 0; x < columns; x++) {
      rainDrops[x] = Math.random() * -100; // Start off-screen at random heights
    }

    const draw = () => {
      // Draw semi-transparent background to create trail effect
      // We use a light cream trailing background to match the cream theme background
      ctx.fillStyle = "rgba(253, 251, 247, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < rainDrops.length; i++) {
        // Only draw numbers (Matrix numbers theme)
        const text = Math.floor(Math.random() * 10).toString();
        const x = i * fontSize;
        const y = rainDrops[i] * fontSize;

        // Draw character
        ctx.fillText(text, x, y);

        // Reset drop to top randomly once it hits the bottom
        if (y > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }

        // Move drop down
        rainDrops[i]++;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, fontSize]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80"
    />
  );
}
