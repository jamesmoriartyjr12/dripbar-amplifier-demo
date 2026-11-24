"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/**
 * Orb options, switchable with the hidden ?orb= param: 1a..1d (Aurora options; 1 means 1a), 2, 3 or 4. Each core renders inside the shared
 * white disc in VoiceOrb and reads `--level` (0..1, live mic level) and `data-state` from `.orb`.
 * To try a new design, add a core here and give it a number; the styles live in orbs.css.
 */

const BARS = Array.from({ length: 24 }, (_, index) => index);

/** Aurora options differ only in CSS (palette, blob count, motion, finish, glow, level response). */
function aurora(look: "a" | "b" | "c" | "d") {
  return function Aurora() {
    return (
      <span className="core-aurora" data-look={look}>
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
        <i className="a4" />
        <b />
        <s />
      </span>
    );
  };
}

function Droplet() {
  return (
    <span className="core-drop">
      <i className="blob" />
      <i className="shine" />
      <span className="drops">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

function Equalizer() {
  return (
    <span className="core-eq">
      {BARS.map((bar) => (
        <i key={bar} style={{ "--i": bar } as CSSProperties} />
      ))}
    </span>
  );
}

function Waves() {
  return (
    <span className="core-waves">
      <svg viewBox="0 0 200 100" preserveAspectRatio="none">
        <path className="w1" d="M0 50 Q 25 20 50 50 T 100 50 T 150 50 T 200 50" />
        <path className="w2" d="M0 50 Q 25 75 50 50 T 100 50 T 150 50 T 200 50" />
        <path className="w3" d="M0 50 Q 25 30 50 50 T 100 50 T 150 50 T 200 50" />
      </svg>
      <span className="ring" />
    </span>
  );
}

export const ORBS = {
  "1a": { name: "Aurora · Pearl", Core: aurora("a") },
  "1b": { name: "Aurora · Sunrise", Core: aurora("b") },
  "1c": { name: "Aurora · Deep glass", Core: aurora("c") },
  "1d": { name: "Aurora · Halo", Core: aurora("d") },
  "2": { name: "Liquid drop", Core: Droplet },
  "3": { name: "Equalizer ring", Core: Equalizer },
  "4": { name: "Sound waves", Core: Waves },
} as const;

export type OrbVariant = keyof typeof ORBS;

export const AURORA_OPTIONS: OrbVariant[] = ["1a", "1b", "1c", "1d"];

export const DEFAULT_ORB: OrbVariant = "1a";

export function orbFromParam(param: string | null): OrbVariant | null {
  if (!param) return null;
  const key = param.trim().toLowerCase();
  const resolved = key === "1" ? "1a" : key;
  return resolved in ORBS ? (resolved as OrbVariant) : null;
}

const OrbContext = createContext<OrbVariant>(DEFAULT_ORB);

export function OrbProvider({ variant, children }: { variant: OrbVariant; children: ReactNode }) {
  return <OrbContext.Provider value={variant}>{children}</OrbContext.Provider>;
}

export function useOrbVariant(): OrbVariant {
  return useContext(OrbContext);
}
