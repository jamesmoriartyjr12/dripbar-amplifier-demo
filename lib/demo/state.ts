import { promotesQuestion, type SignalLevel } from "@/lib/amplifier/interpret";
import { BASE_QUESTIONS, QUESTIONS, SIGNS, type QuestionId, type SignSlug } from "@/lib/amplifier/signs";
import { OTHER_SYMPTOMS, type ProductId, type SymptomId } from "./content";
import { recommend } from "./recommend";

export type Scenario =
  | "voice-fatigue"
  | "voice-dehydration"
  | "voice-stress"
  | "voice-anxiety"
  | "voice-mood"
  | "voice-unsuitable"
  | "voice-timeout"
  | "typed";
export type Step =
  | "landing"
  | "safety"
  | "emergency"
  | "medical"
  | "intake"
  | "consent"
  | "capture"
  | "questions"
  | "recommended"
  | "confirm"
  | "booked";

export type Source = "sample" | "live";

export type VoiceRecord =
  | { source: Source; kind: "signal"; sign: SignSlug; level: SignalLevel; issues: string[] }
  | { source: Source; kind: "unsuitable"; sign: SignSlug; level: SignalLevel | null; issues: string[] }
  | { source: Source; kind: "timeout"; sign: SignSlug }
  | { source: "live"; kind: "failed"; status: string; message: string };

export interface SafetyAnswers {
  keepsLiquidsDown: boolean | null;
  repeatedVomiting: boolean | null;
  headInjury: boolean | null;
  emergencySymptoms: boolean | null;
}

export interface DemoState {
  scenario: Scenario;
  liveEnabled: boolean;
  presenterKey: string;
  step: Step;
  slot: string | null;
  safety: SafetyAnswers;
  captureMode: Source;
  typedInstead: boolean;
  voice: VoiceRecord | null;
  answers: {
    questions: Partial<Record<QuestionId, boolean>>;
    symptoms: SymptomId[];
    note: string;
  };
  /** Product the customer wants to talk about at the visit; the clinician still decides. */
  interest: ProductId | null;
}

interface ScenarioInfo {
  id: Scenario;
  label: string;
  hint: string;
  sign: SignSlug;
  sample: "consider" | "unsuitable" | "timeout" | null;
}

export const SCENARIOS: ScenarioInfo[] = [
  { id: "voice-fatigue", label: "Fatigue · scripted walkthrough", hint: "Simulated fatigue at “consider”", sign: "fatigue", sample: "consider" },
  { id: "voice-dehydration", label: "Dehydration", hint: "Simulated dehydration at “consider”", sign: "dehydration", sample: "consider" },
  { id: "voice-stress", label: "Stress", hint: "Simulated stress at “consider”", sign: "stress", sample: "consider" },
  { id: "voice-anxiety", label: "Anxiety", hint: "Simulated anxiety at “consider”", sign: "anxiety", sample: "consider" },
  { id: "voice-mood", label: "Mood disruption", hint: "Simulated mood disruption at “consider”", sign: "mood-disruption", sample: "consider" },
  { id: "voice-unsuitable", label: "Unsuitable audio", hint: "Simulated background-noise issue", sign: "fatigue", sample: "unsuitable" },
  { id: "voice-timeout", label: "Analysis timeout", hint: "Simulated timeout", sign: "fatigue", sample: "timeout" },
  { id: "typed", label: "Typed intake (control arm)", hint: "No voice step offered", sign: "fatigue", sample: null },
];

export function scenarioFromParam(param: string | null): Scenario | null {
  if (!param) return null;
  const id = param === "mood-disruption" ? "voice-mood" : param === "typed" ? "typed" : `voice-${param}`;
  return SCENARIOS.some((item) => item.id === id) ? (id as Scenario) : null;
}

export function scenarioInfo(scenario: Scenario): ScenarioInfo {
  return SCENARIOS.find((item) => item.id === scenario) ?? SCENARIOS[0];
}

const EMPTY_SAFETY: SafetyAnswers = {
  keepsLiquidsDown: null,
  repeatedVomiting: null,
  headInjury: null,
  emergencySymptoms: null,
};

function journey(): Omit<DemoState, "scenario" | "liveEnabled" | "presenterKey"> {
  return {
    step: "landing",
    slot: null,
    safety: EMPTY_SAFETY,
    captureMode: "sample",
    typedInstead: false,
    voice: null,
    answers: { questions: {}, symptoms: [], note: "" },
    interest: null,
  };
}

export function initialState(): DemoState {
  return { ...journey(), scenario: "voice-fatigue", liveEnabled: false, presenterKey: "" };
}

/** What the sample path returns for each scenario. Labeled as simulated everywhere it appears. */
export function sampleVoiceRecord(scenario: Scenario): VoiceRecord {
  const info = scenarioInfo(scenario);
  if (info.sample === "unsuitable") {
    return { source: "sample", kind: "unsuitable", sign: info.sign, level: "inconclusive", issues: ["high_background_noise"] };
  }
  if (info.sample === "timeout") return { source: "sample", kind: "timeout", sign: info.sign };
  return { source: "sample", kind: "signal", sign: info.sign, level: "consider", issues: [] };
}

export type SafetyRoute = "emergency" | "medical" | "continue";

export function routeSafety(safety: SafetyAnswers): SafetyRoute {
  if (safety.emergencySymptoms) return "emergency";
  if (safety.keepsLiquidsDown === false || safety.repeatedVomiting || safety.headInjury) return "medical";
  return "continue";
}

export type Action =
  | { type: "setScenario"; scenario: Scenario }
  | { type: "setLiveEnabled"; enabled: boolean }
  | { type: "setPresenterKey"; key: string }
  | { type: "chooseSlot"; slot: string }
  | { type: "setSafety"; field: keyof SafetyAnswers; value: boolean }
  | { type: "submitSafety" }
  | { type: "startSample" }
  | { type: "startLive" }
  | { type: "consentGiven" }
  | { type: "typeInstead" }
  | { type: "voiceResult"; record: VoiceRecord }
  | { type: "answer"; question: QuestionId; value: boolean }
  | { type: "toggleSymptom"; symptom: SymptomId }
  | { type: "setNote"; note: string }
  | { type: "submitQuestions" }
  | { type: "setInterest"; product: ProductId | null }
  | { type: "continueToBooking" }
  | { type: "setFollowUpOptIn"; optIn: boolean }
  | { type: "requestVisit" }
  | { type: "back" }
  | { type: "useSampleInstead" }
  | { type: "reset" };

/** The question a usable voice result moved to the top, if any. */
export function promotedQuestion(state: DemoState): QuestionId | null {
  if (state.typedInstead || state.scenario === "typed") return null;
  const voice = state.voice;
  if (voice?.kind !== "signal" || !promotesQuestion(voice)) return null;
  return SIGNS[voice.sign].promotes;
}

/** Ordered yes/no questions for the customer. Thirst and nausea are asked in every path. */
export function questionOrder(state: DemoState): QuestionId[] {
  const promoted = promotedQuestion(state);
  if (!promoted) return BASE_QUESTIONS;
  return [promoted, ...BASE_QUESTIONS.filter((id) => id !== promoted)];
}

export function questionsComplete(state: DemoState): boolean {
  return questionOrder(state).every((id) => typeof state.answers.questions[id] === "boolean");
}

const BACK: Partial<Record<Step, Step>> = {
  safety: "landing",
  intake: "safety",
  consent: "intake",
  capture: "intake",
  recommended: "questions",
  confirm: "recommended",
};

function stillRecommended(state: DemoState, product: ProductId | null): ProductId | null {
  if (!product) return null;
  const { drips, ongoing } = recommend(state);
  return [...drips, ...ongoing].some((rec) => rec.product.id === product) ? product : null;
}

const clearedAnswers = (state: DemoState) => ({ ...state.answers, questions: {} });

export function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "setScenario":
      return { ...state, ...journey(), scenario: action.scenario };
    case "setLiveEnabled":
      return { ...state, liveEnabled: action.enabled };
    case "setPresenterKey":
      return { ...state, presenterKey: action.key };
    case "chooseSlot":
      return { ...state, slot: action.slot, step: state.step === "landing" ? "safety" : state.step };
    case "setSafety":
      return { ...state, safety: { ...state.safety, [action.field]: action.value } };
    case "submitSafety": {
      if (Object.values(state.safety).some((value) => value === null)) return state;
      const route = routeSafety(state.safety);
      if (route === "emergency") return { ...state, step: "emergency" };
      if (route === "medical") return { ...state, step: "medical" };
      return { ...state, step: state.scenario === "typed" ? "questions" : "intake" };
    }
    case "startSample":
      return { ...state, captureMode: "sample", typedInstead: false, voice: null, step: "capture" };
    case "startLive":
      return state.liveEnabled ? { ...state, typedInstead: false, voice: null, step: "consent" } : state;
    case "consentGiven":
      return state.liveEnabled ? { ...state, captureMode: "live", step: "capture" } : state;
    case "typeInstead":
      return { ...state, typedInstead: true, voice: null, step: "questions", answers: clearedAnswers(state) };
    case "voiceResult":
      return { ...state, voice: action.record, step: "questions", answers: clearedAnswers(state) };
    case "answer":
      return {
        ...state,
        answers: { ...state.answers, questions: { ...state.answers.questions, [action.question]: action.value } },
      };
    case "toggleSymptom": {
      const has = state.answers.symptoms.includes(action.symptom);
      const symptoms = has
        ? state.answers.symptoms.filter((symptom) => symptom !== action.symptom)
        : [...state.answers.symptoms, action.symptom];
      return { ...state, answers: { ...state.answers, symptoms } };
    }
    case "setNote":
      return { ...state, answers: { ...state.answers, note: action.note.slice(0, 500) } };
    case "submitQuestions":
      if (!questionsComplete(state)) return state;
      return { ...state, step: "recommended", interest: stillRecommended(state, state.interest) };
    case "setInterest":
      return { ...state, interest: stillRecommended(state, action.product) };
    case "continueToBooking":
      return state.step === "recommended" ? { ...state, step: "confirm", slot: state.slot ?? "11:40" } : state;
    case "requestVisit":
      return state.step === "confirm" ? { ...state, step: "booked" } : state;
    case "back": {
      if (state.step === "questions") {
        return { ...state, step: state.scenario === "typed" ? "safety" : "intake" };
      }
      const previous = BACK[state.step];
      return previous ? { ...state, step: previous } : state;
    }
    case "useSampleInstead": {
      const keepStep = state.step === "landing" || state.step === "safety" || state.step === "emergency" || state.step === "medical";
      return { ...state, liveEnabled: false, voice: null, typedInstead: false, step: keepStep ? state.step : "intake" };
    }
    case "reset":
      return { ...state, ...journey() };
    default:
      return state;
  }
}

export function confirmedConcerns(state: DemoState): string[] {
  const { questions, symptoms } = state.answers;
  const concerns: string[] = [];
  for (const id of questionOrder(state)) {
    if (questions[id] === true) concerns.push(QUESTIONS[id].concern);
  }
  if (symptoms.includes("low-energy") && !concerns.includes("low energy")) concerns.push("low energy");
  for (const symptom of OTHER_SYMPTOMS) {
    if (symptom.id !== "low-energy" && symptoms.includes(symptom.id)) concerns.push(symptom.label.toLowerCase());
  }
  // Clinic note leads with thirst, then energy, matching how staff read the card.
  const order = ["thirst", "low energy"];
  return concerns.sort((a, b) => rank(a, order) - rank(b, order));
}

function rank(value: string, order: string[]): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function intakeSummary(state: DemoState): string {
  const concerns = confirmedConcerns(state);
  const fluids = state.safety.keepsLiquidsDown ? "Can keep fluids down." : "Fluids status not confirmed.";
  if (concerns.length === 0) return `${fluids} No main concerns selected.`;
  if (concerns.length === 1) return `${fluids} Main concern is ${concerns[0]}.`;
  return `${fluids} Main concerns are ${joinList(concerns)}.`;
}

/** The promoted question the customer answered "yes" to. */
export function confirmedPromotion(state: DemoState): QuestionId | null {
  const promoted = promotedQuestion(state);
  return promoted && state.answers.questions[promoted] === true ? promoted : null;
}

export type TraceTone = "signal" | "question" | "answer" | "result" | "muted";
export interface TraceItem {
  label: string;
  tone: TraceTone;
}

const SHORT_QUESTION: Record<QuestionId, string> = {
  lowEnergy: "low-energy question",
  thirst: "thirst question",
  nausea: "nausea question",
  stressed: "“stressed lately” question",
  tense: "“tense lately” question",
  runDown: "“run down lately” question",
};

export function buildTrace(state: DemoState): TraceItem[] {
  const voice = state.voice;
  const sourceLabel = voice?.source === "live" ? "Live" : "Simulated";
  const intakeDone = ["recommended", "confirm", "booked"].includes(state.step);
  const trace: TraceItem[] = [];

  if (state.scenario === "typed") {
    trace.push({ label: "Typed intake (control arm)", tone: "muted" });
  } else if (state.typedInstead) {
    trace.push({ label: "Customer chose to type", tone: "muted" });
  } else if (!voice) {
    trace.push({ label: "Waiting for voice or typed intake", tone: "muted" });
    return trace;
  } else if (voice.kind === "signal") {
    trace.push({ label: `${sourceLabel} ${SIGNS[voice.sign].label.toLowerCase()} signal (${voice.level})`, tone: "signal" });
  } else if (voice.kind === "unsuitable") {
    trace.push({ label: `${sourceLabel} audio unsuitable`, tone: "muted" });
  } else if (voice.kind === "timeout") {
    trace.push({ label: `${sourceLabel} analysis timeout`, tone: "muted" });
  } else {
    trace.push({ label: `Live analysis failed: ${voice.status}`, tone: "muted" });
  }

  const promoted = promotedQuestion(state);
  if (promoted) {
    trace.push({ label: SHORT_QUESTION[promoted], tone: "question" });
    const answer = state.answers.questions[promoted];
    if (answer === true) trace.push({ label: "customer confirmed", tone: "answer" });
    else if (answer === false) trace.push({ label: "customer said no", tone: "answer" });
  } else {
    trace.push({ label: "Standard symptom chooser", tone: "question" });
  }

  if (intakeDone) trace.push({ label: "recommendations updated", tone: "result" });
  return trace;
}
