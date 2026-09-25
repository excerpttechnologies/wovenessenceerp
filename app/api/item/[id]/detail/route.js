// import dbConnect from '@/lib/db';
// import Item from '@/models/Item';
// import Hsn from '@/models/Hsn';
// import Uom from '@/models/Uom';
// import Tax from '@/models/Tax';
// import { requireSession } from '@/lib/session';

// /* /api/item/<id>/detail
//    Everything a Purchase Invoice line needs the moment an item is picked:
//    item code, HSN code, the GST slab and its rates, UOM, RSP and WSP.

//    The GST rate chain is HSN -> taxSlabs[].gstTaxNameId -> Tax.igst/cgst/sgst,
//    which is why this is a join rather than a plain item read. */

// const json = (d, s = 200) => Response.json(d, { status: s });

// export async function GET(req, { params }) {
//   const session = await requireSession();
//   if (!session) return json({ error: 'Unauthorized' }, 401);

//   const { id } = await params;
//   await dbConnect();

//   const item = await Item.findById(id).lean();
//   if (!item) return json({ error: 'Not found' }, 404);

//   const [hsn, uom] = await Promise.all([
//     item.hsnId ? Hsn.findById(item.hsnId).lean() : null,
//     item.uomId ? Uom.findById(item.uomId).lean() : null,
//   ]);

//   /* resolve every slab on the HSN to its actual percentages */
//   let slabs = [];
//   if (hsn && Array.isArray(hsn.taxSlabs) && hsn.taxSlabs.length) {
//     const taxIds = hsn.taxSlabs.map((s) => s.gstTaxNameId).filter(Boolean);
//     const taxes = taxIds.length ? await Tax.find({ _id: { $in: taxIds } }).lean() : [];
//     const byId = new Map(taxes.map((t) => [String(t._id), t]));

//     slabs = hsn.taxSlabs.map((s) => {
//       const t = byId.get(String(s.gstTaxNameId));
//       return {
//         name: t ? t.taxName : '',
//         igst: Number(t?.igst || 0),
//         cgst: Number(t?.cgst || 0),
//         sgst: Number(t?.sgst || 0),
//         cess: Number(t?.cess || 0),
//         amountFrom: Number(s.amountFrom || 0),
//         amountTo: Number(s.amountTo || 0),
//       };
//     });
//   }

//   return json({
//     item: {
//       id: String(item._id),
//       itemCode: item.itemCode || '',
//       name: item.name || '',
//       hsnCode: hsn ? hsn.code || '' : '',
//       uom: uom ? uom.shortName || uom.name || '' : '',
//       rsp: item.rsp ?? null,
//       wsp: item.wsp ?? null,
//       slabs,
//     },
//   });
// }




/* FILE: app/api/item/[id]/detail/route.js */
import dbConnect from '@/lib/db';
import Item from '@/models/Item';
import Hsn from '@/models/Hsn';
import Uom from '@/models/Uom';
import Tax from '@/models/Tax';
import { requireSession } from '@/lib/session';
import {
  screenDenialAny, ACTIONS as PERM, ITEM_LOOKUP_SCREENS,
} from '@/lib/screenPermission';

/* /api/item/<id>/detail
   Everything a Purchase Invoice line needs the moment an item is picked:
   item code, HSN code, the GST slab and its rates, UOM, RSP and WSP.

   The GST rate chain is HSN -> taxSlabs[].gstTaxNameId -> Tax.igst/cgst/sgst,
   which is why this is a join rather than a plain item read. */

const json = (d, s = 200) => Response.json(d, { status: s });

/* An offer percentage as stored on an item, or null: blank, "No" and 0 mean
   no offer, and anything outside (0, 100) is not a usable percentage. */
const offerPct = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null;
};

export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await params;
  await dbConnect();

  const item = await Item.findById(id).lean();
  if (!item) return json({ error: 'Not found' }, 404);

  /* Same rule as the list: Item read, or any screen that resolves item
     codes. This is the shape the GRC grid, the till and Purchase Invoice
     all read a picked item through, so gating it on Item alone would
     break them. */
  const denied = await screenDenialAny({
    session, screens: ITEM_LOOKUP_SCREENS, action: PERM.READ,
    businessId: item.businessId, label: 'items',
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const [hsn, uom] = await Promise.all([
    item.hsnId ? Hsn.findById(item.hsnId).lean() : null,
    item.uomId ? Uom.findById(item.uomId).lean() : null,
  ]);

  /* resolve every slab on the HSN to its actual percentages */
  let slabs = [];
  if (hsn && Array.isArray(hsn.taxSlabs) && hsn.taxSlabs.length) {
    const taxIds = hsn.taxSlabs.map((s) => s.gstTaxNameId).filter(Boolean);
    const taxes = taxIds.length ? await Tax.find({ _id: { $in: taxIds } }).lean() : [];
    const byId = new Map(taxes.map((t) => [String(t._id), t]));

    slabs = hsn.taxSlabs.map((s) => {
      const t = byId.get(String(s.gstTaxNameId));
      return {
        name: t ? t.taxName : '',
        igst: Number(t?.igst || 0),
        cgst: Number(t?.cgst || 0),
        sgst: Number(t?.sgst || 0),
        cess: Number(t?.cess || 0),
        amountFrom: Number(s.amountFrom || 0),
        amountTo: Number(s.amountTo || 0),
      };
    });
  }

  return json({
    item: {
      id: String(item._id),
      itemCode: item.itemCode || '',
      name: item.name || '',
      hsnId: item.hsnId ? String(item.hsnId) : '',
      hsnCode: hsn ? hsn.code || '' : '',
      uom: uom ? uom.shortName || uom.name || '' : '',
      rsp: item.rsp ?? null,
      wsp: item.wsp ?? null,
      /* An item's OWN markup, when it has one; otherwise null and Barcode
         Generation keeps the supplier's Price Calculation Setup value.
         These used to fall back first to rspOfferPercent (an offer discount),
         wsp (a price) and offerPriceNetPrice (a "Yes"/"No" flag - "No" on
         almost every item), so picking an Item Code replaced the supplier's
         Markup E-COMM % with a blank. */
      markupRSP: item.markupRSP ?? item.markupRsp ?? null,
      markupWSP: item.markupWSP ?? item.markupWsp ?? null,
      markupDP: item.markupDP ?? item.markupDp ?? item.markupEcomm ?? item.markupEComm ?? null,
      /* The item's own OFFER percentages, as Inventory > Item stores them
         (app/admin/inventory/item/fields.js: "RSP Offer %" rspOfferPercent,
         "WSP Offer %" wsp, "Ecomm Offer %" offerPriceNetPrice - "No" on most
         items). null when the item has none. Barcode Generation turns them
         into offer prices off the row's RSP / WSP / E-COMM. */
      rspOfferPct: offerPct(item.rspOfferPercent),
      wspOfferPct: offerPct(item.wsp),
      dpOfferPct: offerPct(item.offerPriceNetPrice),
      slabs,
    },
  });
}