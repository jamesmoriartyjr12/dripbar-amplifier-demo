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
import { VoiceOrb } from "../VoiceOrb";
import { Close, Drip, Heading, Keyboard, Mic, Play, ScreenHead } from "../ui";

interface Props {
  state: DemoState;
  dispatch: Dispatch<Action>;
}

export function Intake({ state, dispatch }: Props) {
  return (
    <section className="screen intake-screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 2 of 4" />
      <p className="eyebrow">How you&apos;re feeling</p>
      <Heading>Tell us how you&apos;re feeling this morning</Heading>
      <p className="lede">Talk for about 22 seconds, like you&apos;d tell a friend. It helps us pick your next question.</p>
      <button
        type="button"
        className="talk-button"
        onClick={() => dispatch({ type: "startTalk" })}
        aria-describedby="talk-hint"
      >
        <VoiceOrb state="idle" />
        <span className="talk-label">
          <Mic /> <span>Tap to talk</span>
        </span>
      </button>
      <p id="talk-hint" className="talk-hint">
        {state.liveEnabled ? "About 22 seconds. We'll ask before the microphone turns on." : "About 22 seconds. We'll ask first, and the audio is discarded afterward."}
      </p>
      <div className="secondary-options" role="group" aria-label="Other ways to answer">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => dispatch({ type: "startSample" })}>
          <Play /> Use demo sample
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => dispatch({ type: "typeInstead" })}>
          <Keyboard /> Type instead
        </button>
      </div>
    </section>
  );
}

export function Consent({ state, dispatch }: Props) {
  return (
    <section className="screen">
      <ScreenHead onBack={() => dispatch({ type: "back" })} step="Step 2 of 4" />
      <p className="eyebrow">Before we record</p>
      <Heading>Is it okay to use your microphone?</Heading>
      <div className="card stack" style={{ gap: 10 }}>
        <p style={{ margin: 0 }}>When you continue, we&apos;ll record about 22 seconds of your voice.</p>
        {state.liveEnabled ? (
          <p style={{ margin: 0 }}>
            The recording is sent to our technology partner, Amplifier Health, for a voice analysis that helps choose
            your next question. It isn&apos;t a diagnosis.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            This is a demo: the recording stays on this device and isn&apos;t sent anywhere. The result you see next is
            simulated, and it isn&apos;t a diagnosis.
          </p>
        )}
        <p style={{ margin: 0 }}>The audio is discarded from this device {state.liveEnabled ? "after the analysis" : "as soon as you stop"}.</p>
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

function formatClock(seconds: number) {
  const whole = Math.min(99, Math.floor(seconds));
  return `0:${whole.toString().padStart(2, "0")}`;
}

function syntheticLevel(t: number) {
  return 0.35 + 0.3 * Math.sin(t * 7.1) * Math.sin(t * 2.3) + 0.25 * Math.abs(Math.sin(t * 13.7));
}

type MicSource = "pending" | "real" | "simulated";

export function Capture({ state, dispatch }: Props) {
  const [phase, setPhase] = useState<Phase>("listening");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState("");
  const [micSource, setMicSource] = useState<MicSource>("pending");
  const recordingRef = useRef<Recording | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const mode = state.captureMode;
  const live = mode === "live";
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
    };
    const showSimulatedResult = () => {
      stopRef.current = null;
      cancelAnimationFrame(frame);
      setPhase("thinking");
      pushLevel(0);
      const record = sampleVoiceRecord(state.scenario);
      timers.push(setTimeout(() => finish(record), record.kind === "timeout" ? 3200 : 1800));
    };
    /** Runs the 20-second timer; `read` supplies each frame's level. */
    const runClock = (read: (seconds: number) => number, done: () => void) => {
      const started = performance.now();
      const tick = () => {
        const seconds = (performance.now() - started) / 1000;
        setElapsed(Math.min(seconds, LIVE_CLIP_SECONDS));
        pushLevel(read(seconds));
        if (seconds >= LIVE_CLIP_SECONDS) {
          done();
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (mode === "sample") {
      const started = performance.now();
      const tick = () => {
        const progress = Math.min(1, (performance.now() - started) / SAMPLE_PLAYBACK_MS);
        setElapsed(progress * SAMPLE_CLIP_SECONDS);
        pushLevel(progress < 1 ? syntheticLevel(progress * 20) : 0);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        showSimulatedResult();
      };
      frame = requestAnimationFrame(tick);
    } else if (mode === "mic") {
      const simulate = () => {
        setMicSource("simulated");
        stopRef.current = showSimulatedResult;
        runClock(syntheticLevel, showSimulatedResult);
      };
      startRecording()
        .then((recording) => {
          if (cancelled) {
            recording.cancel();
            return;
          }
          recordingRef.current = recording;
          setMicSource("real");
          const stop = () => {
            recordingRef.current = null;
            recording.cancel();
            showSimulatedResult();
          };
          stopRef.current = stop;
          runClock(() => recording.level(), stop);
        })
        .catch(() => {
          if (!cancelled) simulate();
        });
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
          setMicSource("real");
          stopRef.current = () => void analyze(recording);
          runClock(() => recording.level(), () => void analyze(recording));
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

  const clipSeconds = mode === "sample" ? SAMPLE_CLIP_SECONDS : LIVE_CLIP_SECONDS;
  const words = transcript.split(" ");
  const shownWords = mode === "sample" ? Math.round((elapsed / SAMPLE_CLIP_SECONDS) * words.length) : 0;
  const recording = phase === "listening" && micSource !== "pending";
  const canStop = mode === "mic" ? recording : live && recording && elapsed >= LIVE_MIN_SECONDS;
  const tag = live
    ? "Live analysis"
    : mode === "sample"
      ? "Demo sample · simulated"
      : micSource === "simulated"
        ? "Simulated recording · no microphone"
        : "Your microphone · result simulated";

  let prompt: string;
  if (phase === "thinking") prompt = mode === "mic" ? "Thanks, that's plenty. Your recording was discarded." : "Thanks, that's plenty.";
  else if (micSource === "pending") prompt = "Opening your microphone…";
  else if (micSource === "simulated") prompt = "No microphone available, so we're simulating this recording.";
  else prompt = "Start speaking… tell us how this morning is going.";

  const heard = phase === "thinking" && mode === "sample" ? transcript : null;
  const stopLabel = canStop ? "Stop recording" : live ? `Keep going, ${LIVE_MIN_SECONDS} seconds minimum` : "Recording";

  return (
    <section className="voice-screen" data-phase={phase} aria-labelledby="capture-title">
      <div className="voice-glow" />
      <h1 id="capture-title" className="sr-only">
        {phase === "listening" ? "Listening" : "Choosing your next question"}
      </h1>
      <div className="voice-top">
        <p className={`transcript${heard || (phase === "thinking" && mode !== "sample") ? " heard" : ""}`} aria-live="off">
          {heard ? (
            heard
          ) : mode !== "sample" || shownWords === 0 ? (
            <span className={phase === "thinking" ? undefined : "placeholder"}>{mode === "sample" ? "Start speaking" : prompt}</span>
          ) : (
            <>
              {words.slice(0, shownWords).join(" ")}{" "}
              <span className="pending">{words.slice(shownWords).join(" ")}</span>
            </>
          )}
        </p>
        <button type="button" className="voice-close" onClick={() => dispatch({ type: "back" })} aria-label="Cancel and go back">
          <Close />
        </button>
      </div>
      <span className={`label-tag voice-tag${live ? " live" : ""}`}>{tag}</span>

      {phase === "thinking" ? (
        <div className="thinking-panel" role="status">
          <p>{live && status ? `Analyzing (${status})…` : "Choosing your next question…"}</p>
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <span className="dots-icon">
              <Drip />
            </span>
            <i />
          </span>
        </div>
      ) : null}

      <div className="voice-dock">
        <span className="state-label" role="status">
          {phase === "listening" ? (micSource === "pending" && mode !== "sample" ? "Starting" : "Listening") : "Thinking"}
        </span>
        {phase === "listening" && mode !== "sample" ? (
          <button type="button" className="orb-stop" disabled={!canStop} aria-label={stopLabel} onClick={() => stopRef.current?.()}>
            <VoiceOrb state="listening" level={level} />
          </button>
        ) : (
          <VoiceOrb state={phase} level={phase === "listening" ? level : 0} />
        )}
        <span className="timer" aria-label={`${Math.floor(elapsed)} of ${clipSeconds} seconds`}>
          {phase === "listening"
            ? `${formatClock(elapsed)} / ${formatClock(clipSeconds)}`
            : mode === "mic"
              ? `${formatClock(elapsed)} recorded · audio discarded`
              : `${formatClock(clipSeconds)} recorded`}
        </span>
        {phase === "listening" && mode !== "sample" ? (
          <span className="voice-hint" aria-hidden="true">
            {canStop ? "Tap the orb to stop" : live ? `Keep going (${LIVE_MIN_SECONDS} s minimum)` : " "}
          </span>
        ) : null}
      </div>
    </section>
  );
}
