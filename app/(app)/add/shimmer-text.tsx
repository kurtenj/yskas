"use client";

import React, { useMemo, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  UseInViewOptions,
} from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PHRASES = [
  "Thinking...",
  "Estimating calories...",
  "Checking macros...",
  "Almost done...",
  "Transcribing...",
];

function ShimmeringText({
  text,
  duration = 2,
  delay = 0,
  repeat = true,
  repeatDelay = 0.5,
  className,
  startOnView = true,
  once = false,
  inViewMargin,
  spread = 2,
  color,
  shimmerColor,
}: {
  text: string;
  duration?: number;
  delay?: number;
  repeat?: boolean;
  repeatDelay?: number;
  className?: string;
  startOnView?: boolean;
  once?: boolean;
  inViewMargin?: UseInViewOptions["margin"];
  spread?: number;
  color?: string;
  shimmerColor?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, margin: inViewMargin });
  const dynamicSpread = useMemo(() => text.length * spread, [text, spread]);
  const shouldAnimate = !startOnView || isInView;

  return (
    <motion.span
      ref={ref}
      className={cn(
        "relative inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box]",
        "[--shimmer-bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--shimmer-color),transparent_calc(50%+var(--spread)))]",
        className,
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          ...(color && { "--base-color": color }),
          ...(shimmerColor && { "--shimmer-color": shimmerColor }),
          backgroundImage: `var(--shimmer-bg), linear-gradient(var(--base-color), var(--base-color))`,
        } as React.CSSProperties
      }
      initial={{ backgroundPosition: "100% center", opacity: 0 }}
      animate={
        shouldAnimate ? { backgroundPosition: "0% center", opacity: 1 } : {}
      }
      transition={{
        backgroundPosition: {
          repeat: repeat ? Infinity : 0,
          duration,
          delay,
          repeatDelay,
          ease: "linear",
        },
        opacity: { duration: 0.3, delay },
      }}
    >
      {text}
    </motion.span>
  );
}

export function ShimmerText() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % PHRASES.length),
      2500,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="inline-block"
      >
        <ShimmeringText
          text={PHRASES[index]}
          startOnView={false}
          color="#67787c"
          shimmerColor="#f9fbfb"
        />
      </motion.span>
    </AnimatePresence>
  );
}
