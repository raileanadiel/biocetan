/**
 * Company facts used across the site. Values come from the client mockups
 * (IMPLEMENTATION_PLAN.md §2). Anything null is still missing from the client.
 */
export const site = {
  name: 'BIOCETAN',
  legalName: 'BIOCETAN S.R.L.',
  email: 'office@biocetan.ro',
  phone: { display: '+40 741 039 292', href: '+40741039292' },
  address: {
    street: 'Str. Letea Mare nr. 44',
    city: 'Săcueni',
    county: 'Bihor',
    countryCode: 'RO',
  },
  /** Opens the address in Google Maps. A link, not an embed: nothing third-party loads on our pages. */
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Str. Letea Mare 44, Săcueni, Bihor, Romania'),
  /**
   * Plan §3.1-7 flagged the mockups' map/distances as unreliable. This is the town centre of
   * Săcueni (geocoded via OpenStreetMap Nominatim, 2026-09-22) — OSM has no street-level match
   * for the exact address, so it is not the precise building. Good enough for a town-level map
   * pin and for routing distances (§3.1-7 asked to "recompute with real routing", done in
   * logistics.ts). Replace with the exact building coordinates if the client provides them.
   */
  geo: { lat: 47.3566688, lng: 22.0845336 } as { lat: number; lng: number } | null,
  /** Plan §11 Q3. The footer shows these only once they are set. */
  registration: {
    cui: null as string | null,
    regCom: null as string | null,
    shareCapital: null as string | null,
  },
} as const;
