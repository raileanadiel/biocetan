/**
 * Driving distances/times from Săcueni to reference markets, for the Facility & Logistics page.
 *
 * The client mockups showed distances that plan §3.1-7 flagged as implausible (e.g. a border
 * crossing ~90 km away described as "near Săcueni"). These figures are **computed**, not copied
 * from the mockups: routed 2026-09-22 via the public OSRM demo server (router.project-osrm.org,
 * OpenStreetMap road network) from Săcueni town centre (site.geo) to each destination's town
 * centre. Real, verifiable, but still an approximation — see the page's own caveat text. If the
 * client gives exact coordinates and a preferred routing provider, recompute and replace.
 */
/** Must match the keys under `distances.*` in en.json/ro.json — kept as a union so a typo fails type-check. */
export type RouteKey =
  'oradea' | 'debrecen' | 'bors' | 'clujNapoca' | 'budapest' | 'timisoara' | 'vienna';

export interface RouteInfo {
  destination: string;
  key: RouteKey;
  km: number;
  minutes: number;
  country: 'RO' | 'HU' | 'AT';
}

export const routes: RouteInfo[] = [
  { destination: 'Oradea', key: 'oradea', km: 45, minutes: 50, country: 'RO' },
  { destination: 'Debrecen', key: 'debrecen', km: 44, minutes: 50, country: 'HU' },
  { destination: 'Borș (RO–HU crossing)', key: 'bors', km: 46, minutes: 45, country: 'RO' },
  { destination: 'Cluj-Napoca', key: 'clujNapoca', km: 171, minutes: 185, country: 'RO' },
  { destination: 'Budapest', key: 'budapest', km: 285, minutes: 200, country: 'HU' },
  { destination: 'Timișoara', key: 'timisoara', km: 218, minutes: 211, country: 'RO' },
  { destination: 'Vienna', key: 'vienna', km: 526, minutes: 354, country: 'AT' },
];

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
