"use client";

import type { Dispatch } from "react";
import { ISSUE_LABELS } from "@/lib/amplifier/interpret";
import { QUESTIONS } from "@/lib/amplifier/signs";
import { CLINIC, OTHER_SYMPTOMS, PRODUCTS, SLOTS, slotLabel } from "@/lib/demo/content";
import { recommend, type Recommendation } from "@/lib/demo/recommend";
import {
  intakeSummary,
  promotedQuestion,
  questionOrder,
  questionsComplete,
  type Action,
  type DemoState,
} from "@/lib/demo/state";
import { Check, Heading, ScreenHead, Stethoscope, YesNo } from "../ui";

interface Props {
  state: DemoState;
  dispatch: Dispatch<Action>;
}

function VoiceNotice({ state, dispatch }: Props) {
  const voice = state.voice;
  if (!voice || voice.kind === "signal") return null;
  const issues = voice.kind === "unsuitable" ? voice.issues.map((code) => ISSUE_LABELS[code] ?? code) : [];
  return (
    <div className="notice" role="status" style={{ marginBottom: 16 }}>
      <p style={{ margin: 0 }}>
        {voice.kind === "timeout"
          ? "The recording took too long to process, so let's do this the quick way."
          : "We couldn't use the recording this time, so let's do this the quick way."}
        {issues.length ? ` (${issues.join(", ")})` : null}
      </p>
      {voice.source === "sample" ? (
        <p className="small" style={{ margin: "6px 0 0" }}>
          Demo sample · simulated
        </p>
      ) : null}
      {voice.kind === "failed" ? (
        <>
          <p className="small" style={{ margin: "6px 0 0" }}>
            Live analysis status: <code>{voice.status}</code>
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ paddingLeft: 0 }}
            onClick={() => dispatch({ type: "useSampleInstead" })}
          >
            Use the demo sample instead
          </button>
        </>
      ) : null}
    </div>
  );
}

export function Questions({ state, dispatch }: Props) {
  const promoted = promotedQuestion(state);
  const typed = state.typedInstead || state.scenario === "typed";
  const order = questionOrder(state);
  const chooser = OTHER_SYMPTOMS.filter((symptom) => !(promoted === "lowEnergy" && symptom.id === "low-energy"));

  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 3 of 4" />
      <VoiceNotice state={state} dispatch={dispatch} />
      {state.voice?.kind === "signal" ? (
        <span className={`label-tag${state.voice.source === "live" ? " live" : ""}`} style={{ marginBottom: 12, alignSelf: "flex-start" }}>
          {state.voice.source === "live" ? "Live analysis" : "Demo sample · simulated"}
        </span>
      ) : null}
      <Heading>{typed ? "Tell us how you're feeling this morning" : "A few quick questions"}</Heading>
      <p className="lede">{promoted ? "Let's start here." : "Answer what applies. It takes a few seconds."}</p>

      <div className="stack">
        {typed ? (
          <label className="question" style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>In your own words (optional)</span>
            <textarea
              className="textarea"
              value={state.answers.note}
              placeholder="Rough night, really thirsty, a bit of a headache…"
              onChange={(event) => dispatch({ type: "setNote", note: event.target.value })}
            />
          </label>
        ) : null}

        {order.map((id, index) => (
          <YesNo
            key={id}
            legend={QUESTIONS[id].prompt}
            className={promoted && index === 0 ? "promoted" : ""}
            value={state.answers.questions[id]}
            onChange={(value) => dispatch({ type: "answer", question: id, value })}
          />
        ))}

        <fieldset className="question">
          <legend>Anything else today?</legend>
          <p className="hint">Pick any that apply.</p>
          <div className="chips">
            {chooser.map((symptom) => (
              <button
                key={symptom.id}
                type="button"
                className="chip"
                aria-pressed={state.answers.symptoms.includes(symptom.id)}
                onClick={() => dispatch({ type: "toggleSymptom", symptom: symptom.id })}
              >
                {symptom.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!questionsComplete(state)}
          onClick={() => dispatch({ type: "submitQuestions" })}
        >
          See my options
        </button>
      </div>
    </section>
  );
}

function RecCard({ rec, state, dispatch }: { rec: Recommendation } & Props) {
  const selected = state.interest === rec.product.id;
  return (
    <article className={`rec${rec.featured ? " featured" : ""}`} aria-label={rec.product.name}>
      {rec.featured ? <span className="label-tag" style={{ justifySelf: "start" }}>Best match for your answers</span> : null}
      <div className="rec-head">
        <div>
          <h3 className="rec-name">{rec.product.name}</h3>
          <p className="small" style={{ margin: "2px 0 0" }}>
            {rec.product.blurb}
          </p>
        </div>
        <div className="rec-price">
          <strong>{rec.product.price}</strong>
          <span>{rec.product.priceNote}</span>
        </div>
      </div>
      <ul className="reasons">
        {rec.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <button
        type="button"
        className="interest"
        aria-pressed={selected}
        onClick={() => dispatch({ type: "setInterest", product: selected ? null : rec.product.id })}
      >
        {selected ? "Added to my visit" : "I'm interested"}
      </button>
    </article>
  );
}

export function Recommended({ state, dispatch }: Props) {
  const { drips, ongoing } = recommend(state);
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 4 of 4" />
      <p className="eyebrow">Recommended for you</p>
      <Heading>Here&apos;s what may help today</Heading>
      <div className="clinician-note">
        <Stethoscope />
        <span>
          <strong>A clinician confirms at your visit.</strong> They&apos;ll review your answers and may suggest something
          different.
        </span>
      </div>

      <h2 className="section-title">IV drips</h2>
      <div className="stack">
        {drips.map((rec) => (
          <RecCard key={rec.product.id} rec={rec} state={state} dispatch={dispatch} />
        ))}
      </div>

      {ongoing.length ? (
        <>
          <h2 className="section-title">Between visits</h2>
          <div className="stack">
            {ongoing.map((rec) => (
              <RecCard key={rec.product.id} rec={rec} state={state} dispatch={dispatch} />
            ))}
          </div>
        </>
      ) : null}

      <p className="small" style={{ marginTop: 14 }}>
        Prices are local list prices at {CLINIC.name}, subject to clinician assessment.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "continueToBooking" })}>
          Book my visit
        </button>
      </div>
    </section>
  );
}

function discussing(state: DemoState) {
  return state.interest ? PRODUCTS[state.interest].name : "Your clinician's recommendation";
}

export function Booking({ state, dispatch }: Props) {
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} />
      <p className="eyebrow">Book your visit</p>
      <Heading>Pick your time</Heading>
      <div className="slots" role="radiogroup" aria-label="Today's visit times">
        {SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            role="radio"
            aria-checked={state.slot === slot.id}
            className={`slot${"sample" in slot ? " sample" : ""}`}
            onClick={() => dispatch({ type: "chooseSlot", slot: slot.id })}
          >
            <strong>{slot.label}</strong>
            <span>{"sample" in slot ? "Sample appointment" : "Sample time"}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: "6px 18px" }}>
        <ul className="summary-list">
          <li>
            <span>Clinic</span>
            <strong>{CLINIC.name}</strong>
          </li>
          <li>
            <span>Time</span>
            <strong>Today, {slotLabel(state.slot)}</strong>
          </li>
          <li>
            <span>To discuss</span>
            <strong>{discussing(state)}</strong>
          </li>
          <li>
            <span>Payment</span>
            <strong>At the clinic, after your clinician confirms</strong>
          </li>
        </ul>
      </div>
      <p className="small">Sample appointments. Nothing is booked or charged in this demo.</p>

      <div className="actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "requestVisit" })}>
          Request {slotLabel(state.slot)}
        </button>
      </div>
    </section>
  );
}

export function Booked({ state, dispatch }: Props) {
  return (
    <section className="screen">
      <span className="check" aria-hidden="true">
        <Check />
      </span>
      <span className="label-tag" style={{ alignSelf: "flex-start", marginBottom: 10 }}>
        Simulated booking
      </span>
      <Heading>You&apos;re booked for {slotLabel(state.slot)}</Heading>
      <p className="lede">No appointment was made and nothing was charged. This confirmation is part of the demo.</p>
      <div className="card" style={{ padding: "6px 18px" }}>
        <ul className="summary-list">
          <li>
            <span>Where</span>
            <strong>{CLINIC.name}</strong>
          </li>
          <li>
            <span>To discuss</span>
            <strong>{discussing(state)}</strong>
          </li>
          <li>
            <span>Your answers</span>
            <strong>{intakeSummary(state)}</strong>
          </li>
        </ul>
      </div>
      <p className="small">Your clinician reviews your answers with you before anything is started.</p>
      <div className="actions">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => dispatch({ type: "reset" })}>
          Start over
        </button>
      </div>
    </section>
  );
}
