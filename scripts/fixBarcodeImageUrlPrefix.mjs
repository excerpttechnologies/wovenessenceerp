/* Rewrites the imageUrl prefix seedBarcodeImagesFromFolder.mjs just wrote.

   That script stamped:
     http://wovenessencemobile.etpl.ai/uploads/itemsbarcodeimage/<file>
   The correct host/path turned out to be:
     https://wovenessence.etpl.ai/august_8A_images/<file>

   SCOPE: this does NOT touch every row carrying the old prefix. Rows already
   on wovenessencemobile.etpl.ai before this project ever ran a seed script
   (real mobile-app uploads, filed under hash names like
   1789647562532-539541726.jpg) share that same host and would be silently
   corrupted by a blanket prefix swap. So instead this reads the exact _id
   list out of the backups/barcode-images-folder-before-*.json files that
   seedBarcodeImagesFromFolder.mjs itself wrote - i.e. only rows THIS project
   set moments ago - and rewrites only those, only if the value is still what
   that script put there.

     npm run fix:barcode-image-prefix          # dry run, changes nothing
     npm run fix:barcode-image-prefix:apply    # writes, after a JSON backup
*/

import mongoose from 'mongoose';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const OLD_PREFIX = 'http://wovenessencemobile.etpl.ai/uploads/itemsbarcodeimage/';
const NEW_PREFIX = 'https://wovenessence.etpl.ai/august_8A_images/';

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/fixBarcodeImageUrlPrefix.mjs');
  process.exit(1);
}

/* ---- load the exact rows our own seed script touched -------------------- */
const backupDir = path.join(process.cwd(), 'backups');
const backupFiles = readdirSync(backupDir).filter((f) => /^barcode-images-folder-before-.*\.json$/.test(f));
if (!backupFiles.length) {
  console.error('No backups/barcode-images-folder-before-*.json found - nothing to scope this fix to.');
  process.exit(1);
}

const targetIds = new Map(); // id -> { willBeSetTo, sourceFile }
for (const f of backupFiles) {
  const entries = JSON.parse(readFileSync(path.join(backupDir, f), 'utf8'));
  for (const e of entries) targetIds.set(String(e._id), { willBeSetTo: e.willBeSetTo, sourceFile: f });
}
console.log(`Backup files scanned: ${backupFiles.length}`);
console.log(`Rows this project seeded: ${targetIds.size}`);

await mongoose.connect(URI);
const rowsCol = mongoose.connection.db.collection('barcodeLabel');

const { ObjectId } = mongoose.mongo;
const rows = await rowsCol.find({
  _id: { $in: [...targetIds.keys()].map((id) => new ObjectId(id)) },
}).toArray();

/* Only rewrite a row if it still carries exactly what our seed script wrote -
   if something else has touched it since (a manual edit, a re-seed), leave
   it rather than guess. */
const writes = [];
const skippedChanged = [];
for (const r of rows) {
  const expected = targetIds.get(String(r._id))?.willBeSetTo;
  const current = String(r.imageUrl || '');
  if (current !== expected || !current.startsWith(OLD_PREFIX)) { skippedChanged.push(r); continue; }
  writes.push({ r, url: NEW_PREFIX + current.slice(OLD_PREFIX.length) });
}

console.log(`Old prefix: ${OLD_PREFIX}`);
console.log(`New prefix: ${NEW_PREFIX}`);
console.log(`Rows found in DB   : ${rows.length} of ${targetIds.size} seeded ids`);
console.log(`  to rewrite       : ${writes.length}`);
console.log(`  skipped (changed since seeding, left alone): ${skippedChanged.length}`);

if (skippedChanged.length) {
  console.log('\n--- SKIPPED, imageUrl no longer matches what was seeded ---');
  skippedChanged.slice(0, 6).forEach((r) => console.log(`  ${String(r.barcodeNo).padEnd(10)} ${String(r.imageUrl).slice(0, 70)}`));
  if (skippedChanged.length > 6) console.log(`  ... and ${skippedChanged.length - 6} more`);
}

if (!writes.length) {
  console.log('\nNothing to do.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('\n--- WOULD WRITE ---');
writes.slice(0, 10).forEach(({ r, url }) => console.log(`  ${String(r.barcodeNo).padEnd(10)} -> ${url}`));
if (writes.length > 10) console.log(`  ... ${writes.length - 10} more`);

if (!APPLY) {
  console.log(`\nDRY RUN - ${writes.length} row(s) would be rewritten.`);
  console.log('Re-run with --apply to write.');
  await mongoose.disconnect();
  process.exit(0);
}

const dir = path.join(process.cwd(), 'backups');
mkdirSync(dir, { recursive: true });
const backupFile = path.join(dir, `barcode-image-prefix-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(backupFile, JSON.stringify(writes.map(({ r, url }) => ({
  _id: r._id, barcodeNo: r.barcodeNo, imageUrl: r.imageUrl, willBeSetTo: url,
})), null, 2));
console.log(`\nBackup written: ${backupFile}`);

const result = await rowsCol.bulkWrite(writes.map(({ r, url }) => ({
  updateOne: { filter: { _id: r._id }, update: { $set: { imageUrl: url } } },
})), { ordered: false });
console.log(`imageUrl rewritten on ${result.modifiedCount} row(s) (matched ${result.matchedCount})`);

await mongoose.disconnect();
