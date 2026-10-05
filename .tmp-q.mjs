import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection.db;
const bc = db.collection('barcodeLabel');
const sold = await bc.find({ status: 'SOLD' }).project({ barcodeNo:1, qtyNum:1, billingNo:1, billingId:1, businessId:1, icChallanId:1 }).toArray();
const inv = new Map((await db.collection('posinvoice').find({ _id: { $in: sold.map(s=>s.billingId).filter(Boolean) } }).project({ items:1, invoiceNo:1 }).toArray()).map(i=>[String(i._id), i]));
let over = [];
for (const s of sold) {
  const i = inv.get(String(s.billingId)); if (!i) continue;
  const billed = (i.items||[]).filter(l=>String(l.barcodeNo).toLowerCase()===String(s.barcodeNo).toLowerCase()).reduce((a,l)=>a+(Number(l.qty)||0),0);
  if (billed && (Number(s.qtyNum)||0) - billed > 0.001) over.push([s.barcodeNo, s.billingNo, 'row', s.qtyNum, 'billed', billed, s.icChallanId?'IC':'']);
}
console.log('SOLD rows:', sold.length, '| sold whole but billed less:', over.length);
over.forEach(o=>console.log(' ', o.join(' ')));
await mongoose.disconnect();
