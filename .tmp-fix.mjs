import mongoose from 'mongoose';
import fs from 'fs';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection.db;
const { EJSON } = mongoose.mongo.BSON;
const bc = db.collection('barcodeLabel'), sm = db.collection('stockmovement');
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const key = (v) => String(v || '').trim().toLowerCase();

const sold = await bc.find({ status: 'SOLD', billingId: { $ne: null } }).toArray();
const invs = new Map((await db.collection('posinvoice').find({ _id: { $in: sold.map(s => s.billingId) } }).project({ items: 1, invoiceNo: 1, createdAt: 1, finYear: 1, locationId: 1 }).toArray()).map(i => [String(i._id), i]));
const fix = [];
for (const s of sold) {
  const inv = invs.get(String(s.billingId)); if (!inv) continue;
  const billed = r3((inv.items || []).filter(l => key(l.barcodeNo) === key(s.barcodeNo)).reduce((a, l) => a + (Number(l.qty) || 0), 0));
  const have = r3(s.qtyNum ?? s.qty);
  if (billed > 0 && have - billed > 0.0005) fix.push({ s, inv, billed, left: r3(have - billed) });
}
fs.writeFileSync('.backups/partial-sale-repair-2026-10-05.json', EJSON.stringify({ at: new Date(), rows: fix.map(f => f.s) }, null, 0, { relaxed: false }));
console.log('backup ok:', fix.length, 'rows');

for (const { s, inv, billed, left } of fix) {
  const sale = { invoiceId: s.billingId, invoiceNo: inv.invoiceNo || s.billingNo || '', qty: billed, at: s.soldAt || inv.createdAt, returnedQty: 0, icBilledId: s.icBilledId || null, icBilledNo: s.icBilledNo || '' };
  const res = await bc.updateOne({ _id: s._id, status: 'SOLD' }, { $set: {
    status: 'IN_STOCK', qtyNum: left, qty: String(left), billingId: null, billingNo: '', soldAt: null,
    icBilledId: null, icBilledNo: '', sales: [sale], updatedAt: new Date() } });
  if (!res.modifiedCount) { console.log('SKIPPED (changed meanwhile):', s.barcodeNo); continue; }
  await sm.insertOne({
    businessId: s.businessId && mongoose.isValidObjectId(String(s.businessId)) ? new mongoose.Types.ObjectId(String(s.businessId)) : null,
    finYear: s.finYear || inv.finYear || '', type: 'ADJUST_IN', barcodeId: s._id, barcodeNo: s.barcodeNo || '',
    itemCode: s.itemCode || '', itemName: s.itemName || s.printDescription || '', uom: s.uom || '', batchType: s.batchType || '',
    qty: left, fromLocationId: null, toLocationId: s.currentLocationId || null,
    statusBefore: 'SOLD', statusAfter: 'IN_STOCK', refModel: 'posInvoice', refId: s.billingId, refNo: sale.invoiceNo,
    reason: 'Correction: bill ' + sale.invoiceNo + ' sold ' + billed + ' of ' + r3(s.qtyNum ?? s.qty) + ' but the whole batch row was marked sold - unsold ' + left + ' put back',
    notes: 'partial-sale repair 05-10-2026', userName: 'system', at: new Date(), createdAt: new Date(), updatedAt: new Date(),
  });
  console.log('fixed', s.barcodeNo.padEnd(8), 'bill', sale.invoiceNo.padEnd(16), 'row', r3(s.qtyNum ?? s.qty), 'billed', billed, '-> back in stock', left, s.icChallanId ? '(IC' + (sale.icBilledNo ? ', billed ' + sale.icBilledNo : '') + ')' : '');
}
await mongoose.disconnect();
