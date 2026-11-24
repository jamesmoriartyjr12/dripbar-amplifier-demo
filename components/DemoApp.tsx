"use client";

import { useEffect, useReducer, useRef } from "react";
import { initialState, reducer, scenarioFromParam } from "@/lib/demo/state";
import { EmergencyStop, Landing, MedicalStop, Safety } from "./screens/Entry";
import { Capture, Consent, Intake } from "./screens/Voice";
import { Booked, Booking, Questions, Recommended } from "./screens/Results";

const KEY_STORAGE = "dripbar-demo-presenter-key";

/**
 * Demo switches live in the URL so nothing presenter-facing shows up for customers:
 * ?scenario=fatigue|dehydration|stress|anxiety|mood-disruption|unsuitable|timeout|typed
 * ?live=1 offers real recording when the server has Amplifier credentials and presenter access.
 */
export function DemoApp() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const firstRender = useRef(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    const scenario = scenarioFromParam(url.searchParams.get("scenario"));
    if (scenario) dispatch({ type: "setScenario", scenario });

    const key = url.searchParams.get("key");
    if (key !== null) {
      sessionStorage.setItem(KEY_STORAGE, key);
      url.searchParams.delete("key");
      window.history.replaceState(null, "", url);
    }
    const presenterKey = key ?? sessionStorage.getItem(KEY_STORAGE) ?? "";
    if (presenterKey) dispatch({ type: "setPresenterKey", key: presenterKey });

    if (url.searchParams.get("live") === "1") {
      fetch("/api/amplifier/status", {
        cache: "no-store",
        headers: presenterKey ? { "x-presenter-key": presenterKey } : {},
      })
        .then((response) => response.json())
        .then((status: { configured?: boolean; presenterAccess?: boolean }) => {
          if (status.configured && status.presenterAccess) dispatch({ type: "setLiveEnabled", enabled: true });
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
  }, [state.step]);

  const props = { state, dispatch };
  let screen;
  switch (state.step) {
    case "landing":
      screen = <Landing {...props} />;
      break;
    case "safety":
      screen = <Safety {...props} />;
      break;
    case "emergency":
      screen = <EmergencyStop {...props} />;
      break;
    case "medical":
      screen = <MedicalStop {...props} />;
      break;
    case "intake":
      screen = <Intake {...props} />;
      break;
    case "consent":
      screen = <Consent {...props} />;
      break;
    case "capture":
      screen = <Capture {...props} />;
      break;
    case "questions":
      screen = <Questions {...props} />;
      break;
    case "recommended":
      screen = <Recommended {...props} />;
      break;
    case "confirm":
      screen = <Booking {...props} />;
      break;
    case "booked":
      screen = <Booked {...props} />;
      break;
  }

  return (
    <div className="stage">
      <Ribbons />
      <div className="device" data-step={state.step}>
        <div className="statusbar" aria-hidden="true">
          <span>9:41</span>
          <span className="statusbar-icons">
            <i className="sb-signal" />
            <i className="sb-wifi" />
            <i className="sb-battery" />
          </span>
        </div>
        {state.step === "capture" ? null : (
          <header className="topbar">
            <span className="wordmark">
              <span className="wordmark-drop" aria-hidden="true" />
              <span>
                The <b>DRIPBaR</b>
              </span>
            </span>
            <span className={`pill${state.liveEnabled ? " pill-live" : ""}`}>
              <span className="pill-dot" aria-hidden="true" />
              {state.liveEnabled ? "Live analysis on" : "Demo mode"}
            </span>
          </header>
        )}
        <main key={state.step} className="main">
          {screen}
        </main>
        <footer className="footnote" hidden={state.step === "capture"}>
          Demo: sample appointments and a simulated booking.
          {state.step !== "landing" ? (
            <>
              {" "}
              <button type="button" className="link-btn" onClick={() => dispatch({ type: "reset" })}>
                Restart
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

const STRANDS = [-48, -32, -16, 0, 16, 32, 48];

/** Pearl ribbons behind the phone on wide screens; purely decorative. */
function Ribbons() {
  return (
    <svg className="ribbons" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="rib-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#cfd5de" stopOpacity="0.7" />
          <stop offset="0.7" stopColor="#d9f3ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f6e6f6" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="rib-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9f2e6" stopOpacity="0.7" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#c8cfdb" stopOpacity="0.6" />
          <stop offset="1" stopColor="#e9dcf7" stopOpacity="0.7" />
        </linearGradient>
        <filter id="rib-soft">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g fill="none" strokeLinecap="round" filter="url(#rib-soft)">
        <path d="M-80 260 C 260 80, 520 520, 820 360 S 1340 80, 1700 300" stroke="url(#rib-a)" strokeWidth="120" />
        <path d="M-60 820 C 240 560, 560 980, 900 720 S 1400 520, 1700 760" stroke="url(#rib-b)" strokeWidth="150" />
        <path d="M1240 -60 C 1080 260, 1500 420, 1300 700 S 1180 980, 1420 1080" stroke="url(#rib-a)" strokeWidth="90" />
        <path d="M300 -80 C 160 200, 520 360, 360 620 S 220 900, 420 1080" stroke="url(#rib-b)" strokeWidth="80" />
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth="1.4">
        {STRANDS.map((offset) => (
          <g
            key={offset}
            transform={`translate(0 ${offset})`}
            stroke={offset % 32 === 0 ? "#ffffff" : "#b9c1cc"}
            strokeOpacity={0.85 - Math.abs(offset) / 100}
          >
            <path d="M-80 260 C 260 80, 520 520, 820 360 S 1340 80, 1700 300" />
            <path d="M-60 820 C 240 560, 560 980, 900 720 S 1400 520, 1700 760" />
          </g>
        ))}
        {STRANDS.map((offset) => (
          <path
            key={`v${offset}`}
            transform={`translate(${offset} 0)`}
            stroke={offset % 32 === 0 ? "#ffffff" : "#b9c1cc"}
            strokeOpacity={0.8 - Math.abs(offset) / 100}
            d="M1240 -60 C 1080 260, 1500 420, 1300 700 S 1180 980, 1420 1080"
          />
        ))}
      </g>
    </svg>
  );
}
