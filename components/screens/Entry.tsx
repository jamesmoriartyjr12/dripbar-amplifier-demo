"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { PRODUCTS, SLOTS } from "@/lib/demo/content";
import type { Action, DemoState, SafetyAnswers } from "@/lib/demo/state";
import { VoiceOrb } from "../VoiceOrb";
import { Heading, ScreenHead, Stethoscope, YesNo } from "../ui";

interface Props {
  state: DemoState;
  dispatch: Dispatch<Action>;
}

export function Landing({ dispatch }: Props) {
  const [showTimes, setShowTimes] = useState(false);
  const timesRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (showTimes) timesRef.current?.focus();
  }, [showTimes]);

  return (
    <section className="screen landing" aria-labelledby="landing-title">
      <div className="landing-hero">
        <p className="eyebrow">Sunday · Huntington Beach</p>
        <div className="landing-orb">
          <VoiceOrb state="idle" />
        </div>
      </div>
      <Heading className="display">Feeling rough this morning?</Heading>
      <p className="lede">
        Tell us how you feel, by voice or by typing. We&apos;ll suggest options, and a clinician confirms everything at
        your visit.
      </p>

      <div className="card">
        <div className="price-line">
          <strong>{PRODUCTS.hydration.name}</strong>
          <span className="price">{PRODUCTS.hydration.price}</span>
        </div>
        <p className="small" style={{ margin: "4px 0 0" }}>
          Local list price at The DRIPBaR Huntington Beach, subject to clinician assessment.
        </p>
      </div>

      {showTimes ? (
        <div>
          <h2 ref={timesRef} tabIndex={-1} className="section-title">
            Today&apos;s times
          </h2>
          <div className="slots" role="group" aria-label="Today's visit times">
            {SLOTS.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot${"sample" in slot ? " sample" : ""}`}
                onClick={() => dispatch({ type: "chooseSlot", slot: slot.id })}
              >
                <strong>{slot.label}</strong>
                <span>{"sample" in slot ? "Sample appointment" : "Sample time"}</span>
              </button>
            ))}
          </div>
          <p className="small">Pick a time now. You don&apos;t need to choose a drip yet.</p>
        </div>
      ) : (
        <ol className="how" aria-label="How it works">
          <li>
            <b>1</b>
            <span>A quick safety check</span>
          </li>
          <li>
            <b>2</b>
            <span>Tap to talk: tell us how you feel in about 20 seconds</span>
          </li>
          <li>
            <b>3</b>
            <span>See options a clinician confirms at your visit</span>
          </li>
        </ol>
      )}

      {showTimes ? null : (
        <div className="actions">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setShowTimes(true)}>
            Check today&apos;s times
          </button>
          <p className="small" style={{ margin: 0, textAlign: "center" }}>
            Next: pick a time, a quick safety check, then tap to talk.
          </p>
        </div>
      )}
    </section>
  );
}

const SAFETY_QUESTIONS: { field: keyof SafetyAnswers; legend: string; hint?: string; alert?: boolean }[] = [
  { field: "keepsLiquidsDown", legend: "Can you keep liquids down?" },
  { field: "repeatedVomiting", legend: "Have you been vomiting repeatedly?" },
  { field: "headInjury", legend: "Have you had a recent head injury?" },
  {
    field: "emergencySymptoms",
    legend: "After drinking, is there any confusion, difficulty waking, seizures, or slow or irregular breathing?",
    hint: "This applies to you or anyone you're with.",
    alert: true,
  },
];

export function Safety({ state, dispatch }: Props) {
  const complete = Object.values(state.safety).every((value) => value !== null);
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 1 of 4" />
      <p className="eyebrow">Safety first</p>
      <Heading>A quick safety check</Heading>
      <p className="lede">Four questions before we go any further.</p>
      <div className="stack">
        {SAFETY_QUESTIONS.map((question) => (
          <YesNo
            key={question.field}
            legend={question.legend}
            hint={question.hint}
            className={question.alert ? "alert" : ""}
            value={state.safety[question.field]}
            onChange={(value) => dispatch({ type: "setSafety", field: question.field, value })}
          />
        ))}
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!complete}
          onClick={() => dispatch({ type: "submitSafety" })}
        >
          {state.scenario === "typed" ? "Continue" : "Continue to voice check-in"}
        </button>
        <p className="small" style={{ margin: 0, textAlign: "center" }}>
          In this demo, your answers stay on this device.
        </p>
      </div>
    </section>
  );
}

export function EmergencyStop({ dispatch }: Props) {
  return (
    <section className="screen">
      <div className="stop" role="alert">
        <Heading>In a real emergency, call 911</Heading>
        <p style={{ margin: "0 0 10px" }}>
          Confusion, difficulty waking, seizures, or slow or irregular breathing after drinking need emergency care
          right away. Don&apos;t wait for an IV visit, and don&apos;t leave the person alone.
        </p>
        <p className="small" style={{ margin: 0, color: "inherit", opacity: 0.8 }}>
          Demo only: this screen doesn&apos;t place a call.{" "}
          <a href="https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/understanding-dangers-of-alcohol-overdose">
            NIAAA guidance
          </a>
        </p>
      </div>
      <p className="small" style={{ marginTop: 18 }}>
        This demo branch ends here.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "reset" })}>
          Restart demo
        </button>
      </div>
    </section>
  );
}

export function MedicalStop({ dispatch }: Props) {
  return (
    <section className="screen">
      <div className="stop calm">
        <span className="label-tag">Simulated route</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "14px 0 6px" }}>
          <span className="icon-btn" aria-hidden="true">
            <Stethoscope />
          </span>
          <Heading>Let&apos;s get you checked first</Heading>
        </div>
        <p style={{ margin: 0, color: "var(--ink-soft)" }}>
          Based on your answers, an IV visit isn&apos;t the right next step today. In a real visit, we&apos;d connect you
          with a medical evaluation instead.
        </p>
      </div>
      <p className="small" style={{ marginTop: 18 }}>
        This demo branch ends here. No booking or recommendations are shown.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "reset" })}>
          Restart demo
        </button>
      </div>
    </section>
  );
}
