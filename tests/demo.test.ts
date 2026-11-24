import { existsSync } from "node:fs";
import { join } from "node:path";
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
import { ADD_ONS, PRODUCTS, productPrice } from "@/lib/demo/content";
import { DEFAULT_LOCATION, LOCATIONS, locationById, nearestLocation } from "@/lib/demo/locations";
import { currentLocation } from "@/lib/demo/state";

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

  it("tap to talk always asks for consent before the microphone opens", () => {
    const demo = run([...SAFE, { type: "startTalk" }]);
    expect(demo.step).toBe("consent");
    expect(reducer(demo, { type: "consentGiven" })).toMatchObject({ step: "capture", captureMode: "mic" });
    const enabled = run([{ type: "setLiveEnabled", enabled: true }, ...SAFE, { type: "startTalk" }]);
    expect(reducer(enabled, { type: "consentGiven" })).toMatchObject({ step: "capture", captureMode: "live" });
    expect(run([...SAFE, { type: "consentGiven" }]).step).toBe("intake");
    expect(run([{ type: "startTalk" }]).step).toBe("landing");
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

  it("drops a selected product that is no longer recommended after answers change", () => {
    const changed = run(
      [
        { type: "setInterest", product: "evolve" },
        { type: "back" },
        { type: "answer", question: "lowEnergy", value: false },
        { type: "submitQuestions" },
      ],
      recommended,
    );
    expect(changed.interest).toBeNull();
    const kept = run([{ type: "setInterest", product: "hydration" }, { type: "back" }, { type: "submitQuestions" }], recommended);
    expect(kept.interest).toBe("hydration");
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

describe("nearest location and add-ons", () => {
  it("picks the nearest DRIPBaR from coordinates", () => {
    expect(nearestLocation(33.66, -117.99).id).toBe("huntington-beach"); // Huntington Beach
    expect(nearestLocation(34.05, -118.24).id).toBe("huntington-beach"); // Los Angeles
    expect(nearestLocation(39.53, -119.81).id).toBe("south-reno"); // Reno
    expect(nearestLocation(25.76, -80.19).id).toBe("ft-lauderdale-south-harbor-plaza"); // Miami
    expect(nearestLocation(40.71, -74.0).id).toBe("cranford-nj"); // New York
    expect(nearestLocation(41.82, -71.41).id).toBe("newport-goddard-row"); // Providence
    expect(nearestLocation(35.23, -80.84).id).toBe("greensboro"); // Charlotte
  });

  it("resolves ?loc= ids and aliases, and ignores unknown ones", () => {
    expect(locationById("naples")?.shortName).toBe("Naples");
    expect(locationById("Reno")?.id).toBe("south-reno");
    expect(locationById("nowhere")).toBeNull();
    expect(reducer(initialState(), { type: "setLocation", locationId: "nowhere" }).locationId).toBe(DEFAULT_LOCATION.id);
  });

  it("prices drips and add-ons at the chosen location", () => {
    const reno = reducer(initialState(), { type: "setLocation", locationId: "south-reno" });
    expect(productPrice(PRODUCTS.hydration, currentLocation(reno))).toBe("$99");
    expect(productPrice(PRODUCTS.powerpack, currentLocation(reno))).toBe("$199");
    expect(productPrice(PRODUCTS.evolve, currentLocation(reno))).toBe("Membership");
    expect(productPrice(PRODUCTS.hydration, DEFAULT_LOCATION)).toBe(PRODUCTS.hydration.price);
    for (const loc of LOCATIONS) for (const addOn of ADD_ONS) expect(loc.prices[addOn.priceKey]).toBeGreaterThan(0);
  });

  it("gives every location a street address and a bundled map thumbnail", () => {
    for (const loc of LOCATIONS) {
      expect(loc.address).toMatch(/^\d+\w* .+, .+, [A-Z]{2} \d{5}$/);
      expect(loc.map).toBe(`/maps/${loc.id}.webp`);
      expect(existsSync(join(process.cwd(), "public", loc.map))).toBe(true);
    }
  });

  it("toggles add-ons, clears them on reset, and keeps the location", () => {
    const state = run([
      { type: "setLocation", locationId: "naples" },
      { type: "toggleAddOn", addOn: "b12" },
      { type: "toggleAddOn", addOn: "tri-immune" },
      { type: "toggleAddOn", addOn: "b12" },
    ]);
    expect(state.addOns).toEqual(["tri-immune"]);
    expect(reducer(state, { type: "reset" })).toMatchObject({ addOns: [], locationId: "naples" });
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
