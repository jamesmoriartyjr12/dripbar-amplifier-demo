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
      <div className="device">
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
        <main key={state.step} className="main">
          {screen}
        </main>
        <footer className="footnote">
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
