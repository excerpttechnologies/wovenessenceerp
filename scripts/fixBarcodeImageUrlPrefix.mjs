/* Reconciles the imageUrl values this project stamped with what is ACTUALLY
   served, and blanks the ones that can no longer resolve.

   The mistake this exists to correct
   ----------------------------------
   seedBarcodeImagesFromFolder.mjs stamped an ABSOLUTE url:

     https://wovenessence.etpl.ai/august_8A_images/8A1000.jpg

   Two things were wrong with that. The host only serves what is inside this
   app's own public/ folder (wovenessence.etpl.ai IS this app deployed), and
   the scraped photos were sitting in a folder Next does not serve - so every
   one of them answered 404. And even once the files are in place, an absolute
   url pins the picture to the production host: on localhost:3001 the browser
   still goes to wovenessence.etpl.ai, which has whatever was last deployed.

   The shape that works in both places is the ORIGIN-RELATIVE path this
   project used before - public/august_8A_images/8A1000.jpg is served at
   /august_8A_images/8A1000.jpg (lib/inventory.js:387), so the same stored
   value resolves against localhost in development and against the real host
   in production.

   What it does
   ------------
     absolute url -> relative path   when the file is present in public/
     absolute url -> ''              when it is not, because a blank reads as
                                     "no image" on the report and puts the
                                     unit back on the missing-images worklist,
                                     where a broken <img> just looks broken

     npm run fix:barcode-image-prefix          # dry run, changes nothing
     npm run fix:barcode-image-prefix:apply    # writes, after a JSON backup
*/

import mongoose from 'mongoose';
import { readdirSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const APPLY = process.argv.includes('--apply');
const ABS_PREFIX = 'https://wovenessence.etpl.ai/august_8A_images/';
const SERVED_DIR = 'august_8A_images';

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/fixBarcodeImageUrlPrefix.mjs');
  process.exit(1);
}

/* what public/ can actually answer for, keyed case-insensitively because the
   stored file name and the file on disk need not agree on case */
const dir = path.join(process.cwd(), 'public', SERVED_DIR);
const served = new Map();
try {
  for (const f of readdirSync(dir)) served.set(f.toLowerCase(), f);
} catch {
  console.error('No such folder: ' + dir);
  process.exit(1);
}
console.log(`Served from public/${SERVED_DIR}: ${served.size} file(s)`);

await mongoose.connect(URI);
const rowsCol = mongoose.connection.db.collection('barcodeLabel');

const rows = await rowsCol.find({
  imageUrl: { $regex: '^' + ABS_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
}).toArray();
console.log(`Rows on the absolute url: ${rows.length}`);

const toRelative = [];
const toBlank = [];
for (const r of rows) {
  const file = String(r.imageUrl).slice(ABS_PREFIX.length);
  const real = served.get(file.toLowerCase());
  if (real) toRelative.push({ r, url: `/${SERVED_DIR}/${real}` });
  else toBlank.push({ r, url: '' });
}

console.log(`  -> relative path (file is served) : ${toRelative.length}`);
console.log(`  -> blanked (file is not there)    : ${toBlank.length}`);

if (toBlank.length) {
  const names = [...new Set(toBlank.map(({ r }) => String(r.imageUrl).slice(ABS_PREFIX.length)))];
  console.log(`\n--- ${names.length} FILE(S) NOTHING CAN SERVE, their rows go back to "no image" ---`);
  console.log('  ' + names.slice(0, 20).join(', ') + (names.length > 20 ? ` ... +${names.length - 20}` : ''));
}

const writes = [...toRelative, ...toBlank];
if (!writes.length) {
  console.log('\nNothing to do - no row carries that absolute url.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('\n--- WOULD WRITE ---');
toRelative.slice(0, 8).forEach(({ r, url }) => console.log(`  ${String(r.barcodeNo).padEnd(10)} -> ${url}`));
if (toRelative.length > 8) console.log(`  ... ${toRelative.length - 8} more relative-path rows`);

if (!APPLY) {
  console.log(`\nDRY RUN - ${writes.length} row(s) would be rewritten.`);
  console.log('Re-run with --apply to write.');
  await mongoose.disconnect();
  process.exit(0);
}

const backupDir = path.join(process.cwd(), 'backups');
mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `barcode-image-prefix-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(backupFile, JSON.stringify(writes.map(({ r, url }) => ({
  _id: r._id, barcodeNo: r.barcodeNo, imageUrl: r.imageUrl, willBeSetTo: url,
})), null, 2));
console.log(`\nBackup written: ${backupFile}`);

const result = await rowsCol.bulkWrite(writes.map(({ r, url }) => ({
  updateOne: { filter: { _id: r._id }, update: { $set: { imageUrl: url } } },
})), { ordered: false });
console.log(`imageUrl rewritten on ${result.modifiedCount} row(s) (matched ${result.matchedCount})`);

await mongoose.disconnect();
