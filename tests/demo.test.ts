import { describe, expect, it } from "vitest";
import { QUESTIONS, SIGNS } from "@/lib/amplifier/signs";
import { recommend } from "@/lib/demo/recommend";
import {
  buildTrace,
  initialState,
  intakeSummary,
  questionOrder,
  reducer,
  sampleVoiceRecord,
  scenarioFromParam,
  type Action,
  type DemoState,
  type Scenario,
} from "@/lib/demo/state";
import { encodeWav, resample } from "@/lib/audio/wav";

function run(actions: Action[], start: DemoState = initialState()): DemoState {
  return actions.reduce(reducer, start);
}

const SAFE: Action[] = [
  { type: "chooseSlot", slot: "11:40" },
  { type: "setSafety", field: "keepsLiquidsDown", value: true },
  { type: "setSafety", field: "repeatedVomiting", value: false },
  { type: "setSafety", field: "headInjury", value: false },
  { type: "setSafety", field: "emergencySymptoms", value: false },
  { type: "submitSafety" },
];

function sampleRun(scenario: Scenario, extra: Action[] = []) {
  return run([{ type: "setScenario", scenario }, ...SAFE, { type: "startSample" }, { type: "voiceResult", record: sampleVoiceRecord(scenario) }, ...extra]);
}

describe("safety routes", () => {
  it("ends the branch with 911 guidance for emergency symptoms", () => {
    const state = run([...SAFE.slice(0, 4), { type: "setSafety", field: "emergencySymptoms", value: true }, { type: "submitSafety" }]);
    expect(state.step).toBe("emergency");
  });

  it("emergency outranks every other answer", () => {
    const state = run([
      { type: "chooseSlot", slot: "11:40" },
      { type: "setSafety", field: "keepsLiquidsDown", value: false },
      { type: "setSafety", field: "repeatedVomiting", value: true },
      { type: "setSafety", field: "headInjury", value: true },
      { type: "setSafety", field: "emergencySymptoms", value: true },
      { type: "submitSafety" },
    ]);
    expect(state.step).toBe("emergency");
  });

  it("routes inability to keep liquids down, repeated vomiting, or head injury to medical evaluation", () => {
    for (const [field, value] of [["keepsLiquidsDown", false], ["repeatedVomiting", true], ["headInjury", true]] as const) {
      const state = run([...SAFE.slice(0, 5), { type: "setSafety", field, value }, { type: "submitSafety" }]);
      expect(state.step).toBe("medical");
    }
  });

  it("waits until every safety question is answered", () => {
    expect(run([{ type: "chooseSlot", slot: "11:40" }, { type: "submitSafety" }]).step).toBe("safety");
  });
});

describe("fatigue walkthrough", () => {
  it("promotes the low-energy question and carries the confirmed answer through", () => {
    const state = sampleRun("voice-fatigue", [
      { type: "answer", question: "lowEnergy", value: true },
      { type: "answer", question: "thirst", value: true },
      { type: "answer", question: "nausea", value: false },
      { type: "submitQuestions" },
    ]);
    expect(questionOrder(state)[0]).toBe("lowEnergy");
    expect(QUESTIONS.lowEnergy.prompt).toBe("Is low energy one of your main concerns today?");
    expect(state.step).toBe("recommended");
    expect(intakeSummary(state)).toBe("Can keep fluids down. Main concerns are thirst and low energy.");
    expect(buildTrace(state).map((t) => t.label)).toEqual([
      "Simulated fatigue signal (consider)",
      "low-energy question",
      "customer confirmed",
      "recommendations updated",
    ]);
    const recs = recommend(state);
    expect(recs.drips[0].product.id).toBe("powerpack");
    expect(recs.drips.map((r) => r.product.price)).toEqual(["$224", "$109"]);
    expect(recs.ongoing.map((r) => r.product.id)).toEqual(["evolve", "supplements"]);
  });

  it("a 'no' keeps the answer and continues", () => {
    const state = sampleRun("voice-fatigue", [
      { type: "answer", question: "lowEnergy", value: false },
      { type: "answer", question: "thirst", value: true },
      { type: "answer", question: "nausea", value: false },
      { type: "submitQuestions" },
    ]);
    expect(state.step).toBe("recommended");
    expect(state.answers.questions.lowEnergy).toBe(false);
    expect(intakeSummary(state)).toBe("Can keep fluids down. Main concern is thirst.");
    expect(buildTrace(state)[2].label).toBe("customer said no");
    expect(recommend(state).drips[0].product.id).toBe("hydration");
  });

  it("needs the promoted question answered before continuing", () => {
    const state = sampleRun("voice-fatigue", [
      { type: "answer", question: "thirst", value: true },
      { type: "answer", question: "nausea", value: false },
      { type: "submitQuestions" },
    ]);
    expect(state.step).toBe("questions");
  });
});

describe("other signs", () => {
  const cases: [Scenario, keyof typeof QUESTIONS][] = [
    ["voice-dehydration", "thirst"],
    ["voice-stress", "stressed"],
    ["voice-anxiety", "tense"],
    ["voice-mood", "runDown"],
  ];

  it.each(cases)("%s promotes %s to the top and asks thirst and nausea once", (scenario, question) => {
    const state = sampleRun(scenario);
    const order = questionOrder(state);
    expect(order[0]).toBe(question);
    expect(order.filter((id) => id === "thirst")).toHaveLength(1);
    expect(order).toEqual(expect.arrayContaining(["thirst", "nausea"]));
  });

  it("dehydration confirmation leads with hydration", () => {
    const state = sampleRun("voice-dehydration", [
      { type: "answer", question: "thirst", value: true },
      { type: "answer", question: "nausea", value: false },
      { type: "submitQuestions" },
    ]);
    expect(recommend(state).drips[0].product.id).toBe("hydration");
    expect(buildTrace(state)[0].label).toBe("Simulated dehydration signal (consider)");
  });

  it("stress confirmation shows in the summary in plain words", () => {
    const state = sampleRun("voice-stress", [
      { type: "answer", question: "stressed", value: true },
      { type: "answer", question: "thirst", value: false },
      { type: "answer", question: "nausea", value: false },
      { type: "submitQuestions" },
    ]);
    expect(intakeSummary(state)).toBe("Can keep fluids down. Main concern is feeling stressed lately.");
  });

  it("customer-facing questions never name a sign or diagnosis", () => {
    const banned = ["fatigue", "dehydrat", "anxiety", "mood disruption", "depress", "diagnos", "detect", "condition", "signal"];
    expect(Object.keys(SIGNS)).toHaveLength(5);
    for (const { prompt } of Object.values(QUESTIONS)) {
      for (const word of banned) expect(prompt.toLowerCase()).not.toContain(word);
    }
  });
});

describe("standard path", () => {
  it("typed, unsuitable and timeout share the standard chooser", () => {
    const typed = run([...SAFE, { type: "typeInstead" }]);
    const unsuitable = sampleRun("voice-unsuitable");
    const timeout = sampleRun("voice-timeout");
    for (const state of [typed, unsuitable, timeout]) {
      expect(state.step).toBe("questions");
      expect(questionOrder(state)).toEqual(["thirst", "nausea"]);
      expect(buildTrace(state).map((t) => t.label)).toContain("Standard symptom chooser");
    }
  });

  it("a failed live analysis keeps its status and uses the standard chooser", () => {
    const state = run([...SAFE, { type: "voiceResult", record: { source: "live", kind: "failed", status: "HTTP 401 UNAUTHORIZED", message: "bad" } }]);
    expect(questionOrder(state)).toEqual(["thirst", "nausea"]);
    expect(buildTrace(state)[0].label).toBe("Live analysis failed: HTTP 401 UNAUTHORIZED");
    expect(reducer(state, { type: "useSampleInstead" })).toMatchObject({ step: "intake", liveEnabled: false, voice: null });
  });

  it("typed scenario skips the voice screen entirely", () => {
    expect(run([{ type: "setScenario", scenario: "typed" }, ...SAFE]).step).toBe("questions");
  });

  it("live consent is required before capture, and only when live is enabled", () => {
    expect(run([...SAFE, { type: "startLive" }]).step).toBe("intake");
    const enabled = run([{ type: "setLiveEnabled", enabled: true }, ...SAFE, { type: "startLive" }]);
    expect(enabled.step).toBe("consent");
    expect(reducer(enabled, { type: "consentGiven" })).toMatchObject({ step: "capture", captureMode: "live" });
  });
});

describe("booking and reset", () => {
  const recommended = sampleRun("voice-fatigue", [
    { type: "answer", question: "lowEnergy", value: true },
    { type: "answer", question: "thirst", value: true },
    { type: "answer", question: "nausea", value: false },
    { type: "submitQuestions" },
  ]);

  it("books with the chosen interest and time", () => {
    const booked = run(
      [
        { type: "setInterest", product: "powerpack" },
        { type: "continueToBooking" },
        { type: "chooseSlot", slot: "12:50" },
        { type: "requestVisit" },
      ],
      recommended,
    );
    expect(booked).toMatchObject({ step: "booked", slot: "12:50", interest: "powerpack" });
  });

  it("reset returns to the landing page and keeps the scenario", () => {
    const state = run([{ type: "setScenario", scenario: "voice-stress" }, ...SAFE]);
    expect(reducer(state, { type: "reset" })).toMatchObject({ step: "landing", scenario: "voice-stress", slot: null });
  });

  it("parses the hidden scenario URL parameter", () => {
    expect(scenarioFromParam("stress")).toBe("voice-stress");
    expect(scenarioFromParam("mood-disruption")).toBe("voice-mood");
    expect(scenarioFromParam("typed")).toBe("typed");
    expect(scenarioFromParam("nope")).toBeNull();
  });
});

describe("wav encoding", () => {
  it("writes a 16 kHz mono PCM header", () => {
    const samples = resample(new Float32Array(48_000).fill(0.5), 48_000);
    expect(samples.length).toBe(16_000);
    const view = new DataView(encodeWav(samples));
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.byteLength).toBe(44 + 32_000);
  });
});
