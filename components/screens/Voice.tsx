"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { analyzeLive } from "@/lib/amplifier/client";
import { MicrophoneError, startRecording, type Recording } from "@/lib/audio/recorder";
import {
  LIVE_CLIP_SECONDS,
  LIVE_MIN_SECONDS,
  SAMPLE_CLIP_SECONDS,
  SAMPLE_PLAYBACK_MS,
  SAMPLE_TRANSCRIPTS,
} from "@/lib/demo/content";
import { sampleVoiceRecord, scenarioInfo, type Action, type DemoState, type VoiceRecord } from "@/lib/demo/state";
import { VoiceOrb, Waveform } from "../VoiceOrb";
import { ArrowRight, Close, Heading, Keyboard, ScreenHead } from "../ui";

interface Props {
  state: DemoState;
  dispatch: Dispatch<Action>;
}

export function Intake({ state, dispatch }: Props) {
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 2 of 4" />
      <p className="eyebrow">How you&apos;re feeling</p>
      <Heading>Tell us how you&apos;re feeling this morning</Heading>
      <p className="lede">
        Talk for about 20 seconds, like you&apos;d tell a friend. It helps us pick the right next question.
      </p>
      <div className="intake-orb">
        <VoiceOrb state="idle" />
      </div>
      <div className="actions">
        {state.liveEnabled ? (
          <button type="button" className="composer" onClick={() => dispatch({ type: "startLive" })}>
            <VoiceOrb state="idle" small />
            <span className="composer-text">
              <strong>Record my voice</strong>
              <span>About 20 seconds. We&apos;ll ask first.</span>
            </span>
            <span className="composer-arrow" aria-hidden="true">
              <ArrowRight />
            </span>
          </button>
        ) : null}
        <button
          type="button"
          className={state.liveEnabled ? "btn btn-secondary btn-block" : "composer"}
          onClick={() => dispatch({ type: "startSample" })}
        >
          {state.liveEnabled ? (
            "Use demo sample"
          ) : (
            <>
              <VoiceOrb state="idle" small />
              <span className="composer-text">
                <strong>Use demo sample</strong>
                <span>Simulated recording. No microphone needed.</span>
              </span>
              <span className="composer-arrow" aria-hidden="true">
                <ArrowRight />
              </span>
            </>
          )}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "typeInstead" })}>
          <Keyboard /> Type instead
        </button>
      </div>
    </section>
  );
}

export function Consent({ dispatch }: Props) {
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 2 of 4" />
      <p className="eyebrow">Before we record</p>
      <Heading>Is it okay to use your microphone?</Heading>
      <div className="card stack" style={{ gap: 10 }}>
        <p style={{ margin: 0 }}>When you continue, we&apos;ll record about 20 seconds of your voice.</p>
        <p style={{ margin: 0 }}>
          The recording is sent to our technology partner, Amplifier Health, for a voice analysis that helps choose your
          next question. It isn&apos;t a diagnosis.
        </p>
        <p style={{ margin: 0 }}>The audio is discarded from this device after the analysis.</p>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => dispatch({ type: "consentGiven" })}>
          I agree, start recording
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "typeInstead" })}>
          <Keyboard /> Type instead
        </button>
      </div>
    </section>
  );
}

type Phase = "listening" | "thinking";
const BARS = 28;

function formatClock(seconds: number) {
  const whole = Math.min(99, Math.floor(seconds));
  return `0:${whole.toString().padStart(2, "0")}`;
}

function syntheticLevel(t: number) {
  return 0.35 + 0.3 * Math.sin(t * 7.1) * Math.sin(t * 2.3) + 0.25 * Math.abs(Math.sin(t * 13.7));
}

export function Capture({ state, dispatch }: Props) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [status, setStatus] = useState("");
  const recordingRef = useRef<Recording | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const live = state.captureMode === "live";
  const info = scenarioInfo(state.scenario);
  const transcript = SAMPLE_TRANSCRIPTS[info.sign];

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const controller = new AbortController();
    const finish = (record: VoiceRecord) => {
      if (!cancelled) dispatch({ type: "voiceResult", record });
    };
    const pushLevel = (value: number) => {
      setLevel(value);
      setLevels((previous) => [...previous.slice(1), value]);
    };

    if (!live) {
      const started = performance.now();
      const tick = () => {
        const progress = Math.min(1, (performance.now() - started) / SAMPLE_PLAYBACK_MS);
        setElapsed(progress * SAMPLE_CLIP_SECONDS);
        pushLevel(progress < 1 ? syntheticLevel(progress * 20) : 0);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        setPhase("thinking");
        const record = sampleVoiceRecord(state.scenario);
        timers.push(setTimeout(() => finish(record), record.kind === "timeout" ? 3200 : 1800));
      };
      frame = requestAnimationFrame(tick);
    } else {
      let analyzing = false;
      const analyze = async (recording: Recording) => {
        if (analyzing) return;
        analyzing = true;
        stopRef.current = null;
        cancelAnimationFrame(frame);
        recordingRef.current = null;
        setPhase("thinking");
        pushLevel(0);
        let audio: Blob | null = await recording.stop();
        const record = await analyzeLive(audio, info.sign, {
          presenterKey: state.presenterKey,
          signal: controller.signal,
          onStatus: (next) => setStatus(next),
        });
        audio = null;
        finish(record);
      };
      startRecording()
        .then((recording) => {
          if (cancelled) {
            recording.cancel();
            return;
          }
          recordingRef.current = recording;
          const started = performance.now();
          stopRef.current = () => void analyze(recording);
          const tick = () => {
            const seconds = (performance.now() - started) / 1000;
            setElapsed(seconds);
            pushLevel(recording.level());
            if (seconds >= LIVE_CLIP_SECONDS) {
              void analyze(recording);
              return;
            }
            frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        })
        .catch((error: unknown) => {
          const status = error instanceof MicrophoneError ? error.status : "microphone unavailable";
          const message = error instanceof Error ? error.message : "The microphone could not be opened.";
          finish({ source: "live", kind: "failed", status, message });
        });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      controller.abort();
      recordingRef.current?.cancel();
      recordingRef.current = null;
    };
    // Capture runs once per visit to this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clipSeconds = live ? LIVE_CLIP_SECONDS : SAMPLE_CLIP_SECONDS;
  const shownWords = live ? 0 : Math.round((elapsed / SAMPLE_CLIP_SECONDS) * transcript.split(" ").length);
  const words = transcript.split(" ");
  const canFinishEarly = live && phase === "listening" && elapsed >= LIVE_MIN_SECONDS;

  return (
    <section className="voice-screen" data-phase={phase} aria-labelledby="capture-title">
      <div className="voice-glow" />
      <div className="screen-head" style={{ position: "relative" }}>
        <span className={`label-tag${live ? " live" : ""}`}>{live ? "Live analysis" : "Demo sample · simulated"}</span>
        <button
          type="button"
          className="icon-btn"
          style={{ marginLeft: "auto" }}
          onClick={() => dispatch({ type: "back" })}
          aria-label="Stop and go back"
        >
          <Close />
        </button>
      </div>

      <h1 id="capture-title" className="sr-only">
        {phase === "listening" ? "Listening" : "Choosing your next question"}
      </h1>
      <p className="transcript" aria-live="off">
        {live ? (
          <span className="placeholder">
            {phase === "listening" ? "Start speaking… tell us how this morning is going." : "Thanks, that's plenty."}
          </span>
        ) : shownWords === 0 ? (
          <span className="placeholder">Start speaking…</span>
        ) : (
          <>
            {words.slice(0, shownWords).join(" ")}{" "}
            <span className="pending">{words.slice(shownWords).join(" ")}</span>
          </>
        )}
      </p>

      {phase === "thinking" ? (
        <p className="thinking-line" role="status">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {live && status ? `Analyzing (${status})…` : "Choosing your next question…"}
        </p>
      ) : null}

      <div className="voice-dock">
        <span className="state-label" role="status">
          {phase === "listening" ? "Listening" : "Thinking"}
        </span>
        <VoiceOrb state={phase} level={phase === "listening" ? level : 0} />
        {phase === "listening" ? (
          <>
            <Waveform levels={levels} />
            <div className="progress" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (elapsed / clipSeconds) * 100)}%` }} />
            </div>
            <span className="timer" aria-label={`${Math.floor(elapsed)} of ${clipSeconds} seconds`}>
              {formatClock(elapsed)} / {formatClock(clipSeconds)}
            </span>
            {live ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!canFinishEarly}
                onClick={() => stopRef.current?.()}
              >
                {canFinishEarly ? "I'm done" : `Keep going (${LIVE_MIN_SECONDS} s minimum)`}
              </button>
            ) : null}
          </>
        ) : (
          <span className="timer">{formatClock(clipSeconds)} recorded</span>
        )}
      </div>
    </section>
  );
}
