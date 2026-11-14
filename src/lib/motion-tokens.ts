import { EASE_OUT, EASE_IN_OUT } from "./ease";

export const motionTokens = {
  duration: {
    standard: 0.24,
    fast: 0.16,
    instant: 0.12,
  },
  stagger: {
    char: 0.02,
  },
  ease: {
    enter: EASE_OUT,
    standard: EASE_OUT,
    out: EASE_OUT,
    inOut: EASE_IN_OUT,
  },
  blur: {
    soft: 4,
    subtle: 2,
  },
  spring: {
    morph: { stiffness: 450, damping: 32, mass: 0.7 },
    smooth: { stiffness: 380, damping: 30, mass: 0.8 },
    snappy: { stiffness: 520, damping: 28, mass: 0.6 },
  },
};
