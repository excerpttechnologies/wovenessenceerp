import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const r = await mongoose.connection.db.collection('barcodeLabel').aggregate([{ $group: { _id: { $toUpper: { $substrCP: [{ $ifNull: ['$barcodeNo', ''] }, 0, 2] } }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray();
console.log(r.map(x => (x._id || '(blank)') + ':' + x.n).join('  '));
await mongoose.disconnect();
