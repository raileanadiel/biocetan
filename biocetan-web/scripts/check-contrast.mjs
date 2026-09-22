// Verifies the design-token colour pairs meet WCAG 2.2 AA. Parses src/styles/global.css so the
// tokens stay the single source of truth. Run: npm run check:contrast
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const colors = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum ratio, what it is used for]
const pairs = [
  ['ink', 'white', 4.5, 'body text'],
  ['ink', 'mint-50', 4.5, 'body text on mint'],
  ['muted', 'white', 4.5, 'secondary text'],
  ['muted', 'mint-50', 4.5, 'secondary text on mint'],
  ['navy-900', 'white', 4.5, 'headings'],
  ['navy-900', 'mint-50', 4.5, 'headings on mint'],
  ['navy-900', 'mint-100', 4.5, 'active language link'],
  ['logo-blue', 'white', 4.5, 'logo'],
  ['white', 'green-600', 4.5, 'primary button'],
  ['white', 'green-700', 4.5, 'primary button hover'],
  ['green-700', 'white', 4.5, 'links / eyebrow on white'],
  ['green-700', 'mint-50', 4.5, 'links / eyebrow on mint'],
  ['white', 'navy-900', 4.5, 'text on navy'],
  ['white', 'navy-800', 4.5, 'text on raised navy'],
  ['green-300', 'navy-900', 4.5, 'accent text on navy'],
  ['green-400', 'navy-900', 4.5, 'accent text on navy'],
  ['white', 'forest-900', 4.5, 'text on forest'],
  ['green-300', 'forest-900', 4.5, 'accent text on forest'],
  ['danger', 'white', 4.5, 'form errors'],
  ['facility', 'white', 3, 'focus ring (non-text, 3:1)'],
  ['green-300', 'navy-900', 3, 'focus ring on dark (non-text, 3:1)'],
];

let failed = 0;
for (const [fg, bg, min, use] of pairs) {
  if (!colors[fg] || !colors[bg]) {
    console.error(`✗ unknown token in pair ${fg} / ${bg}`);
    failed++;
    continue;
  }
  const r = ratio(colors[fg], colors[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `${ok ? '✓' : '✗'} ${r.toFixed(2).padStart(5)} (min ${min})  ${fg} on ${bg}  — ${use}`,
  );
}
if (failed) {
  console.error(`\n${failed} pair(s) below WCAG AA.`);
  process.exit(1);
}
console.log('\nAll colour pairs pass.');
