import { PRODUCTS, type Product } from "./content";
import type { DemoState } from "./state";

export interface Recommendation {
  product: Product;
  reasons: string[];
  featured: boolean;
}

/**
 * Sample recommendation rules for the demo. Reasons quote the customer's own answers only;
 * nothing here says what the voice found, and a clinician confirms every option at the visit.
 */
export function recommend(state: DemoState): { drips: Recommendation[]; ongoing: Recommendation[] } {
  const { questions, symptoms } = state.answers;
  const thirst = questions.thirst === true;
  const queasy = questions.nausea === true;
  const lowEnergy = questions.lowEnergy === true || symptoms.includes("low-energy");
  const stressed = questions.stressed === true || questions.tense === true;
  const runDown = questions.runDown === true;

  const hydrationReasons = [
    thirst && "You said you're feeling thirsty",
    queasy && "You mentioned feeling queasy",
  ].filter(Boolean) as string[];
  const powerpackReasons = [
    lowEnergy && "You said low energy is a main concern",
    stressed && "You've been feeling stretched thin lately",
    runDown && "You've been feeling run down lately",
  ].filter(Boolean) as string[];

  const hydration: Recommendation = {
    product: PRODUCTS.hydration,
    reasons: hydrationReasons.length ? hydrationReasons : ["A simple place to start this morning"],
    featured: powerpackReasons.length === 0,
  };
  const powerpack: Recommendation = {
    product: PRODUCTS.powerpack,
    reasons: powerpackReasons.length ? powerpackReasons : ["If you'd like more than fluids today"],
    featured: powerpackReasons.length > 0,
  };
  const drips = powerpack.featured ? [powerpack, hydration] : [hydration, powerpack];

  const ongoing: Recommendation[] = [];
  if (lowEnergy || stressed || runDown) {
    ongoing.push(
      { product: PRODUCTS.evolve, reasons: ["If you'd like to come in regularly"], featured: false },
      { product: PRODUCTS.supplements, reasons: ["If you'd like help with an at-home routine"], featured: false },
    );
  }
  return { drips, ongoing };
}
