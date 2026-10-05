import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const rows = await mongoose.connection.db.collection('barcodeLabel').aggregate([
  { $match: { icChallanId: '6ac33134c63167d7eae54af5', status: 'IN_STOCK' } },
  { $group: { _id: { $toLower: '$barcodeNo' }, q: { $sum: '$qtyNum' } } }]).toArray();
console.log('1033 still in stock:', JSON.stringify(rows), '-> max return = min(2-0, that) - pending');
await mongoose.disconnect();
