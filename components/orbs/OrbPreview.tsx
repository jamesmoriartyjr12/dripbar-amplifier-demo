"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VoiceOrb, type OrbState } from "../VoiceOrb";
import { AURORA_OPTIONS, ORBS, type OrbVariant } from ".";

const CYCLE: { state: OrbState; ms: number }[] = [
  { state: "idle", ms: 2500 },
  { state: "listening", ms: 4500 },
  { state: "thinking", ms: 2500 },
];

const noSubscribe = () => () => undefined;

const GROUPS: { title: string; variants: OrbVariant[] }[] = [
  { title: "Aurora options", variants: AURORA_OPTIONS },
  { title: "Other orbs", variants: (Object.keys(ORBS) as OrbVariant[]).filter((v) => !AURORA_OPTIONS.includes(v)) },
];

/** Side-by-side preview of every orb, cycling idle, listening (simulated level) and thinking. */
export function OrbPreview() {
  const only = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("set"),
    () => null,
  );
  const [phase, setPhase] = useState(0);
  const [level, setLevel] = useState(0);
  const { state } = CYCLE[phase];

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase((current) => (current + 1) % CYCLE.length), CYCLE[phase].ms);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (state !== "listening") return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      const t = (performance.now() - start) / 1000;
      const speech = Math.max(0, Math.sin(t * 2.1)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 7.3)));
      setLevel(Math.min(1, speech));
    }, 60);
    return () => {
      window.clearInterval(timer);
      setLevel(0);
    };
  }, [state]);

  return (
    <main className="orb-preview">
      <p className="orb-preview-state" aria-live="polite">
        {state}
      </p>
      {GROUPS.filter((group) => only !== "aurora" || group.variants === AURORA_OPTIONS).map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h1 className="orb-preview-group">{group.title}</h1>
          <ul>
            {group.variants.map((variant) => (
              <li key={variant}>
                <h2>
                  {variant} · {ORBS[variant].name}
                </h2>
                <VoiceOrb state={state} level={state === "listening" ? level : 0} variant={variant} />
                <a href={`/?orb=${variant}`}>Use in the demo</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
