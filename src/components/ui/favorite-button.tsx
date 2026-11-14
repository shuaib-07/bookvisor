"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  showTooltip?: boolean;
  variant?: "default" | "frosted";
}

const PARTICLE_COUNT = 12;

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

export function FavoriteButton({
  isFavorite,
  onToggle,
  size = "md",
  className,
  variant = "default",
}: FavoriteButtonProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const triggerBurst = () => {
    const colors = [
      "#f43f5e", // rose-500
      "#fb7185", // rose-400
      "#e11d48", // rose-600
      "#f59e0b", // amber-500 gold
      "#ec4899", // pink-500
    ];

    const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: Date.now() + i,
      angle: (i * (360 / PARTICLE_COUNT)) * (Math.PI / 180),
      distance: 18 + Math.random() * 10,
      size: 2.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(newParticles);
    setTimeout(() => setParticles([]), 700);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFavorite) {
      triggerBurst();
    }
    onToggle(e);
  };

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-7 h-7",
    lg: "w-8 h-8",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <button
        type="button"
        onClick={handleClick}
        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all cursor-pointer select-none",
          sizeClasses[size],
          variant === "frosted"
            ? isFavorite
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/35 backdrop-blur-md shadow-2xs"
              : "bg-black/55 hover:bg-black/80 text-white/75 hover:text-rose-400 border border-white/12 hover:border-rose-500/35 backdrop-blur-md shadow-2xs"
            : isFavorite
            ? "text-rose-500 hover:text-rose-400"
            : "text-muted-foreground/40 hover:text-rose-400",
          className
        )}
      >
        <motion.div
          animate={isFavorite ? { scale: [1, 1.4, 0.88, 1] } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 18 }}
          className="flex items-center justify-center shrink-0"
        >
          <Heart
            className={cn(
              iconSizes[size],
              "shrink-0 transition-colors stroke-[1.8]",
              isFavorite && "fill-rose-500 text-rose-500"
            )}
          />
        </motion.div>
      </button>

      {/* Radial Particle Explosion on Favoriting */}
      <AnimatePresence>
        {particles.map((p) => {
          const x = Math.cos(p.angle) * p.distance;
          const y = Math.sin(p.angle) * p.distance;
          return (
            <motion.span
              key={p.id}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{
                scale: [0, 1.2, 0],
                x,
                y,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              style={{
                position: "absolute",
                width: p.size,
                height: p.size,
                borderRadius: "9999px",
                backgroundColor: p.color,
                pointerEvents: "none",
                zIndex: 40,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

