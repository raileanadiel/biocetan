// Consistent snapshot of the SQLite database (safe while the portal is running: VACUUM INTO
// copies a transactionally consistent state), then keeps only the newest KEEP snapshots.
// Run daily by deploy/biocetan-portal-backup.timer. Copy the backup folder off the VM too
// (another disk, another machine or cloud storage): a backup on the same disk doesn't survive
// the disk.
//
//   node scripts/backup.mjs [--dir /var/lib/biocetan-portal/backups] [--keep 30]
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@libsql/client';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: process.env.BACKUP_DIR ?? './data/backups' },
    keep: { type: 'string', default: '30' },
  },
});

const url = process.env.DATABASE_URL ?? 'file:./data/portal.db';
const keep = Number(values.keep);
mkdirSync(values.dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(values.dir, `portal-${stamp}.db`);
const client = createClient({ url });
await client.execute({ sql: 'VACUUM INTO ?', args: [target] });
client.close();

const snapshots = readdirSync(values.dir)
  .filter((f) => /^portal-.*\.db$/.test(f))
  .sort();
for (const old of snapshots.slice(0, Math.max(0, snapshots.length - keep))) {
  rmSync(join(values.dir, old));
}
console.log(`Backup written: ${target} (keeping the newest ${keep})`);
