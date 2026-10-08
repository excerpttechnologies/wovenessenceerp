import mongoose from 'mongoose';
import Business from '../models/Business.js';
import CompanyLocation from '../models/CompanyLocation.js';
import StockPoint from '../models/StockPoint.js';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const businesses = await Business.find({}).select('name _id').lean();
const locations = await CompanyLocation.find({}).select('name businessId _id').lean();
const stockPoints = await StockPoint.find({}).select('stockPoint locationId businessId _id').lean();

console.log('=== BUSINESSES ===');
businesses.forEach(b => console.log(JSON.stringify({id: b._id, name: b.name})));

console.log('\n=== LOCATIONS ===');
locations.forEach(l => console.log(JSON.stringify({id: l._id, name: l.name, businessId: l.businessId})));

console.log('\n=== STOCK POINTS ===');
stockPoints.forEach(sp => console.log(JSON.stringify({id: sp._id, stockPoint: sp.stockPoint, locationId: sp.locationId, businessId: sp.businessId})));

await mongoose.disconnect();
