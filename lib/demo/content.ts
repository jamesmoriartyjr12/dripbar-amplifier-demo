export const CLINIC = {
  name: "The DRIPBaR Huntington Beach",
  shortName: "Huntington Beach",
  menuUrl: "https://huntington-beach.thedripbar.com/services-menu/",
  membershipUrl: "https://huntington-beach.thedripbar.com/memberships/",
  supplementsUrl: "https://thedripbar.com/services-menu/wellness-services/oral-supplements/",
};

export const SAMPLE_SLOT = "11:40 a.m.";

export const SLOTS = [
  { id: "10:20", label: "10:20 a.m." },
  { id: "11:40", label: SAMPLE_SLOT, sample: true },
  { id: "12:50", label: "12:50 p.m." },
  { id: "2:10", label: "2:10 p.m." },
] as const;

export type SlotId = (typeof SLOTS)[number]["id"];

export function slotLabel(id: string | null): string {
  return SLOTS.find((slot) => slot.id === id)?.label ?? SAMPLE_SLOT;
}

export const OFFERINGS = {
  hydration: { id: "hydration", name: "100% Hydration", price: 109 },
  powerpack: { id: "powerpack", name: "Powerpack", price: 224 },
} as const;

export type OfferingId = keyof typeof OFFERINGS;

export type ProductId = OfferingId | "evolve" | "supplements";

export interface Product {
  id: ProductId;
  name: string;
  kind: "drip" | "ongoing";
  price: string;
  priceNote: string;
  blurb: string;
  url: string;
}

export const PRODUCTS: Record<ProductId, Product> = {
  hydration: {
    id: "hydration",
    name: OFFERINGS.hydration.name,
    kind: "drip",
    price: "$109",
    priceNote: "Local list price",
    blurb: "A straightforward fluids-first IV drip.",
    url: "https://huntington-beach.thedripbar.com/services-menu/",
  },
  powerpack: {
    id: "powerpack",
    name: OFFERINGS.powerpack.name,
    kind: "drip",
    price: "$224",
    priceNote: "Local list price",
    blurb: "A fuller IV option your clinician walks you through.",
    url: "https://huntington-beach.thedripbar.com/services-menu/",
  },
  evolve: {
    id: "evolve",
    name: "Evolve membership",
    kind: "ongoing",
    price: "Membership",
    priceNote: "Pricing at the clinic",
    blurb: "For guests who'd like to come in regularly.",
    url: "https://huntington-beach.thedripbar.com/memberships/",
  },
  supplements: {
    id: "supplements",
    name: "Oral Supplements",
    kind: "ongoing",
    price: "Practitioner-guided",
    priceNote: "Discussed at your visit",
    blurb: "Help with an at-home routine between visits.",
    url: "https://thedripbar.com/services-menu/wellness-services/oral-supplements/",
  },
};

export const OTHER_SYMPTOMS = [
  { id: "low-energy", label: "Low energy" },
  { id: "headache", label: "Headache" },
  { id: "body-aches", label: "Body aches" },
  { id: "trouble-focusing", label: "Trouble focusing" },
] as const;

export type SymptomId = (typeof OTHER_SYMPTOMS)[number]["id"];

/** Scripted words shown while the labeled demo sample "plays". */
export const SAMPLE_TRANSCRIPTS = {
  fatigue: "Rough night. I'm really thirsty and I just feel wiped out, like I can't get going this morning.",
  dehydration: "Long day in the sun yesterday and a late night. My mouth is so dry and I can't seem to catch up.",
  stress: "It's been a long week at work and last night didn't help. I just want to reset before Monday.",
  anxiety: "I didn't sleep great and I feel kind of wound up this morning. I just want to feel like myself.",
  "mood-disruption": "I'm feeling pretty flat today. Late night, not much sleep, and I'm dragging a bit.",
} as const;

/** Sample playback runs faster than real time so the walkthrough stays inside three minutes. */
export const SAMPLE_CLIP_SECONDS = 20;
export const SAMPLE_PLAYBACK_MS = 5000;
export const LIVE_CLIP_SECONDS = 20;
export const LIVE_MIN_SECONDS = 15;
