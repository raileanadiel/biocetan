// Launch gate: fails if any "[TODO" marker is still visible in the built site.
// Run before enabling PUBLIC_ALLOW_INDEXING (production build uses `npm run build:prod`).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Enforced only on production builds (PUBLIC_ALLOW_INDEXING=true) so preview/PR builds keep working.
// `npm run check:placeholders` passes --force to list them anywhere.
const enforce = process.env.PUBLIC_ALLOW_INDEXING === 'true' || process.argv.includes('--force');
if (!enforce) {
  console.log('placeholder check skipped (not a production build)');
  process.exit(0);
}

const root = new URL('../dist', import.meta.url).pathname;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(html|xml|txt|json|webmanifest)$/.test(name)) {
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/\[TODO[^\]]*\]/g))
        hits.push(`${path.replace(root, '')}: ${match[0]}`);
    }
  }
}
walk(root);

if (hits.length) {
  console.error(`✗ ${hits.length} unresolved placeholder(s) in the build:\n`);
  for (const hit of [...new Set(hits)]) console.error('  ' + hit);
  console.error('\nResolve these (see IMPLEMENTATION_PLAN.md §11) before launching.');
  process.exit(1);
}
console.log('✓ no unresolved placeholders');
