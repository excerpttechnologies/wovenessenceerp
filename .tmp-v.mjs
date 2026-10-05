import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const r = await mongoose.connection.db.collection('barcodeLabel').find({ barcodeNo: '101189' }).project({ businessId:1, status:1, qtyNum:1, sales:1 }).toArray();
r.forEach(x => console.log(JSON.stringify(x)));
await mongoose.disconnect();
