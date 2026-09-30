import { isValidObjectId } from 'mongoose';
import dbConnect from '@/lib/db';
import IcItemInvoice from '@/models/IcItemInvoice';
import IcDeliveryChallan from '@/models/IcDeliveryChallan';
import PosInvoice from '@/models/PosInvoice';
import Business from '@/models/Business';
import { BarcodeLabel, BARCODE_STATUS } from '@/lib/barcodeLabel';
import { requireSession } from '@/lib/session';
import { nextDocNumber } from '@/lib/docnumber';
import { sameBarcode } from '@/lib/barcodeValue';
import { screenDenial, SCREENS, ACTIONS as PERM } from '@/lib/screenPermission';
import { computeLine, num, r2 } from '@/app/admin/transaction/intercompanysell/deliverychallan/fields';

/* /api/ic-item-invoice - the SENDER's consignment billing.

   The receiver's stock from an IC challan is barcodeLabel rows carrying
   icChallanId + sourceBarcodeId (lib/icStock.js receiveChallanStock). When
   the receiver sells one at its POS the row goes SOLD - and that is the
   sender's signal that the unit may now be invoiced.

   GET  ?business=<sender>&view=notbilled  units the receiver has sold that
                                           the sender has not invoiced yet
        ?business=<sender>&view=billed     the lines of saved invoices,
                                           newest first
   POST { business, location, finYear, data: { barcodeIds: [...] } }
        invoices the ticked units. Grouped by RECEIVER - one invoice per
        receiver per save - and each row is claimed with a guarded update
        (icBilledId still null), so two people saving at once cannot bill
        the same unit twice. On a clash the invoice is rolled back.

   Pricing comes from the CHALLAN LINE the unit shipped on (unitRate,
   discounts, GST split), not from the receiver's POS price - the sender
   bills what it shipped at. Quantity is the POS line's quantity when it can
   be found (a batch barcode can sell part of its metreage), else the row's
   own. */

const json = (d, s = 200) => Response.json(d, {
  status: s,
  headers: { 'Cache-Control': 'no-store' },
});

const IC_SI = { screen: SCREENS.IC_ITEM_INVOICE, label: 'inter company sales invoices' };

/* one invoice line for a sold receiver-side row */
function buildLine({ row, challan, posLine }) {
  const qty = num(posLine?.qty) || num(row.qtyNum) || 1;
  const line = (challan?.items || []).find((l) =>
    (l.stockMoves || []).some((m) => String(m.barcodeId) === String(row.sourceBarcodeId)));

  let priced;
  if (line) {
    const c = computeLine({ ...line, qty });
    priced = {
      itemCode: line.itemCode || row.itemCode || '',
      itemName: line.itemName || row.printDescription || row.supplierDescription || '',
      hsn: line.hsn || row.hsn || '',
      uom: line.uom || row.uom || row.uomType || '',
      unitRate: num(line.unitRate),
      discountPct: num(line.discountPct),
      roffDiscount: num(line.roffDiscount),
      finalRate: c.finalRate,
      beforeTax: c.beforeTax,
      igstPct: num(line.igstPct),
      cgstPct: num(line.cgstPct),
      sgstPct: num(line.sgstPct),
      igstAmount: c.igst,
      cgstAmount: c.cgst,
      sgstAmount: c.sgst,
      netAmount: c.netAmount,
    };
  } else {
    /* a challan whose lines predate stockMoves - priced off the barcode row,
       tax split in half as intra-state, same as the challan item-lookup's
       own fallback */
    const rate = num(row.retailPrice);
    const pct = num(String(row.gst || '').match(/[\d.]+/)?.[0]);
    const beforeTax = r2(rate * qty);
    const half = r2((beforeTax * (pct / 2)) / 100);
    priced = {
      itemCode: row.itemCode || '',
      itemName: row.printDescription || row.supplierDescription || row.itemCode || '',
      hsn: row.hsn || '',
      uom: row.uom || row.uomType || '',
      unitRate: rate,
      discountPct: 0,
      roffDiscount: 0,
      finalRate: rate,
      beforeTax,
      igstPct: 0,
      cgstPct: r2(pct / 2),
      sgstPct: r2(pct / 2),
      igstAmount: 0,
      cgstAmount: half,
      sgstAmount: half,
      netAmount: r2(beforeTax + half + half),
    };
  }

  return {
    barcodeId: String(row._id),
    sourceBarcodeId: String(row.sourceBarcodeId || ''),
    barcodeNo: row.barcodeNo || row.barcodeGenerated || '',
    dcId: challan ? String(challan._id) : String(row.icChallanId || ''),
    dcNo: challan?.dcNo || row.icChallanNo || '',
    qty,
    posInvoiceNo: posLine?.invoiceNo || row.billingNo || '',
    soldAt: posLine?.soldAt || row.soldAt || null,
    ...priced,
  };
}

/* the challans and POS lines a set of rows needs, in two reads */
async function joins(rows, senderBusinessId) {
  const challanIds = [...new Set(rows.map((r) => String(r.icChallanId || '')).filter(isValidObjectId))];
  const challans = challanIds.length
    ? await IcDeliveryChallan.find({ _id: { $in: challanIds }, businessId: senderBusinessId })
      .select('dcNo toBusinessId toLocationId items businessId').lean()
    : [];
  const challanById = new Map(challans.map((c) => [String(c._id), c]));

  const billingIds = [...new Set(rows.map((r) => String(r.billingId || '')).filter(isValidObjectId))];
  const posInvoices = billingIds.length
    ? await PosInvoice.find({ _id: { $in: billingIds } }).select('invoiceNo items createdAt').lean()
    : [];
  const posById = new Map(posInvoices.map((p) => [String(p._id), p]));
  const posLineFor = (row) => {
    const inv = posById.get(String(row.billingId || ''));
    if (!inv) return null;
    const line = (inv.items || []).find((l) => sameBarcode(l.barcodeNo, row.barcodeNo));
    /* soldAt: the POS invoice's createdAt is the real moment of the sale.
       The row's own soldAt is the bill's BUSINESS DATE, stored at midnight
       (see the till's date picker), which reads as 5:30 AM IST. */
    return {
      qty: line ? line.qty : null,
      invoiceNo: inv.invoiceNo || '',
      soldAt: inv.createdAt || null,
    };
  };

  return { challanById, posLineFor };
}

const businessNames = async (ids) => {
  const list = [...new Set(ids.map(String).filter(isValidObjectId))];
  const rows = list.length
    ? await Business.find({ _id: { $in: list } }).select('name businessPrintName').lean()
    : [];
  return new Map(rows.map((b) => [String(b._id), b.name || b.businessPrintName || '']));
};

export async function GET(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const sp = new URL(req.url).searchParams;
  await dbConnect();

  const business = sp.get('business');
  if (!business || !isValidObjectId(business)) return json({ rows: [] });

  const denied = await screenDenial({
    session, ...IC_SI, action: PERM.READ, businessId: business,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  /* ------------------------------------------------------- billed ------ */
  if (sp.get('view') === 'billed') {
    const invoices = await IcItemInvoice.find({ businessId: business })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const rows = invoices.flatMap((inv) => (inv.items || []).map((l) => ({
      invoiceId: String(inv._id),
      invoiceNo: inv.invoiceNo || '',
      invoiceDate: inv.invoiceDate || inv.createdAt,
      toBusinessName: inv.toBusinessName || '',
      dcNo: l.dcNo || '',
      barcodeNo: l.barcodeNo || '',
      itemName: l.itemName || l.itemCode || '',
      qty: num(l.qty),
      netAmount: num(l.netAmount),
      posInvoiceNo: l.posInvoiceNo || '',
    })));

    return json({ rows });
  }

  /* ---------------------------------------------------- not billed ----- */
  /* every challan this sender has raised */
  const finYear = sp.get('finYear');
  const challanFilter = { businessId: business, ...(finYear ? { finYear } : {}) };
  const challanIds = (await IcDeliveryChallan.find(challanFilter).select('_id').lean())
    .map((c) => String(c._id));
  if (!challanIds.length) return json({ rows: [] });

  /* receiver-side rows from those challans that the receiver has SOLD and
     the sender has not billed */
  const rows = await BarcodeLabel.find({
    icChallanId: { $in: challanIds },
    status: BARCODE_STATUS.SOLD,
    $or: [{ icBilledId: null }, { icBilledId: { $exists: false } }],
  }).sort({ soldAt: -1 }).limit(300).lean();

  const { challanById, posLineFor } = await joins(rows, business);
  const nameOf = await businessNames(rows.map((r) => challanById.get(String(r.icChallanId))?.toBusinessId).filter(Boolean));

  return json({
    rows: rows.map((row) => {
      const challan = challanById.get(String(row.icChallanId)) || null;
      const line = buildLine({ row, challan, posLine: posLineFor(row) });
      return {
        ...line,
        toBusinessId: challan ? String(challan.toBusinessId || '') : '',
        toBusinessName: challan ? nameOf.get(String(challan.toBusinessId)) || '' : '',
      };
    }),
  });
}

export async function POST(req) {
  const session = await requireSession();
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  await dbConnect();

  const businessId = isValidObjectId(body.business) ? body.business : null;
  const locationId = isValidObjectId(body.location) ? body.location : null;
  const finYear = body.finYear || '';
  if (!businessId) return json({ error: 'No business selected.' }, 422);

  const denied = await screenDenial({
    session, ...IC_SI, action: PERM.CREATE, businessId,
  });
  if (denied) return json({ error: denied.message, code: denied.code }, 403);

  const ids = [...new Set((body.data?.barcodeIds || []).map(String).filter(isValidObjectId))];
  if (!ids.length) return json({ error: 'Tick the sold items to bill first.' }, 422);

  const rows = await BarcodeLabel.find({ _id: { $in: ids } }).lean();
  if (rows.length !== ids.length) {
    return json({ error: 'Some of the ticked items no longer exist. Refresh and try again.' }, 409);
  }

  /* every row must be a receiver-side unit from one of THIS sender's
     challans, sold, and not billed yet */
  const bad = [];
  rows.forEach((r) => {
    if (r.status !== BARCODE_STATUS.SOLD) bad.push((r.barcodeNo || r._id) + ' (not sold any more)');
    else if (r.icBilledId) bad.push((r.barcodeNo || r._id) + ' (already billed on ' + (r.icBilledNo || 'an invoice') + ')');
    else if (!isValidObjectId(String(r.icChallanId || ''))) bad.push((r.barcodeNo || r._id) + ' (not from an inter company challan)');
  });
  if (bad.length) {
    return json({ error: 'Cannot bill: ' + bad.slice(0, 6).join(', ') + '. Refresh and try again.' }, 409);
  }

  const { challanById, posLineFor } = await joins(rows, businessId);
  const orphan = rows.filter((r) => !challanById.get(String(r.icChallanId)));
  if (orphan.length) {
    return json({
      error: 'Not from this business\'s challans: '
        + orphan.slice(0, 6).map((r) => r.barcodeNo || r._id).join(', ') + '.',
    }, 409);
  }

  /* ONE INVOICE PER RECEIVER - group the ticked rows by the challan's
     destination business */
  const groups = new Map();
  rows.forEach((r) => {
    const challan = challanById.get(String(r.icChallanId));
    const key = String(challan.toBusinessId || '');
    if (!groups.has(key)) groups.set(key, { challan, rows: [] });
    groups.get(key).rows.push(r);
  });
  const nameOf = await businessNames([...groups.keys()]);

  const created = [];
  for (const [toBusinessId, group] of groups) {
    const lines = group.rows.map((row) => buildLine({
      row,
      challan: challanById.get(String(row.icChallanId)),
      posLine: posLineFor(row),
    }));

    const taxableValue = r2(lines.reduce((a, l) => a + num(l.beforeTax), 0));
    const igstTotal = r2(lines.reduce((a, l) => a + num(l.igstAmount), 0));
    const cgstTotal = r2(lines.reduce((a, l) => a + num(l.cgstAmount), 0));
    const sgstTotal = r2(lines.reduce((a, l) => a + num(l.sgstAmount), 0));
    const gross = r2(taxableValue + igstTotal + cgstTotal + sgstTotal);
    const netValue = Math.round(gross);

    const invoiceNo = await nextDocNumber(IcItemInvoice, 'invoiceNo', 'Inter Company Sales Invoice', {
      businessId, locationId, finYear,
    });

    const invoice = await IcItemInvoice.create({
      businessId,
      locationId,
      finYear,
      toBusinessId: isValidObjectId(toBusinessId) ? toBusinessId : null,
      toLocationId: group.challan.toLocationId || null,
      toBusinessName: nameOf.get(toBusinessId) || '',
      invoiceNo,
      invoiceDate: new Date(),
      items: lines,
      totalQty: r2(lines.reduce((a, l) => a + num(l.qty), 0)),
      taxableValue,
      igstTotal,
      cgstTotal,
      sgstTotal,
      roundOff: r2(netValue - gross),
      netValue,
      createdBy: session.name || session.email || '',
    });

    /* claim the rows - guarded on "still unbilled", so a second save racing
       this one loses cleanly instead of billing a unit twice.

       Written through the RAW DRIVER, the same way lib/icReceive.js stamps
       receivedAt, and for the same reason: icBilledId/icBilledNo are new on
       the schema, and a dev server still holding the previously compiled
       model drops the $set silently - the invoice saved while the rows
       stayed "not billed". .collection bypasses the cached schema. */
    const claim = await BarcodeLabel.collection.updateMany(
      {
        _id: { $in: group.rows.map((r) => r._id) },
        $or: [{ icBilledId: null }, { icBilledId: { $exists: false } }],
      },
      { $set: { icBilledId: invoice._id, icBilledNo: invoiceNo } }
    );

    if (claim.modifiedCount !== group.rows.length) {
      /* someone billed one of them between the read and the write - undo
         this invoice; the ones already created for other receivers stand */
      await BarcodeLabel.collection.updateMany(
        { icBilledId: invoice._id },
        { $set: { icBilledId: null, icBilledNo: '' } }
      );
      await IcItemInvoice.findByIdAndDelete(invoice._id);
      return json({
        error: 'Some items for ' + (nameOf.get(toBusinessId) || 'a receiver')
          + ' were billed by someone else a moment ago. Refresh and try again.',
        created,
      }, 409);
    }

    created.push({
      id: String(invoice._id),
      invoiceNo,
      toBusinessName: nameOf.get(toBusinessId) || '',
      count: lines.length,
      netValue,
    });
  }

  return json({ ok: true, invoices: created }, 201);
}
