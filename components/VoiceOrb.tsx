import type { CSSProperties } from "react";

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
          <span className="orb-halo h2" />
          <span className="orb-halo" />
        </>
      )}
      <span className="orb-disc">
        <span className="orb-core">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    </div>
  );
}

export function Waveform({ levels }: { levels: number[] }) {
  return (
    <div className="waveform" aria-hidden="true">
      {levels.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(8, Math.min(100, value * 100))}%` }} />
      ))}
    </div>
  );
}
