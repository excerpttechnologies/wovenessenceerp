import mongoose from 'mongoose';
import fs from 'fs';

const file = process.argv[2];                 // backup file to restore
const only = process.argv[3];                 // optional: '6A' to restore only that series
const { EJSON } = mongoose.mongo.BSON;

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection.db;
const bc = db.collection('barcodeLabel'), sm = db.collection('stockmovement');

const data = EJSON.parse(fs.readFileSync(file, 'utf8'));   // keeps ObjectIds + dates exact
let labels = data.barcodeLabel;
if (only) labels = labels.filter((r) => String(r.barcodeNo).startsWith(only));

// step 2: skip barcode numbers that exist again (created after the delete)
const taken = new Set((await bc.find({ barcodeNo: { $in: labels.map((r) => r.barcodeNo) } })
  .project({ barcodeNo: 1 }).toArray()).map((r) => r.barcodeNo));
labels = labels.filter((r) => !taken.has(r.barcodeNo));
const ids = new Set(labels.map((r) => String(r._id)));
const moves = data.stockmovement.filter((m) => ids.has(String(m.barcodeId)));

// step 3: insert
if (labels.length) await bc.insertMany(labels, { ordered: false });
if (moves.length) await sm.insertMany(moves, { ordered: false });

console.log('restored', labels.length, 'barcodes,', moves.length, 'movements | skipped (already exist):', taken.size);
await mongoose.disconnect();
