# BIOCETAN website — analysis & implementation plan

Prepared 2026-09-21 from the 32 images in this folder (no text, PDF, logo or photo source files exist — see §1).
Revised: v1 consolidated from 16 to **9 pages** (§4); form split into quick + detailed RFQ (§6); trust/content additions (§7.1). Previous 16-page version kept in the session scratchpad.

---

## 0. TL;DR

- The folder is **not raw content**. It is a finished *design direction*: 11 marketing posters + 21 full-page website mockups (11 pages, 3 duplicate versions, 2 sitemap/wireframe sheets). The client has already chosen the sitemap, visual style, page layouts, form fields and copy tone.
- So the job is **build the site the mockups describe**, and fix what is wrong in them. "Landing page" in the brief = the **Home page**; the mockups define a 16-page B2B site around it; **v1 consolidates it to 9 pages** (§4) because the real content is too thin for 16 without repeating itself. Plan is phased so Home + Contact can launch first.
- **Blocking gaps** (need from client before pixel-perfect work): logo as vector, original photos, legal entity data, real certifications, PDFs (TDS/SDS/CoA), and answers to ~10 factual contradictions (§3).
- **Recommended stack:** Astro + Tailwind + TypeScript, static output, on Cloudflare Pages; contact form = Pages Function + Turnstile + email API; EN + RO at launch, HU-ready. Rationale §8.
- **Rough effort:** ~3–4 weeks elapsed for one developer, most of the risk is content/asset delivery, not code (§9).

---

## 1. What is in the folder

### 1.1 Inventory

| Set | Count | What it is | Use it for |
|---|---|---|---|
| Root `26-09-06 10-*.png` | 11 | Marketing posters / infographics (1672×941 and 1536×1024). Overview, Facility, Process technology, Custom manufacturing, Feedstock→Product, Toll manufacturing, Custom formulation, Quality control, Pilot & R&D, Bulk & IBC logistics, RME | **Copy, tone, facts, slogans, iconography style**. Not layout. |
| `Imaginea Site/` `17-*` / `18-01` | 19 | Full-page website mockups, 1024 px wide | **Layout, sections, components, nav, footer, copy per page** |
| `Imaginea Site/` `17-59-16` and `18-04-34` | 2 | Sitemap + page overview + wireframes + header/footer + UI elements + design guidelines | **Information architecture, requirements checklist** |

All images are ≤ 1024 px wide for the mockups → **not usable as production assets**; crops are placeholders only.

### 1.2 Mockup ↔ page map (later version wins when duplicated)

| Page | Mockup file (timestamp) | Notes |
|---|---|---|
| Home | `17-01-09` | Only page with a 4-card product row + map band |
| Manufacturing (Made-to-Order) | `17-04-24` | 3 models: Made-to-Order / Toll / Custom |
| Toll Manufacturing | `17-41-01` | **Not in sitemap nav** — merged into `/services` (§4) |
| Products (hub) | `17-08-22` | |
| RME | `17-11-02` | |
| SFME | `17-13-33` | |
| SME | `17-15-13` (v1) → **`17-17-47` (v2, use this)** | v2 adds agrochemical + formulation blocks |
| Custom Esters | `17-19-40` | Only page listing feedstocks (camelina, safflower, linseed, castor…) |
| Custom Formulation | `17-21-50` | |
| Pilot & R&D | `17-23-44` | |
| Technology | `17-25-31` | |
| Quality | `17-28-02` (v1) → **`17-32-17` (v2, use this)** | v2 drops "Certified…" wording, adds glycerin/methanol analyses |
| Facility | `17-38-33` | |
| Logistics | `17-46-49` (v1) → **`17-49-32` (v2, use this)** | v2 has the full distance table |
| Contact | `17-55-19` | Only page with the phone, address, hours, form |
| About | `17-59-16` | |
| Sitemap / wireframes | `18-01-46`, `18-04-34` | Approved structure |

---

## 2. Facts extracted (single source of truth)

Facts that appear consistently across ≥ 2 sources. Anything not in this table is either disputed (§3) or missing (§11).

| Topic | Value |
|---|---|
| Legal name | BIOCETAN S.R.L. (® on the wordmark) |
| Tagline | *Vegetable Chemistry for a Cleaner Tomorrow* |
| Address | Str. Letea Mare nr. 44, Oraș Săcueni, Bihor County, Romania — near the Hungarian border |
| Phone / email / web | +40 741 039 292 · office@biocetan.ro · www.biocetan.ro |
| Hours | Mon–Fri 08:00–17:00 (EET) |
| Capacity | Up to **60 t/day** = 20 t per 8-h shift (⇒ 3 shifts). Posters say "10–60 MT/day"; typical batches 10–20 MT; pilot batches on request |
| Equipment | **2 independent production lines**; **4 × 15-ton** process vessels (separation, intermediate holding, blending/formulation); dedicated raw-material & finished-product storage tanks; in-house laboratory |
| Technology | Hydrodynamic cavitation + ultrasonic finishing (poster #1 names Hielscher); "waterless purification" (see §3.1) |
| Feedstocks | Rapeseed, sunflower, soybean, "other vegetable oils" (high-oleic, camelina, safflower, linseed, castor on request) |
| Products | RME, SFME, SME, custom esters; custom liquid formulations; glycerin (by-product) |
| Business models | Made-to-Order (they source oil) · Toll manufacturing (customer supplies oil) · Custom manufacturing/formulation (co-developed) · Pilot & R&D |
| Packaging / logistics | Bulk road tanker, 1,000 L IBC, drums/special packaging; EXW/FCA/DAP terms mentioned |
| Markets | Romania, Hungary, Austria, Czech Republic, Slovakia, Poland, Germany "and beyond" |
| Applications | Agrochemical carriers (EC/EW/OD/SC), coatings/paints/inks, lubricants, metalworking fluids, industrial cleaners & degreasers, polymers/plastics (plasticizers), industrial chemicals intermediates, soil stabilisation |
| QC parameters | Ester content (GC-FID, EN 14103), acid value (EN 14104), density (EN ISO 12185), viscosity (EN ISO 3104), water (EN ISO 12937 / Karl Fischer), flash point (EN ISO 3679), colour (EN ISO 6271), CFPP (EN 116) |
| Documents promised | CoA per batch, SDS, TDS, regulatory documentation |
| Language plan | EN default, RO, "optional HU" |

---

## 3. Problems found in the source material — must be resolved before build

The mockups look **AI-generated** (garbled/misspelled text such as "REQEUST A QUOTE" on the Contact page and "Neer the Hungarian border" in the Technology footer; the same tank labels in every image). They are good for *direction*, unreliable for *facts*. Each item below is a claim a B2B buyer could check.

### 3.1 Factual contradictions (ask client's process engineer)

| # | Issue | Where | Recommendation |
|---|---|---|---|
| 1 | **"Waterless — no conventional aqueous washing"** vs process flow that lists **"Washing"** | Posters `10-30`, `10-32`, `10-36` vs Technology `17-25` | Pick one and use it everywhere. It is also a headline differentiator, so it must be true. |
| 2 | **"Continuous process"** (Technology strip) vs batches, campaigns, 15-t vessels everywhere else | Technology `17-25` vs all others | Likely "batch"; confirm. |
| 3 | **Pilot plant "10–2,000 L reactors"** appears only on Pilot page; Facility/posters mention only 2 lines + four 15-t vessels | `17-23` vs `17-38` | Confirm a pilot unit exists. If not, remove the equipment box and say "pilot batches on the production line (10 t typical)". |
| 4 | **">98 % conversion"**, "low energy consumption", "reduced chemical waste" | Technology | Needs supporting data or soften. |
| 5 | **SFME / SME "high oxidative stability"** (SME even "especially high in unsaturated fatty acids") | `17-13`, `17-17` | Chemically doubtful: polyunsaturated (sunflower, soy) esters normally oxidise *faster* than rapeseed esters. Have the client's chemist rewrite these two feature lists. |
| 6 | **Identical "typical properties"** tables for RME/SFME/SME (only density differs) and they mirror EN 14214 fuel limits | `17-11`, `17-13`, `17-17` | Use real product data; keep "indicative" disclaimer; the site sells *industrial/technical* grade, so avoid implying fuel-grade compliance unless true. |
| 7 | **Distances/routes**: Săcueni–Oradea 60 km, "Petea" crossing at 70 km/50 min, "Direct access to A3" | Logistics `17-46`/`17-49`, Contact map | Looks off (Petea is on the Satu Mare side). **Recompute with real routing** and build the map from real coordinates, not the AI image. |

### 3.2 Claims that create legal / credibility risk

| # | Issue | Recommendation |
|---|---|---|
| 8 | Quality page lists **EN ISO 9001, EN ISO/IEC 17025, "Certified analysis", "Certified quality", "Regulatory compliance"** as if held | Confirm which certificates/accreditations exist. If none: reword to "analysed according to EN 14103 …" and drop the word *certified*. If some: show certificate PDFs + issuer + validity. |
| 9 | "Real facility. Real capabilities." / "Real photos" — while images appear synthetic | Commission a **half-day real photo shoot** (building, tanks, lines, lab, IBC/truck loading, team, drone). Highest-ROI item in the project for a B2B manufacturer. Until then, do not ship synthetic images under "real" captions. |
| 10 | Unquantified green claims ("lower environmental footprint", "cleaner tomorrow") | Keep as slogans; put any factual claim (e.g. "renewable feedstock", "no aqueous waste") only once verified. |
| 11 | Footer shows **Privacy / Terms / Cookies** but no legal content; **no company registration data** | Need CUI/VAT, Reg. Com. no., registered office, share capital for footer + legal pages. |

### 3.3 Design/UX inconsistencies to normalise

- **Heading colour**: Home uses navy; inner pages switch to an electric blue (~`#0413BA`). Standardise on navy.
- **CTA wording**: 12+ variants ("Request a Quote", "Contact / RFQ", "Start Your Project", "Discuss Your Application", "Get in Touch", …). Use **two**: primary *Request a Quote*, secondary *Talk to our experts* (contextual variants only in secondary).
- **Navigation**: 10 links + language + badge + CTA does not fit at 1024 px. Solved by the 9-page structure: 7 links + CTA, no dropdowns (§4.3).
- **Home hero**: mockup says "Custom Vegetable Methyl Esters"; overview sheet says "Vegetable Chemistry for a Cleaner Tomorrow". Recommendation: **H1 = the descriptive one (SEO)**, tagline as eyebrow/handwritten accent.
- **Duplicate versions** (SME, Quality, Logistics): use the later one (§1.2).
- **Toll Manufacturing** has a mockup but no sitemap entry → now a section of `/services`.
- **Downloads** (TDS/SDS/CoA) are CTAs on many pages but no documents exist → see §7.6.

---

## 4. Sitemap & page specs (v1 = 9 pages)

**Rule:** a page exists only if it can carry ≥ 300 words of *unique, verified* content. Otherwise it is a section of a bigger page. The 16 mockup pages repeat the same facts (capacity, 2 lines, 4×15 t, lab, IBC) on almost every page; 9 pages says each thing once, where it matters, and avoids thin/duplicate content for SEO.

### 4.1 URL map (EN at `/`, RO at `/ro/`, HU at `/hu/`)

```
/                     1  Home (landing)
/products             2  RME · SFME · SME · Custom esters + comparison table
/services             3  Made-to-Order · Toll manufacturing · Custom formulation · Pilot & R&D
/applications         4  By industry (agrochemicals first)
/technology           5
/quality              6
/facility-logistics   7
/about                8
/contact              9  Quick RFQ + detailed RFQ
/privacy  /cookies  /terms  /404      (not counted)
```

**Reserved, not built in v1** (split out in Phase 6 once real per-product / per-industry data exists): `/products/rme`, `/products/sfme`, `/products/sme`, `/products/custom-esters`, `/services/toll-manufacturing`, `/applications/agrochemicals`. On-page anchors (`#rme`, `#toll`) keep working and become 301s to the new pages.

### 4.2 What merged where

| v1 page | Built from mockups | What changes vs. the mockups |
|---|---|---|
| Home | `17-01-09`, overview sheet | Adds proof numbers, project steps, FAQ, inline quick form |
| Products | `17-08-22`, `17-11-02` (RME), `17-13-33` (SFME), `17-17-47` (SME), `17-19-40` (Custom) | 5 pages → 1, sticky sub-nav; **new real comparison table** |
| Services | `17-04-24` (Manufacturing), `17-41-01` (Toll), `17-21-50` (Formulation), `17-23-44` (Pilot & R&D) | 4 pages → 1; **new "which model fits you?" table** |
| Applications | Application grids repeated on every product/service page + agro block in `17-17-47` | Currently duplicated 8×; becomes one page, one section per industry |
| Technology | `17-25-31` | Unchanged scope; claims must be verified (§3.1) |
| Quality | `17-32-17` | Unchanged scope; certifications only if confirmed (§3.2) |
| Facility & Logistics | `17-38-33` + `17-49-32` | 2 pages → 1; real map + verified distances |
| About | `17-59-16` | Values trimmed 5 → 3–4; team/story when provided |
| Contact | `17-55-19` | Quick + detailed form (§6) |

### 4.3 Navigation

`[Logo]  Products · Services · Applications · Technology · Quality · Facility & Logistics · About · [EN ▾] · [Request a Quote]`

7 links + CTA fit from ~1200 px **without dropdowns**; below that the header switches to the hamburger menu (measured, the full nav needs about 1150 px). Long pages get a sticky in-page sub-nav (Products: RME | SFME | SME | Custom; Services: Made-to-Order | Toll | Formulation | Pilot). Mobile: hamburger + full-screen menu + **sticky bottom bar (Call · Email · Quote)**. Footer keeps the client's 3-column layout (Quick links / Contact / Made-in-Europe badge).

### 4.4 Page-by-page

**Rules for every page:** breadcrumb (inner pages) · one message per section, ≤ ~6 sections · body text ≥ 16 px · no repeated icon strips or capability panels (the capability stat strip appears only on Home and Facility) · one handwritten script accent on the whole site (Home hero) · closing CTA band · footer.

| Page | Goal | Sections (in order) | Primary CTA |
|---|---|---|---|
| **1 Home** | Explain in 10 s what BIOCETAN does; route to a service; get an RFQ | Hero (H1 *Custom Vegetable Methyl Esters*; sub-line **"Your feedstock. Your specification. Your product."**; tagline as eyebrow) → proof strip (10–60 t/day · 2 lines · 4×15 t · in-house lab — numbers only) → **3 ways to work with us** (Made-to-Order / Toll / Custom formulation) → Products teaser (4 cards) → How a project works (5 steps) → Applications teaser (6 cards) → Quality teaser + sample CoA → Location/logistics teaser + map → FAQ (6–8 Qs) → final CTA with **inline quick form** | Request a Quote |
| **2 Products** | Help a buyer pick an ester and ask for a quote | Intro + sub-nav → **comparison table RME / SFME / SME** (density, viscosity, acid value, ester content, CFPP, best for — *real values TBC*) → one section per product: overview, 4–5 verified key facts, typical properties (indicative), best-for applications, *Request a quote for {product}* (prefills form) → Custom esters: possible feedstocks + how a custom spec is developed → "manufactured to your spec; CoA per batch" → CTA. SFME/SME claims per §3.1-5 | Request a quote · Request TDS |
| **3 Services** | Explain the ways to work with us; reduce buyer risk | Intro + sub-nav → **"Which model fits you?" table** (Made-to-Order · Toll · Custom development · Pilot: *you provide* / *we provide* / *best for* / *typical volume*) → capabilities panel (2 lines · 4×15 t · 60 t/day · campaigns) shown once → one section per model with its own steps (Toll: confidentiality & IP; Formulation: base ester → additives → homogenisation → QC → packaging; Pilot: **verify §3.1-3**) → CTA | Start your project |
| **4 Applications** | Match traffic that searches by use, not by ester | One section per industry: **Agrochemicals** (carrier for EC/EW/OD/SC — lead section, most developed), Coatings/paints/inks, Lubricants & metalworking fluids, Industrial cleaners & degreasers, Polymers & plastics, Industrial chemicals / soil stabilisation. Each: what the ester does · suitable products · what we can adapt · CTA prefilled `?industry=` | Discuss your application |
| **5 Technology** | Differentiator | Process explanation → 5-stage flow (SVG, animated on scroll; **verify §3.1-1, -2**) → cavitation / ultrasound / automation cards → advantages (**only verified figures**) → CTA | Discuss your project |
| **6 Quality** | Trust | Approach → analytical capabilities & **methods table** (parameter · standard · what it tells you) → lab photo → 5-step quality process → **documents** (CoA sample / SDS / TDS / regulatory, or *Request documentation*) → certifications **only if §3.2-8 is confirmed** → CTA | Contact quality team |
| **7 Facility & Logistics** | Proof of capacity + delivery confidence | Stat strip → production lines → gallery + lightbox (storage, lab, loading) → **real interactive map** + verified distance table → loading & packaging (bulk, IBC 1,000 L, drums), Incoterms (EXW/FCA/DAP), documentation → visit CTA | Schedule a visit · Get a logistics quote |
| **8 About** | Who is behind it | Who we are (+2 photos) → approach → 3–4 values → location → team/story when supplied (**needs founding year, ownership**) → CTA | Contact us |
| **9 Contact** | Generate leads | Hero → contact card → **quick form** with "Add details" expansion → *What to send for a fast quote* checklist → map → visit card | Send request |
| Legal ×3 | Compliance | Privacy (GDPR), Cookies, Terms | — |


---

## 5. Design system

### 5.1 Colour (sampled from the mockups; confirm against the vector logo)

| Token | Hex | Use |
|---|---|---|
| `--navy-900` | `#002746` | Footer, dark bands, hero overlay (sampled) |
| `--navy-700` | `#082666` | Logo "CETAN", headings alt (sampled) |
| `--green-600` | `#458517` | **Buttons & links on light bg** — white text passes AA (4.5:1) (sampled) |
| `--green-400` | `#72AF33` / `#81BF44` | Accents **on navy only** — fails contrast on white (~2.7:1) (sampled) |
| `--green-900` | `#0B4A2B` | Forest-green panels, "Custom formulation" style bands (proposed) |
| `--mint-50` | `#F2F8F6` | Alternating section background (sampled ≈ `#EFF6F7`) |
| `--ink` | `#1F2A37` / muted `#5B6B7A` | Body text (proposed) |
| `--blue-facility` | `#1D4FC4` | Sparingly, from the building (proposed) |

Do **not** use the electric blue `#0413BA` from inner-page headings.

### 5.2 Typography

- Headings: **Montserrat** 700/800, uppercase for section titles (matches mockups)
- Body: **Inter** or Open Sans 400/500/600
- Script accent (handwritten taglines — "Real Chemistry. Real Solutions."): **Caveat** 600; decorative, `aria-hidden`, **one on the whole site (Home hero)**, hidden on mobile if it crowds
- **Self-host all fonts** (fontsource) — loading Google Fonts from Google's CDN is a known GDPR issue in Germany, one of the target markets
- Fluid type scale with `clamp()`; body 16–18 px, nothing below 14 px (mockups use 11–12 px)

### 5.3 Components (build once, reuse everywhere)

Header (sticky, shrink-on-scroll; no dropdowns needed) · In-page sub-nav · Footer · Breadcrumb · Hero (variants: photo-left-text, product-with-beaker) · Badge panel · Icon strip · Stat strip · Feature checklist (green tick) · Process steps (horizontal chevrons ⇄ vertical on mobile) · Product card · Spec table (property / value / test method) · Application card grid · Image gallery + lightbox · CTA band · Distance table · Map (click-to-load) · Download card · FAQ accordion · Quote form · Cookie banner · Language switcher · Toast/alerts · Comparison table · Model-selector table · Quick RFQ · Script-tagline (Home hero only).

Icon set: one consistent outline set (Lucide/Phosphor) recoloured to brand; **do not crop icons from the mockups**. Brand-specific glyphs (leaf, gear, flask, drum) redrawn as SVG.

### 5.4 Imagery

Hero/section images via `<picture>` AVIF+WebP, responsive `srcset`, art-directed crops for mobile, dark navy gradient overlay ≥ 60 % for text contrast, LCP image preloaded. Every image gets translated alt text.

### 5.5 Motion

Subtle only: fade/slide-up on scroll (IntersectionObserver, no library), number count-up on stat strip, button hover. All respect `prefers-reduced-motion`.

---

## 6. Contact / RFQ form

**Two levels, to cut friction (mockup has 11 fields):**
- **Quick RFQ** (Home, Contact): name, company, email, product/service, message, consent — 6 fields.
- **"Add details"** expands on Contact: phone, country, industry, volume, attachment. Country is auto-detected from the CDN header if left empty.
- Beside the form: **"What to send for a fast quote"** — product, volume, specification, delivery location, timing.

Full field list:

| Field | Type | Req. | Note |
|---|---|---|---|
| Company name | text | ✔ | |
| Contact person | text | ✔ | |
| Email | email | ✔ | |
| Phone | tel | – (required in mockup) | Forced phone lowers B2B conversion |
| Country | select | – (auto-detected if empty) | Priority list first: RO, HU, AT, CZ, SK, PL, DE |
| Industry / application | select | – (prefilled from /applications) | Agrochemicals · Coatings/paints/inks · Lubricants · Metalworking fluids · Industrial cleaners · Polymers/plastics · Industrial chemicals · Soil stabilisation · Other |
| Product / service | select | ✔ | RME · SFME · SME · Custom ester · Custom formulation · Toll manufacturing · Pilot batch / R&D · Logistics / packaging · Documentation (CoA/SDS/TDS) · Other |
| Estimated volume | text + unit (t/month · t/year · one-off) | – | |
| Message / project details | textarea | ✔ | min 20 chars |
| Attachment | file | – | ≤ 10 MB total; PDF, DOC(X), XLS(X), JPG/PNG; extension **and** MIME check |
| GDPR consent | checkbox (unticked) | ✔ | Link to Privacy Policy |
| *Hidden* | source page, product prefill (`?product=rme`), UTM params, locale | | Product and application sections link *Request a Quote* → `/contact?product=rme` or `?industry=agrochemicals` |
| *Anti-spam* | honeypot + Cloudflare Turnstile | | |

**Behaviour**
- Client + server validation with the same schema (zod); inline errors, `aria-live`, focus moves to first error.
- On success: inline confirmation ("We reply within 1 business day" — *only if client commits to it*), form reset, analytics event; on failure: keep data, show fallback email/phone.
- Needs JavaScript to submit (Cloudflare Turnstile cannot run without it). Visitors without JS see the email and phone instead. *(Changed from the original "works with JS off".)*
- Emails: (1) **internal** to office@biocetan.ro, `Reply-To` = submitter, subject `[RFQ] {product} — {company} ({country})`, attachments included; (2) **auto-reply** to submitter in their locale (copy of their request, no attachments).
- Rate-limit per IP (a Cloudflare WAF rate-limiting rule, configured in the dashboard); **backup copy** of each lead (e.g. KV/D1 or a Google Sheet webhook) so a mail failure never loses a lead.
- DNS: SPF + DKIM + DMARC on biocetan.ro before go-live, otherwise notifications land in spam.

---

## 7. "Everything a professional landing page has" — checklist

### 7.1 Conversion
- [ ] Single dominant CTA (*Request a Quote*) in header, hero, each section end, sticky mobile bar
- [ ] Click-to-call `tel:` and `mailto:` everywhere; optional WhatsApp (ask client)
- [ ] Trust strip: capacity, 2 lines, in-house lab, Made in Europe, (certifications *if real*)
- [ ] Clear process ("Requirement → Process → Quality → Delivery"), FAQ, sample CoA
- [ ] Numbers, not adjectives: batch size, MOQ, lead time, packaging sizes, Incoterms, tank capacities
- [ ] Real comparison table RME / SFME / SME (client-verified values)
- [ ] Buyer-question FAQ: REACH status, SDS, feedstock origin/traceability (non-GMO, sustainability certificates), sample policy, MOQ, lead time
- [ ] Short facility/drone video (60–90 s), if the client can film
- [ ] Customer logos / testimonials / case study **only if the client provides them — do not invent**

### 7.2 SEO
- [ ] Unique `<title>` (≤ 60 ch) + meta description (≤ 155 ch) per page and locale; one H1 per page
- [ ] `hreflang` EN/RO/(HU) + `x-default`, canonical, `sitemap.xml`, `robots.txt`
- [ ] JSON-LD: `Organization` (+ address, contactPoint), `Product` ×4 inside an `ItemList` on /products (no prices), `BreadcrumbList`, `FAQPage`
- [ ] Open Graph / Twitter cards with a generated 1200×630 image per page
- [ ] Keyword targets (EN): *vegetable methyl ester manufacturer*, *RME / SFME / SME supplier*, *FAME toll manufacturing Europe*, *custom ester formulation*, *agrochemical solvent methyl ester*; RO equivalents
- [ ] Off-site after launch: Google Search Console + Bing Webmaster, Google Business Profile (Săcueni), directory listings

### 7.3 Performance (Lighthouse mobile targets)
Performance ≥ 95 · Accessibility ≥ 95 · Best-practices ≥ 95 · SEO 100 · LCP < 2.5 s · CLS < 0.1 · INP < 200 ms · JS < 100 KB/page. Static HTML, image pipeline (AVIF/WebP), self-hosted fonts, JS only for menu, form, cookie banner, lightbox, map.

### 7.4 Accessibility (WCAG 2.2 AA)
Skip link · landmarks · visible focus · keyboard-operable dropdowns/accordion/lightbox · contrast checked (see green tokens) · labelled form fields · alt text · `lang` per page · reduced-motion.

### 7.5 Legal & privacy (EU/Romania)
- Privacy Policy (GDPR; controller, purposes, retention, processors — Cloudflare, email provider; ANSPDCP complaint right), Cookie Policy, Terms
- Company identification in footer (name, CUI/VAT, Reg. Com., address, contact)
- Consent banner (equal-weight *Accept / Reject / Choose*, nothing pre-ticked) **only if** non-essential cookies are used; recommended path is **cookieless analytics** (Plausible/Umami) → no tracking cookies, simpler compliance
- Map is **click-to-load** (no third-party requests before consent)

### 7.6 Content assets & downloads
- Downloads centre on Quality page: CoA (sample), SDS, TDS per product, regulatory docs. **Client must supply PDFs.** Until then, replace *Download* buttons with *Request documentation* (pre-fills form with "Documentation").
- Decide gating: TDS/CoA sample ungated (recommended); SDS on request.

### 7.7 Technical hygiene
- [ ] Favicon set + `site.webmanifest` + theme-color, Apple touch icon
- [ ] Custom 404 (+ helpful links), 301s from any old URLs, apex → `www` redirect (canonical host is `www.biocetan.ro`, as printed on the client's material), HTTPS/HSTS
- [ ] Security headers: CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors
- [ ] Print stylesheet for product pages (buyers print specs)
- [ ] Analytics events: `cta_click{location}`, `form_start`, `form_submit`, `download`, `tel_click`, `mail_click`, `lang_switch`
- [ ] Uptime monitoring + form-delivery test alert

---

## 8. Architecture & stack

### 8.1 Recommendation

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro** (static output) + TypeScript | Content-heavy marketing site; near-zero JS; built-in i18n routing, image pipeline, content collections; easiest path to Lighthouse 95+ |
| Styling | **Tailwind CSS v4** with tokens from §5 in one `tokens.css` | Fast to match mockups; consistent |
| Interactivity | Astro islands (vanilla TS / Preact only for form, nav, lightbox, map) | Keeps JS budget |
| Content | Markdown/JSON in `src/content/{locale}/…`, product data as typed collection (spec table, features, applications) → Products page renders every product from data (comparison table + per-product sections); per-product pages can be split out later without rework | One source of truth for specs; translators edit text only |
| i18n | Astro i18n, EN default at `/`, `/ro/`, `/hu/`; same slugs in all languages (simple); strings in JSON | HU can be added later without refactor |
| Hosting | **Cloudflare Pages** (+ Pages Functions) | Free/cheap, global CDN, large request bodies for 10 MB attachments (Netlify/Vercel serverless body limits are much smaller), same vendor as Turnstile |
| Form backend | `functions/api/contact.ts`: zod validate → Turnstile verify → email API (Resend or Brevo) → backup store | §6 |
| Maps | Leaflet/MapLibre + OSM tiles behind click-to-load, plus "View on Google Maps" link | No API key, GDPR-friendly |
| Analytics | Plausible or Umami (cookieless) | §7.5 |
| CI/CD | GitHub → Cloudflare Pages, preview URL per PR, Lighthouse CI + axe in CI | Client can review previews |
| CMS (optional, phase 6) | Keystatic or Decap (Git-based) so the client edits text without a developer | Only if client wants self-service |

**Alternative if the client insists on editing everything themselves:** WordPress + a lightweight block theme. Slower, more maintenance/security surface, weaker Lighthouse; I would still not recommend it for this scope.

### 8.2 Repo layout

```
biocetan-web/
├─ src/
│  ├─ components/{layout,ui,sections,forms}/
│  ├─ content/{en,ro,hu}/…          # pages + products
│  ├─ i18n/{en,ro,hu}.json
│  ├─ layouts/  pages/[...locale]/…
│  ├─ styles/tokens.css
│  └─ assets/{images,icons}/
├─ functions/api/contact.ts
├─ public/{favicons,docs/*.pdf,robots.txt}
└─ astro.config.mjs · tailwind · tsconfig · .github/workflows
```

---

## 9. Roadmap

Estimates are for one developer, rough, excluding client turnaround.

| Phase | Deliverable | Effort | Exit criteria |
|---|---|---|---|
| **0. Kickoff & content freeze** | Answers to §11, asset hand-over, final nav/URL map, decision on stack | ~1 week (client-dependent) | P0 items in §11 answered; asset folder received |
| **1. Foundation** ✅ *done 2026-09-21* | Repo, CI/CD, preview deploys, tokens, fonts, layout shell, header/footer, i18n scaffold, base components | 3 d | Blank pages deploy to preview; header/footer match mockup at 3 breakpoints |
| **2. MVP: Home + Contact** ✅ *done 2026-09-21* | Full Home, Contact page + working RFQ form end-to-end, legal stubs, 404, favicon | 5 d | **Launchable landing page.** Test lead reaches office@biocetan.ro; Lighthouse targets met |
| **3. Content pages** | Products (data-driven, comparison table), Services, Applications, Technology, Quality, Facility & Logistics (real map), About | 4–5 d | All 9 pages match approved design; content from §2/§3 resolved; comparison-table values signed off by client |
| **4. Localisation** | RO (launch), HU (optional) — strings, content, hreflang, localized emails | 2–3 d + translation | Language switcher preserves page; no untranslated strings |
| **5. Hardening & launch** | SEO pass, structured data, a11y audit (axe + manual keyboard/screen-reader), cross-browser/device, security headers, DNS/SPF/DKIM/DMARC, redirects, analytics, UAT | 3–4 d | Checklists §7 all ticked; client sign-off |
| **6. Post-launch** | Search Console/Bing, Business Profile, monitor form deliveries 2 weeks, split out per-product / per-industry pages once verified data exists, optional CMS | ongoing | 0 lost leads; indexed |

**Total ≈ 3–4 weeks elapsed.** Fastest credible path: ship Phases 1–2 (≈ 1.5 weeks after content freeze), then roll out pages.

**Phase 1 outcome** (code in `biocetan-web/`, see its README): Astro 7 + Tailwind 4 scaffold, tokens with an automated WCAG AA check, EN/RO i18n where a missing key fails type-check, sticky header + mobile menu + mobile action bar, footer, base components, dev-only styleguide, 9 pages + 3 legal pages + 404 as stubs, sitemap/robots, CI. Deviations from this plan:
- Full nav breaks to the hamburger below 1200 px (not 1024 px).
- Canonical URLs use a **trailing slash** (`/products/`), matching how Cloudflare Pages serves directory pages.
- Language switcher is an `EN | RO` link group instead of a dropdown.
- TypeScript pinned to 6.x: `@astrojs/check` does not support 7.x yet.
- Indexing is **off by default** (`PUBLIC_ALLOW_INDEXING`); enable only on the production deployment.
- Logo and favicon are placeholders until the client sends the vector logo.

**Phase 2 outcome:** Home page (10 sections, EN + RO), Contact page, RFQ form with a Cloudflare Pages Function backend, 3 draft legal pages, icons + manifest. Verified:
- **Backend:** 30 unit tests; checked by breaking the origin and file-signature checks and confirming tests fail. Also run against the real Pages runtime (`wrangler pages dev`) with a mock mail provider: valid lead with a PDF → 2 mails (team notification with reply-to = visitor, auto-reply in the visitor's language); spoofed file, bad input, missing captcha, honeypot and cross-origin posts are all rejected.
- **UI:** validation, prefill from `?product=` / `?industry=`, success panel with focus, real Turnstile widget (Cloudflare test keys), mobile (no horizontal overflow) and Romanian.
- **Lighthouse (production config, local server):** Performance / Accessibility / Best practices / SEO = 100 / 100 / 100 / 100 on Home mobile, Home desktop, RO Home and Contact. LCP 0.4 s desktop, 0.9 s mobile, CLS ≤ 0.035. **Caveat:** there are no photos yet; re-measure when real images arrive (Phase 3).

**Not verified — needs credentials or client input:** the exit criterion "a test lead reaches office@biocetan.ro" was proven against a mock provider only. It needs the real Resend key, the sender domain's SPF/DKIM/DMARC, real Turnstile keys and the `LEADS` KV binding (setup in `biocetan-web/README.md`).

Deviations from this plan:
- The form requires JavaScript (see §6); no thank-you page, the success message appears inline.
- **No map on Contact**: `config/site.ts` has no coordinates yet (§3.1-7), so it links to Google Maps instead of embedding one. The real click-to-load map arrives with Facility & Logistics (Phase 3).
- **No cookie banner**: the site sets no non-essential cookies. This holds only while analytics stays cookieless (§11 Q14).
- Legal pages are **drafts** with `[TODO: …]` markers. `npm run build:prod` fails while any remain, so they cannot ship unnoticed.
- Home has no photography (none exists): it is built from icons, type and colour, and will take photos without a redesign.
- Home copy uses only facts that appear consistently in the client material. FAQ answers on MOQ, lead time, REACH and samples are **left out** until §11 Q11 is answered.

### Definition of done (per page)
Matches mockup at 375 / 768 / 1280 / 1920 px · content approved by client · alt text + meta in every locale · axe: 0 serious issues · Lighthouse targets · analytics events firing · no console errors.

---

## 10. Assets I can and cannot derive from the folder

| Need | From folder? | Action |
|---|---|---|
| Logo (SVG, colour + white versions) | ✘ screenshots only | **Ask client** — vector/AI/PDF. Fallback: rebuild wordmark as SVG (approximate, needs approval) |
| Photos (facility, lab, tanks, team) | ✘ ≤ 1024 px, likely synthetic | **Ask client** for originals; commission shoot (§3.2-9) |
| Icons | ✘ | Redraw from a consistent icon set |
| Maps | ✘ AI maps | Build from real coordinates |
| Copy | ✔ ~90 % (EN) | Editorial pass; fix §3; write missing About/legal |
| Colours / fonts | ✔ approximate | §5; verify with logo file |
| Documents (TDS/SDS/CoA) | ✘ | **Ask client** |

---

## 11. Open questions for the client (priority order)

**P0 — blocks build**
1. Confirm v1 scope: the 9-page structure (§4, recommended) vs the original 16 pages vs a single landing page.
2. Vector logo + any brand guide; original photos/video; is a photo shoot possible?
3. Legal data: CUI/VAT, Reg. Com. no., share capital, registered office.
4. Certifications actually held (ISO 9001? 17025? others, e.g. sustainability schemes) — with certificates.
5. Answers to §3.1 items 1–7 (waterless vs washing, batch vs continuous, pilot plant, conversion figure, SFME/SME claims, real spec values, distances).

**P1 — needed before Phase 3**
6. Languages at launch (EN + RO recommended; HU when? DE later?) and who provides/approves translations.
7. Domain (biocetan.ro) registrar access, current email host, who receives leads, any CRM.
8. TDS / SDS / sample CoA PDFs; gated or open?
9. About content: founding year, story, team names/roles, ownership; any references/customers that can be named.
10. Response-time promise for the form; WhatsApp yes/no; visit scheduling policy.
11. Commercial facts for the site: real per-product values for the comparison table; MOQ, batch size, lead time, packaging sizes, Incoterms, sample policy; REACH/SDS status; feedstock origin & any non-GMO / sustainability certificates (these feed the FAQ).

**P2 — nice to have**
12. Who edits content after launch, how often (decides CMS).
13. Budget / deadline; hosting cost preference.
14. Analytics preference (cookieless vs GA4).

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Unverified technical/certification claims published | Legal, credibility with technical buyers | §3 sign-off gate before Phase 3 |
| Synthetic imagery labelled "real" | Loss of trust when buyers visit/audit | Real photo shoot; caption honestly meanwhile |
| Assets late | Schedule slip | Build with placeholders + design tokens; component swap later |
| Form mail lands in spam / lost | Lost leads (the site's whole purpose) | SPF/DKIM/DMARC, backup store, delivery alert, test from 3 mailbox providers |
| Wrong distances/map | Credibility, wrong delivery expectations | Real routing data, client sign-off |
| 3 languages × 9 pages of maintenance | Drift between versions | Content in typed collections; CI check for missing keys |
| Scope creep (blog, shop, portal) | Delay | Out of scope for v1; list for v2 |

**Out of scope for v1:** per-product and per-industry sub-pages (reserved routes, Phase 6), e-commerce/pricing, customer portal, blog/news (recommended for v2 SEO), live chat, CRM integration beyond email/webhook.
