/* Matches a folder of photos to barcodeLabel rows by barcodeNo (file
   "4A1001.jpg" -> barcodeNo "4A1001") and stamps imageUrl with:

     /august_8A_images/<file name>

   THE FILE HAS TO BE SOMEWHERE NEXT SERVES. This writes a string onto a row;
   it does not upload, copy or publish anything. public/ is served at the site
   root, so public/august_8A_images/8A1000.jpg answers at
   /august_8A_images/8A1000.jpg - and a photo sitting in any other folder
   answers nowhere. Seeding 2,487 scraped photos that were still in a
   data-scraping folder is exactly how every one of them came back 404.

   The path is ORIGIN-RELATIVE for a second reason: an absolute
   https://wovenessence.etpl.ai/... pins the picture to the production host,
   so the same row that works when deployed shows nothing on localhost. The
   relative form resolves against whichever host is serving the page.

   Which rows get written
   ----------------------
   By default, the ones that have nothing to show TODAY: an empty imageUrl, or
   a stored URL that has already expired. "Expired" is not a guess - the
   legacy ERP's presigned Spaces links carry their own five-minute lifetime in
   the query string, and lib/missingImages.js reads it.

   A row whose photo still works is LEFT ALONE, and that matters here: 338
   rows in stock hold the image inline as a data: URI, which always displays.
   Replacing one of those with a URL that may or may not resolve would be a
   downgrade, so it takes --force to do it.

     npm run seed:barcode-images-folder                   # dry run, changes nothing
     npm run seed:barcode-images-folder:apply             # writes blank + expired rows
     npm run seed:barcode-images-folder:apply -- --force  # also overwrites working photos

   Options
     --dir=<name>   folder to read, relative to the project root. Defaults to
                    the served folder itself, public/august_8A_images, which
                    is the one folder where a match is guaranteed to resolve.
     --base=<url>   the URL prefix to stamp, if it is ever not the one above
     --force        overwrite even an imageUrl that currently displays
*/

import mongoose from 'mongoose';
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { imageProblem } from '@/lib/missingImages';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || '';
const DIR_NAME = arg('dir') || 'public/august_8A_images';
const BASE_URL = arg('base') || '/august_8A_images/';

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/seedBarcodeImagesFromFolder.mjs');
  process.exit(1);
}

const ROOT = process.cwd();
const DIR = path.join(ROOT, DIR_NAME);
if (!existsSync(DIR)) { console.error('No such folder: ' + DIR); process.exit(1); }

const up = (v) => String(v || '').trim().toUpperCase();
const escapeRx = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ disk -- */

const files = readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
const byStem = new Map();
for (const file of files) byStem.set(up(file.replace(/\.[^.]+$/, '')), file);
console.log(`Folder   : ${DIR_NAME}`);
console.log(`Images   : ${files.length}${files.length !== byStem.size ? `  (${files.length - byStem.size} duplicate stems ignored)` : ''}`);

await mongoose.connect(URI);
const rowsCol = mongoose.connection.db.collection('barcodeLabel');

/* --------------------------------------------------------------- matching --
   The indexed $in first, because it is the whole folder in one indexed
   lookup. A case-insensitive regex per stem is the correct match (barcodeNo
   has no enforced case), but 2,400 anchored regexes cannot use the index and
   turn into a full scan re-tested once per stem - so the regex pass is kept
   for the leftovers only, which in practice is none. */

const stems = [...byStem.keys()];
const variants = [...new Set(stems.flatMap((s) => [s, s.toLowerCase()]))];
const candidates = stems.length
  ? await rowsCol.find({ barcodeNo: { $in: variants } }).toArray()
  : [];

const matched = new Set(candidates.map((r) => up(r.barcodeNo)));
const strays = stems.filter((s) => !matched.has(s));
if (strays.length) {
  const extra = await rowsCol.find({
    $or: strays.map((s) => ({ barcodeNo: { $regex: `^${escapeRx(s)}$`, $options: 'i' } })),
  }).toArray();
  candidates.push(...extra);
  extra.forEach((r) => matched.add(up(r.barcodeNo)));
}

const fileFor = (r) => byStem.get(up(r.barcodeNo)) || null;
const urlFor = (file) => BASE_URL + file;

/* A row is written when it has nothing to show today - see the header. */
const toFill = [];
const alreadyHave = [];
for (const r of candidates) {
  const file = fileFor(r);
  if (!file) continue;
  const stored = String(r.imageUrl || '').trim();
  const problem = imageProblem(stored);
  if (problem || FORCE) {
    toFill.push({ r, url: urlFor(file), stored, why: problem?.reason || 'Overwritten (--force)' });
    continue;
  }
  alreadyHave.push({ r, stored });
}

const usedStems = matched;
const unused = stems.filter((s) => !usedStems.has(s));

const byWhy = toFill.reduce((a, w) => ({ ...a, [w.why]: (a[w.why] || 0) + 1 }), {});

console.log(`Barcodes : ${usedStems.size} of ${byStem.size} images match at least one barcode row`);
console.log(`Rows     : ${candidates.length} row(s) carry one of those barcodes`);
console.log(`  to write                       : ${toFill.length}`);
Object.entries(byWhy).forEach(([k, v]) => console.log(`      ${k.padEnd(24)} ${v}`));
console.log(`  left alone (photo still shows) : ${alreadyHave.length}`);

if (alreadyHave.length) {
  console.log('\n--- LEFT ALONE, the stored photo still displays ---');
  alreadyHave.slice(0, 6).forEach(({ r, stored }) =>
    console.log(`  ${String(r.barcodeNo).padEnd(10)} ${stored.slice(0, 70)}${stored.length > 70 ? '...' : ''}`));
  if (alreadyHave.length > 6) console.log(`  ... and ${alreadyHave.length - 6} more`);
}

if (unused.length) {
  console.log(`\n--- ${unused.length} IMAGE(S) WITH NO MATCHING barcodeNo ROW ---`);
  console.log('  ' + unused.slice(0, 30).join(', ') + (unused.length > 30 ? ` ... +${unused.length - 30}` : ''));
}

if (!toFill.length) {
  console.log('\nNothing to write - every matched row already has an imageUrl, or nothing matched.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log('\n--- WOULD WRITE ---');
toFill.slice(0, 30).forEach(({ r, url, stored }) =>
  console.log(`  ${String(r.barcodeNo).padEnd(10)} ${stored ? `${stored.slice(0, 40)}... -> ` : '(empty) -> '}${url}`));
if (toFill.length > 30) console.log(`  ... ${toFill.length - 30} more`);

if (!APPLY) {
  console.log(`\nDRY RUN - ${toFill.length} row(s) would get an imageUrl.`);
  console.log('Re-run with --apply to write.');
  await mongoose.disconnect();
  process.exit(0);
}

/* ------------------------------------------------------------------ apply -- */

const dir = path.join(ROOT, 'backups');
mkdirSync(dir, { recursive: true });
const backupFile = path.join(dir, `barcode-images-folder-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(backupFile, JSON.stringify(toFill.map(({ r, url }) => ({
  _id: r._id, barcodeNo: r.barcodeNo, imageUrl: r.imageUrl ?? null, willBeSetTo: url,
})), null, 2));
console.log(`\nBackup written: ${backupFile}`);

const result = await rowsCol.bulkWrite(toFill.map(({ r, url }) => ({
  updateOne: { filter: { _id: r._id }, update: { $set: { imageUrl: url } } },
})), { ordered: false });
console.log(`imageUrl set on ${result.modifiedCount} row(s) (matched ${result.matchedCount})`);

await mongoose.disconnect();
