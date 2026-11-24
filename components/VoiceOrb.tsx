import type { CSSProperties } from "react";

const PETALS = [1, 2, 3, 4, 5, 6, 7, 8];

export type OrbState = "idle" | "listening" | "thinking";

export function VoiceOrb({ state, level = 0, small = false }: { state: OrbState; level?: number; small?: boolean }) {
  return (
    <div
      className={`orb${small ? " orb-small" : ""}`}
      data-state={state}
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
          {PETALS.map((petal) => (
            <i key={petal} />
          ))}
        </span>
      </span>
    </div>
  );
}
