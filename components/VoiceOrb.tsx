"use client";

import type { CSSProperties } from "react";
import { ORBS, useOrbVariant, type OrbVariant } from "./orbs";

export type OrbState = "idle" | "listening" | "thinking";

export function VoiceOrb({
  state,
  level = 0,
  small = false,
  variant,
}: {
  state: OrbState;
  level?: number;
  small?: boolean;
  variant?: OrbVariant;
}) {
  const contextVariant = useOrbVariant();
  const chosen = variant ?? contextVariant;
  const { Core } = ORBS[chosen];
  return (
    <div
      className={`orb${small ? " orb-small" : ""}`}
      data-state={state}
      data-orb={chosen}
      style={{ "--level": level.toFixed(3) } as CSSProperties}
      aria-hidden="true"
    >
      {small ? null : (
        <>
          <span className="orb-ripple r3" />
          <span className="orb-ripple r2" />
          <span className="orb-halo h2" />
          <span className="orb-halo" />
        </>
      )}
      <span className="orb-disc">
        <span className="orb-core">
          <Core />
        </span>
      </span>
    </div>
  );
}
