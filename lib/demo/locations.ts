/**
 * A small set of real DRIPBaR locations. Addresses, coordinates and prices come from each location's
 * page on thedripbar.com (schema.org LocalBusiness and Offer data), collected Nov 24, 2026.
 */

export type PricedItem = "hydration" | "powerpack" | "b12" | "tri-immune" | "b-complex" | "im-supercharged";

export interface DripLocation {
  id: string;
  name: string;
  shortName: string;
  address: string;
  lat: number;
  lng: number;
  url: string;
  prices: Record<PricedItem, number>;
}

function location(
  id: string,
  shortName: string,
  address: string,
  lat: number,
  lng: number,
  prices: Record<PricedItem, number>,
): DripLocation {
  return {
    id,
    name: `The DRIPBaR ${shortName}`,
    shortName,
    address,
    lat,
    lng,
    url: `https://thedripbar.com/locations/${id}/`,
    prices,
  };
}

export const LOCATIONS: DripLocation[] = [
  location("huntington-beach", "Huntington Beach", "19740 Beach Blvd, Huntington Beach, CA 92648", 33.675659, -117.989686, {
    hydration: 109,
    powerpack: 224,
    b12: 30,
    "tri-immune": 60,
    "b-complex": 35,
    "im-supercharged": 60,
  }),
  location("south-reno", "South Reno", "18140 Wedge Pkwy, Reno, NV 89511", 39.395101, -119.768816, {
    hydration: 99,
    powerpack: 199,
    b12: 25,
    "tri-immune": 35,
    "b-complex": 25,
    "im-supercharged": 50,
  }),
  location("naples", "Naples", "11216 Tamiami Trail N., Naples, FL 34110", 26.274533, -81.800361, {
    hydration: 109,
    powerpack: 224,
    b12: 25,
    "tri-immune": 35,
    "b-complex": 25,
    "im-supercharged": 50,
  }),
  location(
    "ft-lauderdale-south-harbor-plaza",
    "Fort Lauderdale",
    "1300B SE 17th St, Fort Lauderdale, FL 33316",
    26.099903,
    -80.132872,
    { hydration: 99, powerpack: 199, b12: 25, "tri-immune": 35, "b-complex": 25, "im-supercharged": 50 },
  ),
  location("greensboro", "Greensboro", "1004 Gardner Hill Drive, Jamestown, NC 27282", 36.00207, -79.910999, {
    hydration: 99,
    powerpack: 199,
    b12: 25,
    "tri-immune": 35,
    "b-complex": 25,
    "im-supercharged": 50,
  }),
  location("cranford-nj", "Cranford", "102A N Union Ave, Cranford, NJ 07016", 40.656492, -74.305916, {
    hydration: 99,
    powerpack: 199,
    b12: 25,
    "tri-immune": 35,
    "b-complex": 25,
    "im-supercharged": 50,
  }),
  location("newport-goddard-row", "Newport", "227 Goddard Row, Newport, RI 02840", 41.488726, -71.318223, {
    hydration: 129,
    powerpack: 199,
    b12: 25,
    "tri-immune": 35,
    "b-complex": 25,
    "im-supercharged": 50,
  }),
];

export const DEFAULT_LOCATION = LOCATIONS[0];

const ALIASES: Record<string, string> = {
  hb: "huntington-beach",
  reno: "south-reno",
  "fort-lauderdale": "ft-lauderdale-south-harbor-plaza",
  "ft-lauderdale": "ft-lauderdale-south-harbor-plaza",
  cranford: "cranford-nj",
  newport: "newport-goddard-row",
};

export function locationById(id: string | null | undefined): DripLocation | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  const resolved = ALIASES[key] ?? key;
  return LOCATIONS.find((loc) => loc.id === resolved) ?? null;
}

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestLocation(lat: number, lng: number): DripLocation {
  let best = DEFAULT_LOCATION;
  let bestDistance = Infinity;
  for (const loc of LOCATIONS) {
    const d = distanceKm(lat, lng, loc.lat, loc.lng);
    if (d < bestDistance) {
      best = loc;
      bestDistance = d;
    }
  }
  return best;
}
