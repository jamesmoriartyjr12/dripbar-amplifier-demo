"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/**
 * Orb options, switchable with the hidden ?orb=1..4 param. Each core renders inside the shared
 * white disc in VoiceOrb and reads `--level` (0..1, live mic level) and `data-state` from `.orb`.
 * To try a new design, add a core here and give it a number; the styles live in orbs.css.
 */

const BARS = Array.from({ length: 24 }, (_, index) => index);

function Aurora() {
  return (
    <span className="core-aurora">
      <i className="a1" />
      <i className="a2" />
      <i className="a3" />
      <b />
    </span>
  );
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
  1: { name: "Aurora sphere", Core: Aurora },
  2: { name: "Liquid drop", Core: Droplet },
  3: { name: "Equalizer ring", Core: Equalizer },
  4: { name: "Sound waves", Core: Waves },
} as const;

export type OrbVariant = keyof typeof ORBS;

export const DEFAULT_ORB: OrbVariant = 1;

export function orbFromParam(param: string | null): OrbVariant | null {
  const n = Number(param);
  return n in ORBS ? (n as OrbVariant) : null;
}

const OrbContext = createContext<OrbVariant>(DEFAULT_ORB);

export function OrbProvider({ variant, children }: { variant: OrbVariant; children: ReactNode }) {
  return <OrbContext.Provider value={variant}>{children}</OrbContext.Provider>;
}

export function useOrbVariant(): OrbVariant {
  return useContext(OrbContext);
}
