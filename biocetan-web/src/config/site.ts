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
  /** Needed for the real map, distance table and LocalBusiness JSON-LD (plan §3.1-7). */
  geo: null as { lat: number; lng: number } | null,
  /** Plan §11 Q3. The footer shows these only once they are set. */
  registration: {
    cui: null as string | null,
    regCom: null as string | null,
    shareCapital: null as string | null,
  },
} as const;
