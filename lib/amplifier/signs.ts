/** Slugs as listed under "Valid sign names" in the Amplifier Sign API reference. */
export const SIGN_SLUGS = ["fatigue", "dehydration", "stress", "anxiety", "mood-disruption"] as const;
export type SignSlug = (typeof SIGN_SLUGS)[number];

export function isSignSlug(value: unknown): value is SignSlug {
  return typeof value === "string" && (SIGN_SLUGS as readonly string[]).includes(value);
}

export type QuestionId = "lowEnergy" | "thirst" | "nausea" | "stressed" | "tense" | "runDown";

/**
 * Customer-facing questions. Plain language only: they ask how the person feels,
 * never name a condition or say what the voice "found".
 */
export const QUESTIONS: Record<QuestionId, { prompt: string; concern: string }> = {
  lowEnergy: { prompt: "Is low energy one of your main concerns today?", concern: "low energy" },
  thirst: { prompt: "Are you feeling thirsty or dried out?", concern: "thirst" },
  nausea: { prompt: "Are you feeling queasy right now?", concern: "nausea" },
  stressed: { prompt: "Have you been feeling stressed or stretched thin lately?", concern: "feeling stressed lately" },
  tense: { prompt: "Have you been feeling tense or unsettled lately?", concern: "feeling tense lately" },
  runDown: { prompt: "Have you been feeling low or run down lately?", concern: "feeling run down lately" },
};

/** Questions asked in every path, in standard order. */
export const BASE_QUESTIONS: QuestionId[] = ["thirst", "nausea"];

export const SIGNS: Record<SignSlug, { label: string; promotes: QuestionId }> = {
  fatigue: { label: "Fatigue", promotes: "lowEnergy" },
  dehydration: { label: "Dehydration", promotes: "thirst" },
  stress: { label: "Stress", promotes: "stressed" },
  anxiety: { label: "Anxiety", promotes: "tense" },
  "mood-disruption": { label: "Mood disruption", promotes: "runDown" },
};
