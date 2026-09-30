// /* Saving the Barcode Generation screen of an EXISTING GRC: which submitted
//    row is which stored barcode, and what the operator actually changed on it.

//    Pure and client-safe. The screen normalises the rows it loads with
//    toGridRow, and the save route (app/api/barcode-generation/route.js) runs
//    the very same function over each stored unit to see what that row looks
//    like untouched - one definition, so the two cannot drift into reading a
//    blank the screen fills in on load as an edit.

//    Why it exists: the save used to delete every barcode row of the GRC and
//    insert whatever the browser sent. Every row got a new _id on every save,
//    and a row the request did not carry was gone for good - Generate For
//    Changes, which sends only the changed rows, wiped all the others. A save
//    now UPDATES the rows it matches, INSERTS only the rows that match nothing,
//    and leaves every other stored row alone. Deleting a barcode is its own,
//    explicit action. */

// /* A barcode row loaded from the database, as the Barcode Generation grid
//    holds it: the stored fields, plus the grid's own names for the ones it
//    renames. Moved here unchanged from GCRBarcodeGeneration's initialRows
//    effect, which now calls it. */
// export function toGridRow(row, index) {
//   return {
//     ...row,
//     id: row._id || row.id || `${row.itemCode || row.itemName || 'saved-row'}-${index}`,
//     itemCode: row.itemCode || '',
//     itemName: row.itemName || row.supplierDescription || row.printDescription || '',
//     sm: row.sm || (row.goodsType === 'SM' ? 'SM' : ''),
//     p_m_f: row.p_m_f || (row.goodsType === 'P-M-F' ? 'P-M-F' : ''),
//     hsn: row.hsn || '',
//     gst: row.gst || '',
//     qty: row.qty || '',
//     noOfCuts: row.noOfCuts || '',
//     purchaseRate: row.purchaseRate || row.purRate || '',
//     /* carried through on reload so re-saving an existing GRC does not blank
//        the encoded value that was generated with it */
//     encodedPurchaseRate: row.encodedPurchaseRate || row.encodedPurRate || '',
//     finalPrice: row.finalPrice || row.finalNet || '',
//     /* A stored record keeps its discount as `disc`, always a percentage; the
//        grid and Export Excel call it Discount / Discount Type. Read side only:
//        the save route still writes `disc` from the row's own disc. */
//     discount: row.discount ?? row.disc ?? '',
//     discountType: row.discountType || (String(row.disc ?? '').trim() !== '' ? 'Percentage' : ''),
//     retailPrice: row.retailPrice || row.rsp || '',
//     offerPrice: row.offerPrice || '',
//     uniqueBarcode: row.uniqueBarcode || (row.batchUnique === 'unique' ? 'Yes' : 'No') || 'No',
//     uom: row.uom || '',
//     /* THE UNIT'S OWN NUMBER, and nothing else - the grid's Barcode No.

//        These two fields are different things - barcodeNo is the unit's own
//        number ("9A1163"), barcodeGenerated the composed reference
//        ("G1319 * 05183 * 1 * 1"), which stays on the row as stored (...row
//        above) for the label and the print picker. This line used to fall back
//        to barcodeGenerated when barcodeNo was blank, which put the composed
//        value under Barcode No; it no longer does. Every saved barcode has a
//        barcodeNo (the save route refuses one without - assertCompleteBarcode),
//        so a blank here means the record itself lacks one. */
//     barcodeNo: row.barcodeNo || '',
//     supplierDescription: row.supplierDescription || row.itemName || '',
//     printDescription: row.printDescription || '',
//     mode: row.mode || row.batchUnique || '',
//     groupId: row.groupId || null,
//     groupSize: row.groupSize || 1,
//     billSlNo: row.billSlNo || '',
//     rsp: row.rsp || row.retailPrice || '',
//     wsp: row.wspPrice || row.wsp || '',
//     dp: row.dpPrice || row.dp || '',
//     customFields: row.customFields && typeof row.customFields === 'object' ? row.customFields : {},
//   };
// }

// /* P-M-F IS REQUIRED on every barcode the Barcode Generation screen creates
//    (user, 2026-09-17). A row's P-M-F is read the way toGridRow above and the
//    save route's buildDoc read it - its own p_m_f, or "P-M-F" when its Attribute
//    Add On says so - so the screen and the server agree. No value is ever made
//    up for a row that has none. */
// export const PMF_REQUIRED_MESSAGE = 'P-M-F is required.';
// export const pmfOf = (row) => String(row?.p_m_f || (row?.goodsType === 'P-M-F' ? 'P-M-F' : '')).trim();

// /* The barcode number a submitted row carries, read the way the save route
//    always has. */
// export function rowBarcode(row) {
//   return String(row?.barcodeGenerated || row?.barcodeNo || '').trim();
// }

// /* The barcode number of a stored unit - barcodeNo is canonical,
//    barcodeGenerated the legacy copy kept in step with it. */
// export function unitBarcode(unit) {
//   return String(unit?.barcodeNo || unit?.barcodeGenerated || '').trim();
// }

// const idOf = (row) => (row?._id === undefined || row?._id === null ? '' : String(row._id).trim());

// /* The screen's own id for a row it has not saved yet - Add Item, the ITEMS
//    sheet and the Excel import each give every row one. The save stores it on
//    the unit it inserts (clientRowId), so the same row sent again is known. */
// export const clientIdOf = (row) => (row?.id === undefined || row?.id === null ? '' : String(row.id).trim());

// /* Pairs each submitted row with the stored unit it IS.

//    1. The unit's _id, which every row loaded from the database carries.
//    2. A row the screen has not re-read since saving it - a Submit pressed
//       twice, or retried - has no _id yet but carries the screen's own row id,
//       stored on its unit as clientRowId.
//    3. Only a caller that sends neither (an API client, not this screen) is
//       matched on barcode number.

//    Barcode numbers are NOT used to identify a row the screen sends: the save
//    composes them from supplier, GRC, serial and quantity, and they need not
//    be unique - two cuts of the same length on one serial share one. A new row
//    that happens to compose the number of a saved unit is still a new row, and
//    matching it would silently turn an insert into an edit of the other unit.
//    Never on position either: rows are added, removed and re-sorted.

//    Returns
//      matched     [{ row, unit }]  update these, where something changed
//      fresh       [row]            genuinely new barcodes - insert these
//      stale       [row]            name an _id this GRC does not hold
//                                   (deleted since the screen was opened)
//      duplicated  [row]            the same row twice in one save

//    A stored unit that no row names is in none of them: it is left alone.
//    Missing from the request is never a reason to delete anything. */
// export function matchRowsToUnits(rows, units) {
//   const list = Array.isArray(rows) ? rows : [];
//   const stored = Array.isArray(units) ? units : [];

//   const byId = new Map(stored.map((u) => [String(u._id), u]));
//   const byClientId = new Map();
//   const byNumber = new Map();
//   stored.forEach((u) => {
//     const clientId = String(u.clientRowId ?? '').trim();
//     if (clientId && !byClientId.has(clientId)) byClientId.set(clientId, u);
//     /* Indexed under BOTH of a unit's numbers - its own ("9A1143") and the
//        composed reference ("G1319 * 05182 * 1 * 6"). They are different strings
//        now that the save route stops writing one value into both fields, and a
//        caller that names a unit by either one has to find it: matching nothing
//        does not fail loudly here, it classifies the row as NEW, which inserts a
//        second barcode for goods that already have one. */
//     [unitBarcode(u), String(u.barcodeGenerated ?? '').trim()]
//       .filter(Boolean)
//       .filter((no, i, all) => all.indexOf(no) === i)
//       .forEach((no) => {
//         if (!byNumber.has(no)) byNumber.set(no, []);
//         byNumber.get(no).push(u);
//       });
//   });

//   const claimed = new Set();
//   const matched = [];
//   const fresh = [];
//   const stale = [];
//   const duplicated = [];
//   const claim = (row, unit) => {
//     claimed.add(String(unit._id));
//     matched.push({ row, unit });
//   };

//   /* rows naming an _id first, so no other row can take the unit away from
//      the row that names it */
//   list.filter((row) => idOf(row)).forEach((row) => {
//     const unit = byId.get(idOf(row));
//     if (!unit) stale.push(row);
//     else if (claimed.has(String(unit._id))) duplicated.push(row);
//     else claim(row, unit);
//   });

//   /* then rows the screen made, by the screen's own id */
//   const seenClientIds = new Set();
//   list.filter((row) => !idOf(row) && clientIdOf(row)).forEach((row) => {
//     const clientId = clientIdOf(row);
//     if (seenClientIds.has(clientId)) { duplicated.push(row); return; }
//     seenClientIds.add(clientId);
//     const unit = byClientId.get(clientId);
//     if (!unit) { fresh.push(row); return; }
//     if (claimed.has(String(unit._id))) duplicated.push(row);
//     else claim(row, unit);
//   });

//   /* last, a caller that names units by barcode number alone */
//   const freshNumbers = new Set();
//   list.filter((row) => !idOf(row) && !clientIdOf(row)).forEach((row) => {
//     const no = rowBarcode(row);
//     if (!no) { fresh.push(row); return; }            // the server numbers it
//     const unit = (byNumber.get(no) || []).find((u) => !claimed.has(String(u._id)));
//     if (unit) { claim(row, unit); return; }
//     /* the number is already on this GRC, or on another new row of this save */
//     if (byNumber.has(no) || freshNumbers.has(no)) { duplicated.push(row); return; }
//     freshNumbers.add(no);
//     fresh.push(row);
//   });

//   return { matched, fresh, stale, duplicated };
// }

// /* The stored fields an update of an existing barcode may change: the ones
//    the operator edits, and the ones derived from them. Everything else is left
//    exactly as it is:
//      identity    barcodeNo, barcodeGenerated, grcId, grcNo, serialNo, batchNo
//      type        batchType, batchUnique - what the one barcode stands for
//      provenance  supplierId, businessId, locationId, finYear
//      lifecycle   status, current location / business / stock point, transfer,
//                  return and billing references - lib/inventory.js owns those
//      media       imageUrl, filePath, mimeType, originalName
//    so an ordinary edit can never renumber, retype, re-home or resurrect a
//    unit, and label count stays a property of the unit, not of the save. */
// export const EDITABLE_FIELDS = [
//   'oldBarcode', 'itemCode', 'itemId', 'itemName', 'groupId',
//   'billSlNo', 'seq', 'dummy', 'supplierDescription', 'printDescription',
//   'goodsType', 'sm', 'p_m_f', 'fma', 'silkMark', 'hsn', 'gst',
//   'qty', 'qtyNum', 'noOfCuts', 'uom', 'uomType',
//   'purRate', 'encodedPurRate', 'disc', 'finalNet', 'disc2',
//   'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice', 'customFields',
// ];

// /* The fields of `next` that differ from `before` - two documents built the
//    same way - as a $set. Empty when nothing changed, and then nothing is
//    written: an untouched row keeps even its updatedAt. */
// export function editedFields(next, before) {
//   const set = {};
//   EDITABLE_FIELDS.forEach((key) => {
//     if (!sameStored(next?.[key], before?.[key])) set[key] = next?.[key];
//   });
//   return set;
// }

// /* "95" and "95.00" are one price, and key order inside customFields is not
//    an edit. */
// function sameStored(a, b) {
//   if (isPlainObject(a) || isPlainObject(b)) return stableJson(a ?? {}) === stableJson(b ?? {});
//   const x = a === undefined || a === null ? '' : String(a).trim();
//   const y = b === undefined || b === null ? '' : String(b).trim();
//   if (x === y) return true;
//   return x !== '' && y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && Number(x) === Number(y);
// }

// function isPlainObject(value) {
//   return Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
// }

// function stableJson(value) {
//   if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
//   if (isPlainObject(value)) {
//     return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
//   }
//   return JSON.stringify(value ?? null);
// }















/* Saving the Barcode Generation screen of an EXISTING GRC: which submitted
   row is which stored barcode, and what the operator actually changed on it.

   Pure and client-safe. The screen normalises the rows it loads with
   toGridRow, and the save route (app/api/barcode-generation/route.js) runs
   the very same function over each stored unit to see what that row looks
   like untouched - one definition, so the two cannot drift into reading a
   blank the screen fills in on load as an edit.

   Why it exists: the save used to delete every barcode row of the GRC and
   insert whatever the browser sent. Every row got a new _id on every save,
   and a row the request did not carry was gone for good - Generate For
   Changes, which sends only the changed rows, wiped all the others. A save
   now UPDATES the rows it matches, INSERTS only the rows that match nothing,
   and leaves every other stored row alone. Deleting a barcode is its own,
   explicit action. */

/* A barcode row loaded from the database, as the Barcode Generation grid
   holds it: the stored fields, plus the grid's own names for the ones it
   renames. Moved here unchanged from GCRBarcodeGeneration's initialRows
   effect, which now calls it. */
/* the first of two values with something in it - '' and a missing field
   alike are nothing (a stored field defaults to '') */
const filledOr = (value, fallback) => (String(value ?? '').trim() !== '' ? value : (fallback ?? ''));

export function toGridRow(row, index) {
  return {
    ...row,
    id: row._id || row.id || `${row.itemCode || row.itemName || 'saved-row'}-${index}`,
    itemCode: row.itemCode || '',
    itemName: row.itemName || row.supplierDescription || row.printDescription || '',
    sm: row.sm || (row.goodsType === 'SM' ? 'SM' : ''),
    p_m_f: row.p_m_f || (row.goodsType === 'P-M-F' ? 'P-M-F' : ''),
    hsn: row.hsn || '',
    gst: row.gst || '',
    qty: row.qty || '',
    noOfCuts: row.noOfCuts || '',
    purchaseRate: row.purchaseRate || row.purRate || '',
    /* carried through on reload so re-saving an existing GRC does not blank
       the encoded value that was generated with it */
    encodedPurchaseRate: row.encodedPurchaseRate || row.encodedPurRate || '',
    finalPrice: row.finalPrice || row.finalNet || '',
    /* The Discount and Discount Type the grid stored (GRID_INPUT_FIELDS); a
       record saved before they were kept has only `disc`, always a
       percentage, shown in their place. Read side only: the save route still
       writes `disc` from the row's own disc. */
    discount: filledOr(row.discount, row.disc),
    discountType: filledOr(row.discountType, String(row.disc ?? '').trim() !== '' ? 'Percentage' : ''),
    retailPrice: row.retailPrice || row.rsp || '',
    offerPrice: row.offerPrice || '',
    uniqueBarcode: row.uniqueBarcode || (row.batchUnique === 'unique' ? 'Yes' : 'No') || 'No',
    uom: row.uom || '',
    /* THE UNIT'S OWN NUMBER, and nothing else - the grid's Barcode No.

       These two fields are different things - barcodeNo is the unit's own
       number ("9A1163"), barcodeGenerated the composed reference
       ("G1319 * 05183 * 1 * 1"), which stays on the row as stored (...row
       above) for the label and the print picker. This line used to fall back
       to barcodeGenerated when barcodeNo was blank, which put the composed
       value under Barcode No; it no longer does. Every saved barcode has a
       barcodeNo (the save route refuses one without - assertCompleteBarcode),
       so a blank here means the record itself lacks one. */
    barcodeNo: row.barcodeNo || '',
    supplierDescription: row.supplierDescription || row.itemName || '',
    printDescription: row.printDescription || '',
    mode: row.mode || row.batchUnique || '',
    groupId: row.groupId || null,
    groupSize: row.groupSize || 1,
    billSlNo: row.billSlNo || '',
    rsp: row.rsp || row.retailPrice || '',
    /* the base WSP / E-COMM price as stored; a record saved before it was
       kept shows its offer price here, as it always did */
    wsp: filledOr(row.wsp, row.wspPrice),
    dp: filledOr(row.dp, row.dpPrice),
    customFields: row.customFields && typeof row.customFields === 'object' ? row.customFields : {},
  };
}

/* P-M-F IS REQUIRED on every barcode the Barcode Generation screen creates
   (user, 2026-09-17). A row's P-M-F is read the way toGridRow above and the
   save route's buildDoc read it - its own p_m_f, or "P-M-F" when its Attribute
   Add On says so - so the screen and the server agree. No value is ever made
   up for a row that has none. */
export const PMF_REQUIRED_MESSAGE = 'P-M-F is required.';
export const pmfOf = (row) => String(row?.p_m_f || (row?.goodsType === 'P-M-F' ? 'P-M-F' : '')).trim();

/* The barcode number a submitted row carries, read the way the save route
   always has. */
export function rowBarcode(row) {
  return String(row?.barcodeGenerated || row?.barcodeNo || '').trim();
}

/* The barcode number of a stored unit - barcodeNo is canonical,
   barcodeGenerated the legacy copy kept in step with it. */
export function unitBarcode(unit) {
  return String(unit?.barcodeNo || unit?.barcodeGenerated || '').trim();
}

const idOf = (row) => (row?._id === undefined || row?._id === null ? '' : String(row._id).trim());

/* The screen's own id for a row it has not saved yet - Add Item, the ITEMS
   sheet and the Excel import each give every row one. The save stores it on
   the unit it inserts (clientRowId), so the same row sent again is known. */
export const clientIdOf = (row) => (row?.id === undefined || row?.id === null ? '' : String(row.id).trim());

/* Pairs each submitted row with the stored unit it IS.

   1. The unit's _id, which every row loaded from the database carries.
   2. A row the screen has not re-read since saving it - a Submit pressed
      twice, or retried - has no _id yet but carries the screen's own row id,
      stored on its unit as clientRowId.
   3. Only a caller that sends neither (an API client, not this screen) is
      matched on barcode number.

   Barcode numbers are NOT used to identify a row the screen sends: the save
   composes them from supplier, GRC, serial and quantity, and they need not
   be unique - two cuts of the same length on one serial share one. A new row
   that happens to compose the number of a saved unit is still a new row, and
   matching it would silently turn an insert into an edit of the other unit.
   Never on position either: rows are added, removed and re-sorted.

   Returns
     matched     [{ row, unit }]  update these, where something changed
     fresh       [row]            genuinely new barcodes - insert these
     stale       [row]            name an _id this GRC does not hold
                                  (deleted since the screen was opened)
     duplicated  [row]            the same row twice in one save

   A stored unit that no row names is in none of them: it is left alone.
   Missing from the request is never a reason to delete anything. */
export function matchRowsToUnits(rows, units) {
  const list = Array.isArray(rows) ? rows : [];
  const stored = Array.isArray(units) ? units : [];

  const byId = new Map(stored.map((u) => [String(u._id), u]));
  const byClientId = new Map();
  const byNumber = new Map();
  stored.forEach((u) => {
    const clientId = String(u.clientRowId ?? '').trim();
    if (clientId && !byClientId.has(clientId)) byClientId.set(clientId, u);
    /* Indexed under BOTH of a unit's numbers - its own ("9A1143") and the
       composed reference ("G1319 * 05182 * 1 * 6"). They are different strings
       now that the save route stops writing one value into both fields, and a
       caller that names a unit by either one has to find it: matching nothing
       does not fail loudly here, it classifies the row as NEW, which inserts a
       second barcode for goods that already have one. */
    [unitBarcode(u), String(u.barcodeGenerated ?? '').trim()]
      .filter(Boolean)
      .filter((no, i, all) => all.indexOf(no) === i)
      .forEach((no) => {
        if (!byNumber.has(no)) byNumber.set(no, []);
        byNumber.get(no).push(u);
      });
  });

  const claimed = new Set();
  const matched = [];
  const fresh = [];
  const stale = [];
  const duplicated = [];
  const claim = (row, unit) => {
    claimed.add(String(unit._id));
    matched.push({ row, unit });
  };

  /* rows naming an _id first, so no other row can take the unit away from
     the row that names it */
  list.filter((row) => idOf(row)).forEach((row) => {
    const unit = byId.get(idOf(row));
    if (!unit) stale.push(row);
    else if (claimed.has(String(unit._id))) duplicated.push(row);
    else claim(row, unit);
  });

  /* then rows the screen made, by the screen's own id */
  const seenClientIds = new Set();
  list.filter((row) => !idOf(row) && clientIdOf(row)).forEach((row) => {
    const clientId = clientIdOf(row);
    if (seenClientIds.has(clientId)) { duplicated.push(row); return; }
    seenClientIds.add(clientId);
    const unit = byClientId.get(clientId);
    if (!unit) { fresh.push(row); return; }
    if (claimed.has(String(unit._id))) duplicated.push(row);
    else claim(row, unit);
  });

  /* last, a caller that names units by barcode number alone */
  const freshNumbers = new Set();
  list.filter((row) => !idOf(row) && !clientIdOf(row)).forEach((row) => {
    const no = rowBarcode(row);
    if (!no) { fresh.push(row); return; }            // the server numbers it
    const unit = (byNumber.get(no) || []).find((u) => !claimed.has(String(u._id)));
    if (unit) { claim(row, unit); return; }
    /* the number is already on this GRC, or on another new row of this save */
    if (byNumber.has(no) || freshNumbers.has(no)) { duplicated.push(row); return; }
    freshNumbers.add(no);
    fresh.push(row);
  });

  return { matched, fresh, stale, duplicated };
}

/* The stored fields an update of an existing barcode may change: the ones
   the operator edits, and the ones derived from them. Everything else is left
   exactly as it is:
     identity    barcodeNo, barcodeGenerated, grcId, grcNo, serialNo, batchNo
     type        batchType, batchUnique - what the one barcode stands for
     provenance  supplierId, businessId, locationId, finYear
     lifecycle   status, current location / business / stock point, transfer,
                 return and billing references - lib/inventory.js owns those
     media       imageUrl, filePath, mimeType, originalName
   so an ordinary edit can never renumber, retype, re-home or resurrect a
   unit, and label count stays a property of the unit, not of the save. */
/* The ITEMS grid's pricing and measure inputs, stored as typed (the
   barcodeLabel schema, buildDoc in the save route) so every cell the
   operator types into survives Submit and a reload. RSP is not one of them:
   it is retailPrice. */
export const GRID_INPUT_FIELDS = [
  'totalMtr', 'discountType', 'discount', 'disc1', 'wsp', 'dp',
  'rspOfferPct', 'wspOfferPct', 'dpOfferPct', 'markupRSP', 'markupWSP', 'markupDP',
];

export const EDITABLE_FIELDS = [
  'oldBarcode', 'itemCode', 'itemId', 'itemName', 'groupId',
  'billSlNo', 'seq', 'dummy', 'supplierDescription', 'printDescription',
  'goodsType', 'sm', 'p_m_f', 'fma', 'silkMark', 'hsn', 'gst',
  'qty', 'qtyNum', 'noOfCuts', 'uom', 'uomType',
  'purRate', 'encodedPurRate', 'disc', 'finalNet', 'disc2',
  'retailPrice', 'offerPrice', 'wspPrice', 'dpPrice', 'customFields',
  ...GRID_INPUT_FIELDS,
];

/* The fields of `next` that differ from `before` - two documents built the
   same way - as a $set. Empty when nothing changed, and then nothing is
   written: an untouched row keeps even its updatedAt. */
export function editedFields(next, before) {
  const set = {};
  EDITABLE_FIELDS.forEach((key) => {
    if (!sameStored(next?.[key], before?.[key])) set[key] = next?.[key];
  });
  return set;
}

/* "95" and "95.00" are one price, and key order inside customFields is not
   an edit. */
function sameStored(a, b) {
  if (isPlainObject(a) || isPlainObject(b)) return stableJson(a ?? {}) === stableJson(b ?? {});
  const x = a === undefined || a === null ? '' : String(a).trim();
  const y = b === undefined || b === null ? '' : String(b).trim();
  if (x === y) return true;
  return x !== '' && y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y)) && Number(x) === Number(y);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (isPlainObject(value)) {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stableJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value ?? null);
}







