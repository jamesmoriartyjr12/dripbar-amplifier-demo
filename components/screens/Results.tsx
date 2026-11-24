"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type Dispatch } from "react";
import { ISSUE_LABELS } from "@/lib/amplifier/interpret";
import { QUESTIONS } from "@/lib/amplifier/signs";
import { OTHER_SYMPTOMS, PRODUCTS, SLOTS, addOnById, productPrice, slotLabel } from "@/lib/demo/content";
import { recommend, type Recommendation } from "@/lib/demo/recommend";
import {
  confirmedConcerns,
  currentLocation,
  intakeSummary,
  promotedQuestion,
  questionOrder,
  questionsComplete,
  type Action,
  type DemoState,
} from "@/lib/demo/state";
import { Check, CheckSmall, ChevronRight, Close, Heading, Plus, ScreenHead, Search, YesNo } from "../ui";

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

function concernLine(concerns: string[]): string {
  if (concerns.length === 0) return "";
  if (concerns.length === 1) return concerns[0];
  return `${concerns.slice(0, -1).join(", ")} and ${concerns[concerns.length - 1]}`;
}

function ProductCard({
  rec,
  state,
  dispatch,
  onOpen,
  eager,
}: { rec: Recommendation; onOpen: (rec: Recommendation) => void; eager?: boolean } & Props) {
  const { product } = rec;
  const selected = state.interest === product.id;
  return (
    <li className="pcard">
      <div className="pcard-media">
        <Image className="pcard-brand" src="/brand/dripbar-mark.svg" alt="" width={16} height={16} />
        {rec.featured ? <span className="pcard-flag">Top pick</span> : null}
        <Image src={product.image} alt={product.alt} width={480} height={480} sizes="160px" priority={eager} />
        <button
          type="button"
          className="pcard-add"
          aria-pressed={selected}
          aria-label={selected ? `Remove ${product.name} from my visit` : `Add ${product.name} to my visit`}
          onClick={() => dispatch({ type: "setInterest", product: selected ? null : product.id })}
        >
          {selected ? <CheckSmall /> : <Plus />}
        </button>
      </div>
      <button type="button" className="pcard-name rec-name" aria-haspopup="dialog" onClick={() => onOpen(rec)}>
        {product.name}
      </button>
      <p className="pcard-price">
        <strong>{productPrice(product, currentLocation(state))}</strong>
        <span>{product.kind === "drip" ? "List price" : "At your visit"}</span>
      </p>
      <p className="pcard-foot">
        <span>
          <small>Visit</small>
          Today
        </span>
        <span className="pcard-badge">
          <CheckSmall /> Clinician
        </span>
      </p>
    </li>
  );
}

function ProductSheet({
  rec,
  state,
  dispatch,
  onClose,
}: { rec: Recommendation | null; onClose: () => void } & Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (rec && !dialog.open) dialog.showModal();
    if (!rec && dialog.open) dialog.close();
  }, [rec]);
  const product = rec?.product;
  const selected = product ? state.interest === product.id : false;
  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {rec && product ? (
        <div className="sheet-body">
          <span className="sheet-handle" aria-hidden="true" />
          <button type="button" className="icon-btn sheet-close" aria-label="Close details" onClick={onClose}>
            <Close />
          </button>
          <div className="sheet-media">
            <Image src={product.image} alt={product.alt} width={480} height={480} sizes="(max-width: 440px) 70vw, 300px" />
          </div>
          <h2 id="sheet-title" className="sheet-title">
            {product.name}
          </h2>
          <p className="sheet-price">
            <strong>{productPrice(product, currentLocation(state))}</strong> <span>{product.priceNote}</span>
          </p>
          <p className="sheet-blurb">{product.blurb}</p>
          <h3 className="sheet-sub">Why it&apos;s here</h3>
          <ul className="reasons">
            {rec.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="small" style={{ margin: "12px 0 0" }}>
            Your clinician reviews your answers and decides whether it&apos;s right for you.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            aria-pressed={selected}
            onClick={() => dispatch({ type: "setInterest", product: selected ? null : product.id })}
          >
            {selected ? "Added to my visit" : "Add to my visit"}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

export function Recommended({ state, dispatch }: Props) {
  const { drips, ongoing } = recommend(state);
  const [open, setOpen] = useState<Recommendation | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const concerns = confirmedConcerns(state);
  const top = drips[0];
  const openSheet = (rec: Recommendation) => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(rec);
  };
  const closeSheet = () => {
    setOpen(null);
    opener.current?.focus();
  };
  return (
    <section className="screen results">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 4 of 4" />
      <p className="query-pill">
        <Search />
        <span>{concerns.length ? `Help with ${concernLine(concerns)}` : "Help me feel better today"}</span>
      </p>

      <div className="sheet">
        <span className="sheet-handle" aria-hidden="true" />
        <div className="shelf shelf-lead">
          <div className="shelf-head">
            <div>
              <Heading className="shelf-title">Recommended for you</Heading>
              <p className="shelf-desc">
                {concerns.length ? `Picked for your ${concernLine(concerns)}. ` : "Picked from your answers. "}
                A clinician confirms at your visit.
              </p>
            </div>
            <button type="button" className="shelf-more" aria-label={`More about ${top.product.name}`} onClick={() => openSheet(top)}>
              <ChevronRight />
            </button>
          </div>
          <ul className="carousel" aria-label="IV drips">
            {drips.map((rec, index) => (
              <ProductCard key={rec.product.id} rec={rec} state={state} dispatch={dispatch} onOpen={openSheet} eager={index < 2} />
            ))}
          </ul>
        </div>

        {ongoing.length ? (
          <div className="shelf">
            <h2 className="shelf-title">Between visits</h2>
            <ul className="carousel" aria-label="Between visits">
              {ongoing.map((rec) => (
                <ProductCard key={rec.product.id} rec={rec} state={state} dispatch={dispatch} onOpen={openSheet} />
              ))}
            </ul>
          </div>
        ) : null}

        <p className="small sheet-note">Prices are list prices at {currentLocation(state).name}, subject to clinician assessment.</p>
      </div>

      <div className="actions results-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "continueToBooking" })}>
          Book my visit
        </button>
      </div>
      <ProductSheet rec={open} state={state} dispatch={dispatch} onClose={closeSheet} />
    </section>
  );
}

function VisitItems({ state }: { state: DemoState }) {
  const location = currentLocation(state);
  const items = [
    ...(state.interest ? [PRODUCTS[state.interest]] : []),
    ...state.addOns.map(addOnById),
  ];
  if (items.length === 0) return null;
  return (
    <ul className="visit-items" aria-label="To discuss with your clinician">
      {items.map((item) => (
        <li key={item.id} className="notify">
          <span className="notify-thumb">
            <Image src={item.image} alt={item.alt} width={48} height={48} />
          </span>
          <span className="notify-body">
            <strong>{item.name}</strong>
            <span>Your clinician confirms</span>
          </span>
          <span className="price">{productPrice(item, location)}</span>
        </li>
      ))}
    </ul>
  );
}

function discussing(state: DemoState) {
  const names = [
    ...(state.interest ? [PRODUCTS[state.interest].name] : []),
    ...state.addOns.map((id) => addOnById(id).name),
  ];
  return names.length ? names.join(", ") : "Your clinician's recommendation";
}

export function Booking({ state, dispatch }: Props) {
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} />
      <p className="eyebrow">Book your visit</p>
      <Heading>Pick your time</Heading>
      <VisitItems state={state} />
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
            <strong>{currentLocation(state).name}</strong>
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
      <VisitItems state={state} />
      <div className="card" style={{ padding: "6px 18px" }}>
        <ul className="summary-list">
          <li>
            <span>Where</span>
            <strong>{currentLocation(state).name}</strong>
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
