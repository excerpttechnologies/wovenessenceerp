// "use client";

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { createPortal } from "react-dom";
// import { useRouter } from "next/navigation";
// import { useScope } from "./ScopeContext";
// import GrcBarcodeLabelSheet from "./GrcBarcodeLabel";
// /* One geometry module for the sticker stock - the same one the label
//    renderer lays a label out with and the GRC Barcode Print page prints
//    from, so the preview here cannot be measured differently. */
// import { labelRun } from "@/lib/barcodeLabelGeometry";
// import { useOptions } from "./useOptions";
// import { useBarcodeLookup } from "./useScanner";
// import Icon from "./Icon";
// import { computeSampleBarcode } from "@/lib/barcodeFormat";
// import { encodeRate } from "@/lib/purchaseRateCode";
// import { gstPercentForAmount, slabGstPercent } from "@/lib/hsnGst";
// import { purchasePriceError } from "@/lib/purchasePrice";
// import { toGridRow, pmfOf, PMF_REQUIRED_MESSAGE } from "@/lib/barcodeRowSync";
// import { grcTotals, r2, rowQty, rowTaxable, rowGst, rowNet } from "@/lib/grcMoney";
// import {
//   money, finalRateOf, sameValue, sheetColumns, sheetProblems, isLockedRow, lockReason, isBlankRow,
//   SHEET_INHERITED_FIELDS, ITEM_FIELD_LABELS,
// } from "@/lib/itemsSheet";
// import ItemsSheet from "./ItemsSheet";
// import {
//   generateBarcodeValue, composedValueOf, unitNumberOf, parseBarcodeValue,
//   billSlNoForBarcode, highestSerialNo, serialFloorOf,
// } from "@/lib/barcodeValue";
// import {
//   LABEL_MODE, resolveLabelMode, batchAvailableQty, withLabelCounts, pendingBatchRows, labelKey,
//   isUnprintableBatch,
// } from "@/lib/barcodeLabelPrint";
// import {
//   formDefaultsFromSetup, unmappedSetupFields, setupStatusMessage, setupIdentity, formatSetupValue,
// } from "@/lib/supplierPriceSetup";
// import BatchLabelCountDialog from "./BatchLabelCountDialog";
// import * as XLSX from "xlsx";

// /* money(), sameValue() and finalRateOf() live in lib/itemsSheet.js, shared
//    with the ITEMS sheet so the grid formats and re-derives prices exactly as
//    the rest of this screen does. */

// const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
// const decimal2 = (value) => {
//   const raw = String(value ?? '').replace(/[^0-9.]/g, '');
//   const dot = raw.indexOf('.');
//   if (dot < 0) return raw;
//   return raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
// };
// const fixed2 = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '');

// /* THE ADD ITEM FORM'S REQUIRED FIELDS, checked before Submit and Submit &
//    Print Label - both go through submit(), so neither can skip them.
//    Returns { formKey: message } in the order the fields sit on the form (the
//    first is the one focused). Blank, null, undefined and non-numbers are
//    refused; the Purchase Rate keeps its own rule (purchasePriceError: above
//    0). An MTR entry has No. of Cuts where a piece entry has Quantity. */
// const DISCOUNT_TYPES = ["Percentage", "Flat"];
// const REQUIRED_NUMBERS = [
//   ["purchaseRate", "Purchase Rate"],
//   ["discountType", "Discount Type"],
//   ["discount", "Discount"],
//   ["finalPrice", "Final Price"],
//   ["markupRSP", "Markup RSP %"],
//   ["rspPrice", "RSP Price"],
//   ["markupWSP", "Markup WSP %"],
//   ["wspPrice", "WSP Price"],
//   ["markupDP", "Markup E-COMM %"],
//   ["dpPrice", "E-COMM Price"],
// ];
// const REQUIRED_LABELS = Object.fromEntries([["qty", "Quantity"], ["noOfCuts", "No. of Cuts"], ...REQUIRED_NUMBERS]);
// function requiredFieldErrors(form) {
//   const errors = {};
//   const blank = (value) => value === null || value === undefined || String(value).trim() === "";
//   const notNumber = (value) => !Number.isFinite(Number(String(value).trim()));
//   const [countKey, countLabel] = form?.isMtr ? ["noOfCuts", "No. of Cuts"] : ["qty", "Quantity"];
//   const count = form?.[countKey];
//   if (blank(count)) errors[countKey] = `${countLabel} is required`;
//   else if (notNumber(count)) errors[countKey] = `${countLabel} must be a number`;
//   else if (!(Number(count) > 0)) errors[countKey] = `${countLabel} must be greater than 0`;
//   for (const [key, label] of REQUIRED_NUMBERS) {
//     const value = form?.[key];
//     if (key === "discountType") {
//       if (!DISCOUNT_TYPES.includes(value)) errors[key] = `${label} is required`;
//       continue;
//     }
//     if (blank(value)) errors[key] = `${label} is required`;
//     else if (notNumber(value)) errors[key] = `${label} must be a number`;
//     else if (key === "purchaseRate") {
//       const problem = purchasePriceError(value);
//       if (problem) errors[key] = problem;
//     }
//   }
//   return errors;
// }
// /* the Add Item form's three offer percentages */
// const OFFER_PCT_KEYS = ["rspOfferPct", "wspOfferPct", "dpOfferPct"];
// /* start of the notice shown when saved rows get their GST% from HSN Master
//    (an action for the operator - the banner shows it in amber) */
// const GST_FILL_NOTICE = "GST% was missing";

// /* BILL SL NO. IS HIDDEN, NOT REMOVED (2026-09-17, at the business's request).

//    The Add Item form no longer shows or asks for it. It is still the third
//    part of every barcode value (SUPPLIER * GRC * BILL_SL_NO * SERIAL_NO), so
//    the form keeps carrying it exactly as before - form.serialNo, starting at 1
//    and carried from one entry to the next - and the Item Summary and Excel
//    columns still show and accept it. Set this back to true to show the two
//    Bill Sl No. boxes and their "required" checks again. */
// const SHOW_BILL_SL_NO = false;

// /* THE "SUPPLIER PRICE CALCULATION SETUP" BOX IS HIDDEN, NOT REMOVED
//    (2026-09-17, at the business's request). The supplier's setup still fills
//    Discount Type, Discount and the three markups exactly as before, and its
//    Round Off values still apply - only the read-only box above the Price
//    Calculation inputs is not shown. Set this back to true to show it again. */
// const SHOW_SUPPLIER_PRICE_SETUP = false;

// /* The initialRows default. A fresh [] on every render made the effect that
//    loads them run after every render - on the standalone screen, which passes
//    none, that re-rendered for ever and wiped each row as it was added. */
// const NO_ROWS = [];

// /* HSN Master stores a tax slab as a reference to a Tax record plus a price
//    band; the barcode screen needs the percentage. Tax records do not move
//    during a session and one HSN routinely points several slabs at the same
//    record, so each is fetched once and remembered for the life of the page. */
// const taxRateCache = new Map();

// async function fetchTaxRate(taxId) {
//   const key = String(taxId || "");
//   if (!key) return 0;
//   if (taxRateCache.has(key)) return taxRateCache.get(key);

//   try {
//     const response = await fetch(`/api/tax/${key}`);
//     /* a failed read is not a 0% rate - leave it uncached so the next lookup
//        asks again */
//     if (!response.ok) return 0;
//     const payload = await response.json();
//     const rate = slabGstPercent(payload?.doc || {});
//     taxRateCache.set(key, rate);
//     return rate;
//   } catch {
//     return 0;
//   }
// }

// /* An HSN's raw taxSlabs -> the same bands with their rates filled in, which is
//    the shape /api/item/<id>/detail already returns, so both routes into the
//    form hand the slab picker identical rows. */
// async function resolveSlabRates(taxSlabs) {
//   const rows = Array.isArray(taxSlabs) ? taxSlabs.filter(Boolean) : [];
//   if (!rows.length) return [];

//   const ids = [...new Set(rows.map((s) => String(s.gstTaxNameId || "")).filter(Boolean))];
//   const pairs = await Promise.all(ids.map(async (id) => [id, await fetchTaxRate(id)]));
//   const rates = new Map(pairs);

//   return rows.map((s) => ({
//     amountFrom: s.amountFrom,
//     amountTo: s.amountTo,
//     igst: rates.get(String(s.gstTaxNameId || "")) || 0,
//   }));
// }

// const meterRegex = /(mtr|meter|metre|meters|metres)/i;
// const pcRegex = /(pc|pcs|piece|pieces)/i;

// /* Export Excel's headings - the same list, in the same order, as the ITEMS
//    grid's columns (lib/itemsSheet.js), so a sheet and a workbook agree. */
// const exportFieldLabels = ITEM_FIELD_LABELS;

// /* These four columns were exported under "DP ..." before the label became
//    E-COMM. A workbook exported back then is still a perfectly good file to
//    import today, so the old headings keep resolving to the same keys. Without
//    this they would stop matching, fall through to customFields, and the three
//    E-COMM prices would silently arrive empty - which reads as lost data, not
//    as a rename. The keys are unchanged; only what the heading says moved. */
// const legacyExportHeaders = {
//   "DP": "dp",
//   "DP Offer Price": "dpPrice",
//   "DP Offer %": "dpOfferPct",
//   "Markup DP %": "markupDP",
// };

// const normalizeExportHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

// /* Universal Excel converter - converts ANY Excel format to ERP template format.
//    Maps the column-name variations seen in exported and external workbooks to
//    the grid's keys; anything unrecognised is kept as a custom field.

//    Every column Export Excel writes maps back to its own key, so an exported
//    sheet can be edited and imported again. The E-COMM and markup columns used
//    to be dropped here, which silently threw away an edited E-COMM price. */
// function convertToERPTemplate(rawHeaders, rawRows) {
//   // Column mapping: external format → ERP key
//   const columnMap = {
//     'attributeaddon': 'goodsType',
//     'goodstype': 'goodsType',
//     'itemcode': 'itemCode',
//     'itemname': 'itemName',
//     'hsn': 'hsn',
//     'gst': 'gst',
//     'uom': 'uom',
//     'quantity': 'qty',
//     'noofcuts': 'noOfCuts',
//     'totalmtr': 'totalMtr',
//     /* the column was headed "Serial No" for years, so a workbook exported
//        before the rename still imports into the same field */
//     'serialno': 'billSlNo',
//     'billslno': 'billSlNo',
//     'purchaserate': 'purchaseRate',
//     'discounttype': 'discountType',
//     'discount': 'discount',
//     'finalprice': 'finalPrice',
//     'retailprice': 'retailPrice',
//     'disc1': 'disc1',
//     'uniquebarcode': 'uniqueBarcode',
//     'barcodeno': 'barcodeNo',
//     'supplierdescription': 'supplierDescription',
//     'printdescription': 'printDescription',
//     'rsp': 'rsp',
//     'rspoffer': 'rspOfferPct',
//     'offerprice': 'offerPrice',
//     'wsp': 'wsp',
//     'wspoffer': 'wspOfferPct',
//     'wspofferprice': 'wspPrice',
//     'dp': 'dp',
//     'dpoffer': 'dpOfferPct',
//     'dpofferprice': 'dpPrice',
//     'ecomm': 'dp',
//     'ecommoffer': 'dpOfferPct',
//     'ecommofferprice': 'dpPrice',
//     'markuprsp': 'markupRSP',
//     'markupwsp': 'markupWSP',
//     'markupecomm': 'markupDP',
//     'markupdp': 'markupDP',
//     'sm': 'sm',
//     'smnumber': 'sm',
//     'pmf': 'p_m_f',
//   };

//   // Build header mapping
//   const headerMapping = new Map();
//   rawHeaders.forEach((header, index) => {
//     const normalized = normalizeExportHeader(header);
    
//     const erpKey = columnMap[normalized];
//     if (erpKey) {
//       headerMapping.set(index, erpKey);
//     } else if (header && header.trim()) {
//       // Unknown column → custom field
//       headerMapping.set(index, { customField: header.trim() });
//     }
//   });

//   // Convert rows
//   return rawRows.map((values) => {
//     const result = {};
//     const customFields = {};

//     headerMapping.forEach((mapping, index) => {
//       const value = values[index] ?? "";
      
//       if (typeof mapping === 'string') {
//         // Standard ERP field
//         result[mapping] = NUMERIC_IMPORT_KEYS.has(mapping) ? importNumber(value) : value;
//       } else if (mapping.customField) {
//         // Custom field
//         customFields[mapping.customField] = value;
//       }
//     });

//     if (Object.keys(customFields).length > 0) {
//       result.customFields = customFields;
//     }

//     return result;
//   });
// }

// function readExcelFile(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload = () => {
//       try {
//         const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });

//         // Auto-detect sheet: prefer "Barcode Items", else use the first sheet (never the snapshot)
//         const visible = workbook.SheetNames.filter((name) => name !== EXPORT_SNAPSHOT_SHEET);
//         let sheetName = visible[0] || workbook.SheetNames[0];
//         const barcodeSheet = visible.find((name) =>
//           name.toLowerCase().includes('barcode') || name.toLowerCase().includes('items')
//         );
//         if (barcodeSheet) sheetName = barcodeSheet;

//         const sheet = workbook.Sheets[sheetName];
//         const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

//         if (sheetRows.length === 0) {
//           throw new Error("The Excel file is empty.");
//         }

//         const rawHeaders = (sheetRows[0] || []).map((header) => String(header || "").trim());
//         if (rawHeaders.length === 0) {
//           throw new Error("The Excel file does not contain a header row.");
//         }

//         // Convert to ERP template format
//         const convertedRows = convertToERPTemplate(rawHeaders, sheetRows.slice(1));

//         // Validate critical columns
//         const hasCriticalColumn = convertedRows.some((row) => row.itemCode || row.itemName || row.barcodeNo);
//         if (!hasCriticalColumn && convertedRows.length > 0) {
//           throw new Error("Invalid template: Item Code, Item Name, or Barcode No column not found");
//         }

//         // Filter out completely empty rows
//         const rows = convertedRows.filter((row) =>
//           Object.keys(row).some((key) => key !== "customFields" && row[key] !== "") ||
//           Object.values(row.customFields || {}).some((value) => value !== "")
//         );

//         /* The hidden snapshot Export Excel writes: every exported row as it
//            was, by Barcode No. Absent from older exports and other files. */
//         let snapshot = null;
//         const snapshotSheet = workbook.Sheets[EXPORT_SNAPSHOT_SHEET];
//         if (snapshotSheet) {
//           const snapRows = XLSX.utils.sheet_to_json(snapshotSheet, { header: 1, defval: "", raw: false });
//           const snapHeaders = (snapRows[0] || []).map((header) => String(header || "").trim());
//           snapshot = new Map(
//             convertToERPTemplate(snapHeaders, snapRows.slice(1))
//               .filter((row) => String(row.barcodeNo || "").trim())
//               .map((row) => [String(row.barcodeNo).trim(), row])
//           );
//         }

//         resolve({ rows, snapshot });
//       } catch (error) {
//         reject(error);
//       }
//     };
//     reader.onerror = () => reject(new Error("Unable to read the Excel file."));
//     reader.readAsArrayBuffer(file);
//   });
// }

// function rowMatchKey(row) {
//   const barcode = String(row?.barcodeNo || "").trim();
//   if (barcode) return `barcode:${barcode}`;
//   return rowItemKey(row);
// }

// function rowItemKey(row) {
//   const itemCode = String(row?.itemCode || "").trim();
//   const serial = String(row?.billSlNo || "").trim();
//   return itemCode || serial ? `item:${itemCode}|serial:${serial}` : null;
// }

// /* Money, quantity and percentage cells come back as the text Excel displays
//    (sheet_to_json raw: false), so a price typed as 1,980 or ₹1,980 or a GST of
//    5% arrives with its separators and reads as NaN wherever it is added up.
//    Stripped here; anything still not a number is left exactly as typed so the
//    import's own checks can report it. */
// const NUMERIC_IMPORT_KEYS = new Set([
//   "qty", "noOfCuts", "totalMtr", "purchaseRate", "discount", "finalPrice", "retailPrice", "disc1", "gst",
//   "rsp", "rspOfferPct", "offerPrice", "wsp", "wspOfferPct", "wspPrice", "dp", "dpOfferPct", "dpPrice",
//   "markupRSP", "markupWSP", "markupDP",
// ]);

// function importNumber(value) {
//   const text = String(value ?? "").trim();
//   const cleaned = text.replace(/[,\s₹%]/g, "");
//   return cleaned !== "" && Number.isFinite(Number(cleaned)) ? cleaned : text;
// }


// /* Export Excel writes this sheet, very hidden, beside "Barcode Items": every
//    row exactly as it was exported. Import compares each sheet row with its
//    snapshot row, so it knows which cells the operator actually changed.

//    That is the only reliable way to read this template, which carries several
//    prices twice - RSP and Retail Price are one stored value, WSP and WSP Offer
//    Price another - because an operator edits one of a pair and leaves the
//    other as exported. Judged from the sheet alone the untouched copy looks
//    like an edit (an edited Retail Price was thrown away in favour of the stale
//    RSP beside it); judged against the grid, the same sheet imported a second
//    time undoes the first import. With the snapshot any one column can be
//    edited, re-importing changes nothing more, and a cell nobody touched never
//    overwrites the saved value. */
// const EXPORT_SNAPSHOT_SHEET = "Export Snapshot";

// /* The cells of a sheet row that differ from that row as it was exported. */
// function changedCells(importedRow, original) {
//   const changes = { barcodeNo: importedRow.barcodeNo };
//   Object.keys(importedRow).forEach((key) => {
//     if (key !== "customFields" && key !== "barcodeNo" && !sameValue(importedRow[key], original[key])) {
//       changes[key] = importedRow[key];
//     }
//   });
//   const custom = Object.entries(importedRow.customFields || {})
//     .filter(([key, value]) => !sameValue(value, original.customFields?.[key]));
//   if (custom.length) changes.customFields = Object.fromEntries(custom);
//   return changes;
// }

// /* Prices the template carries twice. RSP and Retail Price are the same stored
//    price (retailPrice). WSP and E-COMM are stored only as their offer price
//    (wspPrice, dpPrice) - the base less its offer % - and rsp / wsp / dp
//    themselves are never saved, so the stored side is the one that must move. */
// const PRICE_PAIRS = [
//   { base: "rsp", stored: "retailPrice", pct: null, label: "RSP", storedLabel: "Retail Price" },
//   { base: "wsp", stored: "wspPrice", pct: "wspOfferPct", label: "WSP", storedLabel: "WSP Offer Price" },
//   { base: "dp", stored: "dpPrice", pct: "dpOfferPct", label: "E-COMM", storedLabel: "E-COMM Offer Price" },
// ];

// /* Whether applying an import actually changed a grid row. */
// function rowDiffers(next, before) {
//   return Object.keys(next).some((key) => key !== "id" && (key === "customFields"
//     ? JSON.stringify(next.customFields || {}) !== JSON.stringify(before.customFields || {})
//     : !sameValue(next[key], before[key])));
// }

// function offerFrom(base, pct) {
//   const text = String(base ?? "").trim();
//   return pct > 0 && text !== "" && Number.isFinite(Number(text)) ? fixed2(Number(text) * (1 - pct / 100)) : base;
// }


// /* A row whose two copies of one price disagree cannot be applied without
//    guessing which was meant, so it is refused. `tracked` = read against the
//    export snapshot, where only a pair changed on BOTH sides can disagree. */
// function priceConflicts(changes, existing, tracked) {
//   const given = (key) => key in changes && (tracked || String(changes[key] ?? "").trim() !== "");
//   return PRICE_PAIRS.filter(({ base, stored, pct }) => {
//     if (!given(base) || !given(stored)) return false;
//     const rate = pct ? Number(pct in changes ? changes[pct] : existing?.[pct]) || 0 : 0;
//     return !sameValue(changes[stored], offerFrom(changes[base], rate));
//   }).map(({ base, stored, label, storedLabel }) =>
//     `${label} (${changes[base]}) and ${storedLabel} (${changes[stored]}) ` +
//     (tracked
//       ? "were both changed, to different prices - change only one of them"
//       : "disagree, but they are the same price - make them equal, or Export Excel again and change just one"));
// }

// /* A sheet without an export snapshot - exported before snapshots existed, or
//    made elsewhere - still carries both copies of each price, and an operator
//    changes one of them. When the copies disagree, the one still equal to the
//    unit's saved price is the untouched copy and the other is the change, so
//    that is the one taken. The decision is remembered per unit (`memory`, kept
//    in localStorage): importing the same sheet again after saving - when it is
//    the CHANGED copy that now equals the saved price - repeats the decision
//    instead of flipping back. Only a pair where BOTH copies differ from the
//    saved price is refused, since nothing says which was meant. */
// const PRICE_MEMORY_KEY = "gcr-import-price-choices";

// function resolveUntrackedPairs(sheetRow, existing, memory, memoryKey) {
//   const changes = { ...sheetRow };
//   const picks = [];
//   const ambiguous = [];
//   const filled = (key) => key in sheetRow && String(sheetRow[key] ?? "").trim() !== "";
//   PRICE_PAIRS.forEach(({ base, stored, pct, label, storedLabel }) => {
//     if (!filled(base) || !filled(stored)) return;
//     const rate = pct ? Number(pct in sheetRow ? sheetRow[pct] : existing?.[pct]) || 0 : 0;
//     const fromBase = offerFrom(sheetRow[base], rate);
//     if (sameValue(sheetRow[stored], fromBase)) return;                 // the two copies agree
//     const key = memoryKey(label);
//     const remembered = memory[key];
//     let pick = remembered && sameValue(remembered.base, sheetRow[base]) && sameValue(remembered.stored, sheetRow[stored])
//       ? remembered.pick : null;
//     if (!pick && existing) {
//       const baseIsSaved = sameValue(fromBase, existing[stored]);
//       const storedIsSaved = sameValue(sheetRow[stored], existing[stored]);
//       if (storedIsSaved && !baseIsSaved) pick = "base";
//       else if (baseIsSaved && !storedIsSaved) pick = "stored";
//     }
//     if (!pick) {
//       ambiguous.push(existing
//         ? `${label} (${sheetRow[base]}) and ${storedLabel} (${sheetRow[stored]}) are one price and both differ from the saved ${existing[stored] || "value"} - make them equal`
//         : `${label} (${sheetRow[base]}) and ${storedLabel} (${sheetRow[stored]}) are one price - make them equal`);
//       return;
//     }
//     memory[key] = { base: sheetRow[base], stored: sheetRow[stored], pick };
//     if (pick === "base") {
//       delete changes[stored];
//       picks.push({ used: label, value: sheetRow[base], ignored: storedLabel, stale: sheetRow[stored] });
//     } else {
//       delete changes[base];
//       picks.push({ used: storedLabel, value: sheetRow[stored], ignored: label, stale: sheetRow[base] });
//     }
//   });
//   return { changes, picks, ambiguous };
// }

// /* What one imported sheet row does to the grid row it matched - or to a blank
//    row when it is new. `changes` is only what the operator changed when the
//    sheet carries its export snapshot (`original`), otherwise the whole sheet
//    row. Those values are written, then everything the grid holds twice or
//    derives is brought back in line, because the save reads the OTHER copy:

//      - a changed RSP / Retail Price, WSP / WSP Offer Price or E-COMM / E-COMM
//        Offer Price moves both of its pair (the offer % applied), so the stored
//        price - the one the save keeps - carries the change;
//      - Offer Price, which the label, the till and the GRC total sell at first,
//        follows a changed RSP when no offer was running; a running offer is
//        kept and reported, never re-priced by a formula of its own;
//      - a changed Purchase Rate re-derives Final Price by the Add Item rule
//        when the row's discount is known, and is re-encoded for the label;
//      - purRate / finalNet / encodedPurRate are the stored names of
//        purchaseRate / finalPrice / encodedPurchaseRate. A row loaded from the
//        database carries both and the save prefers the stored one, so they are
//        set from the grid names;
//      - P-M-F falls back to the Attribute Add On, as it does for a saved row. */
// function mergeImportedRow(existing, changes, { id, barcodeNo, rateCodeMapping, original = null, onNote = () => {} }) {
//   const tracked = Boolean(original);
//   const next = {
//     ...(existing || emptyRow(id)),
//     ...changes,
//     id,
//     barcodeNo,
//     customFields: { ...(existing?.customFields || {}), ...(changes.customFields || {}) },
//   };
//   // tracked: every key in `changes` was edited; untracked: a filled cell counts
//   const given = (key) => key in changes && (tracked || String(changes[key] ?? "").trim() !== "");
//   const pctOf = (key) => Number(next[key]) || 0;

//   PRICE_PAIRS.forEach(({ base, stored, pct }) => {
//     const rate = pct ? pctOf(pct) : 0;
//     if (given(stored)) {
//       if (!given(base) && !(rate > 0)) next[base] = next[stored];
//     } else if (given(base) || (pct && given(pct))) {
//       next[stored] = offerFrom(next[base], rate);
//     }
//   });

//   if (given("rsp") || given("retailPrice")) {
//     const rate = pctOf("rspOfferPct");
//     const offerBefore = tracked ? original.offerPrice : existing?.offerPrice;
//     const retailBefore = tracked ? original.retailPrice : existing?.retailPrice;
//     if (given("offerPrice")) {
//       /* an Offer Price in the sheet is kept as typed - except, in a sheet
//          without a snapshot, one still equal to that sheet's own retail price,
//          which is the exported "no offer" copy */
//       const sheetRetail = ["retailPrice", "rsp"].filter(given).map((key) => changes[key]);
//       if (!tracked && sheetRetail.some((value) => sameValue(changes.offerPrice, value))) {
//         next.offerPrice = next.retailPrice;
//       } else if (existing && String(next.offerPrice ?? "").trim() && !sameValue(next.offerPrice, next.retailPrice)
//         && (!String(existing.offerPrice ?? "").trim() || sameValue(existing.offerPrice, existing.retailPrice))) {
//         onNote("offerStarted");
//       }
//     } else if (rate > 0) {
//       next.offerPrice = offerFrom(next.retailPrice, rate);
//     } else if (!tracked && "offerPrice" in changes) {
//       // a blank Offer Price cell: no offer
//     } else if (!String(offerBefore ?? "").trim()) {
//       // there was no offer, and there still is none
//     } else if (sameValue(offerBefore, retailBefore)) {
//       next.offerPrice = next.retailPrice;
//     } else if (!sameValue(next.retailPrice, retailBefore)) {
//       onNote("offerKept");
//     }
//   }

//   const rateEdited = given("purchaseRate") || given("discount") || given("discountType") || given("disc1");
//   if (rateEdited && !given("finalPrice")) {
//     const before = tracked ? original : existing;
//     const discountKnown = !before || sameValue(before.finalPrice, round2(finalRateOf(before)));
//     if (discountKnown) next.finalPrice = String(round2(finalRateOf(next)));
//     else onNote("finalKept");
//   }

//   next.purRate = next.purchaseRate;
//   next.finalNet = next.finalPrice;
//   if (!existing || (given("purchaseRate") && !sameValue(next.purchaseRate, existing.purchaseRate))) {
//     next.encodedPurchaseRate = encodeRate(String(next.purchaseRate ?? ""), rateCodeMapping);
//   }
//   next.encodedPurRate = next.encodedPurchaseRate;

//   if (!String(next.p_m_f || "").trim() && next.goodsType === "P-M-F") next.p_m_f = "P-M-F";
//   return next;
// }

// function customFieldNames(rows) {
//   return Array.from(new Set(rows.flatMap((row) => Object.keys(row?.customFields || {}))));
// }

// function modeFromUom(uom, uniqueBarcode = "No") {
//   const value = String(uom || "").trim();
//   if (meterRegex.test(value)) return "batch";
//   if (pcRegex.test(value)) return "unique";
//   return String(uniqueBarcode).toLowerCase() === "yes" ? "unique" : "batch";
// }

// function usesMeterCuts(row) {
//   return meterRegex.test(String(row?.uom || "")) && String(row?.uniqueBarcode || "No").toLowerCase() === "yes";
// }

// function buildMeterCutPlan({ totalMtr = 0, qtyOrCuts = 1, uniqueBarcode = false }) {
//   const cuts = Math.max(1, Number(qtyOrCuts) || 1);
//   const total = Math.max(0, Number(totalMtr) || 0);
//   const plan = [];
//   let remaining = total;

//   for (let i = 0; i < cuts; i += 1) {
//     const share = i === 0 ? total : remaining;
//     if (i < cuts - 1) remaining = Math.max(0, remaining - share);
//     plan.push({
//       index: i + 1,
//       value: Number(share || 0),
//       shareBarcode: !uniqueBarcode,
//       groupId: uniqueBarcode ? `meter-${i + 1}` : "meter-shared",
//     });
//   }

//   return plan;
// }

// function makeMeterCutRows(count = 1, totalMtr = 0) {
//   const safeCount = Math.max(1, Number(count || 1));
//   void totalMtr;

//   return Array.from({ length: safeCount }, (_, index) => ({
//     id: index + 1,
//     value: "",
//   }));
// }

// /* CUTS (MTR) - every box holds only what the operator typed into it.

//    The balance (Total MTR less the cuts entered) is shown beside the boxes and
//    never written into one: this used to put the remaining metres into the
//    first blank cut on blur, so after 60 of 114 the next box already held 54
//    and had to be backspaced out before the real cut could be typed. */

// /* Metres actually entered - a blank or zero box is not a cut. */
// function sumCutRows(rows = []) {
//   return round2(rows.reduce((sum, row) => {
//     const value = Number(row?.value || 0);
//     return sum + (Number.isFinite(value) && value > 0 ? value : 0);
//   }, 0));
// }

// /* No. of Cuts changed or + pressed: the rows already there keep their values;
//    rows are added EMPTY, or dropped from the end. */
// function resizeCutRows(rows = [], count = 1) {
//   const safeCount = Math.max(1, Math.floor(Number(count)) || 1);
//   const next = rows.slice(0, safeCount);
//   let lastId = next.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0);
//   while (next.length < safeCount) next.push({ id: ++lastId, value: "" });
//   return next;
// }

// /* An edit that would take the cuts past Total MTR is refused, and the message
//    names the metres still free for that box - the value is never trimmed to
//    fit. An edit that does not raise the total always stands, so cuts left over
//    the limit by a later change to Total MTR can still be worked back down.
//    Returns "" when the edit may stand; with no Total MTR there is no limit. */
// function cutEditError(rows, index, nextValue, totalMtr) {
//   const available = round2(Number(totalMtr || 0));
//   if (!Number.isFinite(available) || available <= 0) return "";
//   const nextTotal = sumCutRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, value: nextValue } : row)));
//   if (nextTotal <= available || nextTotal <= sumCutRows(rows)) return "";
//   const balance = Math.max(0, round2(available - sumCutRows(rows.filter((_, rowIndex) => rowIndex !== index))));
//   return `Cut quantity cannot exceed the available balance of ${balance} MTR.`;
// }

// function emptyRow(id) {
//   return {
//     id,
//     /* the barcode physically on the incoming goods - the vendor's own printed
//        number. It identifies the item, and is carried through to the saved
//        label so the new barcode stays traceable back to the old one. */
//     oldBarcode: "",
//     itemCode: "",
//     itemName: "",
//     goodsType: "",
//     hsn: "",
//     gst: "",
//     uom: "",
//     qty: "",
//     noOfCuts: "",
//     totalMtr: "",
//     purchaseRate: "",
//     discountType: "Percentage",
//     discount: "0",
//     finalPrice: "",
//     retailPrice: "",
//     disc1: "",
//     uniqueBarcode: "No",
//     barcodeNo: "",
//     supplierDescription: "",
//     printDescription: "",
//     mode: "unique",
//     groupId: null,
//     groupSize: 1,
//     billSlNo: "",
//     rsp: "",
//     wsp: "",
//     dp: "",
//   };
// }

// function isDateActive(row, date = new Date()) {
//   const effectiveDate = row?.effectiveDate ? new Date(row.effectiveDate) : null;
//   const expiryDate = row?.expiryDate ? new Date(row.expiryDate) : null;
//   const validEffective = !effectiveDate || (Number.isFinite(effectiveDate.getTime()) && effectiveDate <= date);
//   const validExpiry = !expiryDate || (Number.isFinite(expiryDate.getTime()) && expiryDate >= date);
//   return validEffective && validExpiry;
// }

// function buildBarcodePlan({ uom, uniqueBarcode, qtyOrCuts, totalMtr, cutRows = [] }) {
//   const meterMode = meterRegex.test(String(uom || ""));
//   const targetQty = Math.max(1, Number(qtyOrCuts || 1));

//   if (meterMode) {
//     const meterValues = cutRows.length > 0
//       ? cutRows.map((cut) => Number(cut.value || 0)).filter((value) => Number.isFinite(value) && value > 0)
//       : [Math.max(0, Number(totalMtr || 0)) || 1];

//     if (uniqueBarcode) {
//       return meterValues.map((value, index) => ({
//         qty: Number(value || 0),
//         groupId: `meter-${index + 1}`,
//         groupSize: 1,
//         shareBarcode: false,
//       }));
//     }

//     const sharedValue = meterValues.reduce((sum, value) => sum + Number(value || 0), 0) || targetQty;
//     return [{
//       qty: sharedValue,
//       groupId: "meter-shared",
//       groupSize: Math.max(1, meterValues.length),
//       shareBarcode: true,
//     }];
//   }

//   if (uniqueBarcode) {
//     return Array.from({ length: targetQty }, (_, index) => ({
//       qty: 1,
//       groupId: `pc-${index + 1}`,
//       groupSize: 1,
//       shareBarcode: false,
//     }));
//   }

//   return [{
//     qty: targetQty,
//     groupId: "pc-shared",
//     groupSize: 1,
//     shareBarcode: true,
//   }];
// }

// function calculatePrices(row) {
//   const finalValue = finalRateOf(row);

//   /* The markups are the row's own - the Add Item form starts them from the
//      supplier's Price Calculation Setup. No percentage is assumed for a blank
//      one: it used to be 100 / 15 / 15 here, which priced a row by numbers
//      nobody had entered. */
//   const rsp = finalValue * (1 + Number(row.markupRSP || 0) / 100);
//   const wsp = finalValue * (1 + Number(row.markupWSP || 0) / 100);
//   const dp = finalValue * (1 + Number(row.markupDP || 0) / 100);

//   return {
//     ...row,
//     finalPrice: round2(finalValue),
//     rsp: round2(rsp),
//     wsp: round2(wsp),
//     dp: round2(dp),
//   };
// }

// /* Searchable combobox used for Item Code and HSN.
//    Queries the server as the user types (debounced 300 ms).
//    value  = the stored id/code string
//    label  = what the user sees in the closed field
//    onSearch(q) called as user types
//    onSelect(optionObject) called on selection
//    onClear() called when × is clicked
//    editableSelection - keep the picked value in a real text box (HSN): clicking
//      it edits that text character by character instead of opening an empty
//      search whose placeholder merely looks like the value. */
// function SearchSelect({ placeholder, value, label, onSearch, options, loading, onSelect, onClear, editableClass, editableSelection = false }) {
//   const [open, setOpen] = useState(false);
//   const [query, setQuery] = useState('');
//   const [highlighted, setHighlighted] = useState(0);
//   const containerRef = useRef(null);
//   const inputRef = useRef(null);

//   /* close on outside click */
//   useEffect(() => {
//     const handler = (e) => {
//       if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
//     };
//     document.addEventListener('mousedown', handler);
//     return () => document.removeEventListener('mousedown', handler);
//   }, []);

//   useEffect(() => { setHighlighted(0); }, [options]);

//   const handleKey = (e) => {
//     if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); onSearch(query); } return; }
//     if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, options.length - 1)); }
//     else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
//     else if (e.key === 'Enter') { e.preventDefault(); if (options[highlighted]) { onSelect(options[highlighted]); setOpen(false); setQuery(''); } }
//     else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
//   };

//   const isSelected = Boolean(value);
//   const selectedText = String(label || value || '');
//   const openWithSelectedText = () => {
//     if (open) return;
//     setQuery(selectedText);
//     setOpen(true);
//     onSearch(selectedText);
//   };

//   return (
//     <div ref={containerRef} className="relative">
//       {editableSelection ? (
//         /* always an input: closed it shows the picked text, open it edits a
//            copy of that text. Focus seeds the copy with the same string, so the
//            caret the click placed stays where it landed. */
//         <div className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${editableClass}`}>
//           <input
//             ref={inputRef}
//             className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
//             placeholder={placeholder}
//             value={open ? query : selectedText}
//             onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); setOpen(true); }}
//             onFocus={openWithSelectedText}
//             /* still focused after a pick or Escape: a click reopens it */
//             onClick={openWithSelectedText}
//             onKeyDown={(e) => {
//               if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { openWithSelectedText(); return; }
//               handleKey(e);
//             }}
//             autoComplete="off"
//           />
//           {loading
//             ? <span className="shrink-0 text-[11px] text-gray-400">…</span>
//             : isSelected
//               ? <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onClear(); setQuery(''); setOpen(false); }}
//                   className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Clear" tabIndex={-1}>✕</button>
//               : <span className="shrink-0 text-gray-400 text-[12px]">🔍</span>}
//         </div>
//       ) : isSelected && !open ? (
//         /* closed + value: show label with clear button */
//         <div className={`flex items-center gap-1 rounded-md px-2 py-2 text-sm ${editableClass}`}>
//           <span className="flex-1 truncate">{label || value}</span>
//           <button type="button" onClick={() => { onClear(); setQuery(''); }}
//             className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Clear"
//             /* not a tab stop: it wipes the picked value with no confirm, and
//                it sat exactly where Tab from the field before it landed */
//             tabIndex={-1}>✕</button>
//         </div>
//       ) : (
//         /* open / searching */
//         <div className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${editableClass}`}>
//           <input
//             ref={inputRef}
//             className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
//             placeholder={isSelected ? (label || value) : placeholder}
//             value={query}
//             onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); setOpen(true); }}
//             onFocus={() => { setOpen(true); onSearch(query); }}
//             onKeyDown={handleKey}
//             autoComplete="off"
//           />
//           {loading
//             ? <span className="shrink-0 text-[11px] text-gray-400">…</span>
//             : <span className="shrink-0 text-gray-400 text-[12px]">🔍</span>}
//         </div>
//       )}

//       {open && (
//         <div className="absolute z-50 mt-1 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-md"
//           style={{ maxHeight: 280 }}>
//           {loading && <div className="px-3 py-2 text-[12px] text-gray-400">Searching…</div>}
//           {!loading && options.length === 0 && (
//             <div className="px-3 py-2 text-[12px] text-gray-400">No results found</div>
//           )}
//           {options.map((opt, i) => (
//             <div
//               key={opt.value}
//               className={`cursor-pointer px-3 py-2 text-[13px] ${i === highlighted ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
//               onMouseDown={() => { onSelect(opt); setOpen(false); setQuery(''); }}
//               onMouseEnter={() => setHighlighted(i)}
//             >
//               <div className="font-medium leading-tight">{opt.primaryLabel}</div>
//               {opt.secondaryLabel && <div className="text-[11px] text-gray-400">{opt.secondaryLabel}</div>}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// /* Serial No., rendered TWICE - once in row 2, once in row 3.

//    ONE value, two windows. Both call sites pass form.serialNo, so row 3 always
//    shows whatever row 2 holds; there is no second serial and no second state.
//    The difference between them is only who may write it:

//      row 2  editable  - this is where the number is entered
//      row 3  locked    - a read-back of the same value, beside HSN

//    readOnly rather than disabled for the locked one: a disabled input is left
//    out of form submission in plain HTML, and although this form reads from React
//    state rather than the DOM, readOnly keeps the two consistent. The handlers
//    below close what readOnly leaves open - a caret keystroke in a clicked box, a
//    drop, a scroll - while Tab and Ctrl/Cmd still work, so focus can leave and
//    the value can still be copied.

//    Digits only on the editable one. Stripping the rest on the way in is what
//    makes "positive whole number" true by construction: a minus sign, a decimal
//    point or a pasted "12abc" never reach state. Empty IS allowed while typing;
//    submit() rejects a blank one. */
// function SerialNoField({ value, onChange, editableClass, readOnlyClass, locked = false }) {
//   const lockedProps = {
//     readOnly: true,
//     tabIndex: -1,
//     "aria-readonly": "true",
//     title: "Shows the Bill Sl No. entered above",
//     onKeyDown: (event) => { if (event.key !== "Tab" && !event.ctrlKey && !event.metaKey) event.preventDefault(); },
//     onPaste: (event) => event.preventDefault(),
//     onCut: (event) => event.preventDefault(),
//     onDrop: (event) => event.preventDefault(),
//   };

//   return (
//     <div className="max-w-[110px] space-y-1 xl:max-w-none">
//       <label className="block text-[11px] font-semibold text-gray-700">Bill Sl No. *</label>
//       <div className="relative">
//         <input
//           value={value ?? ""}
//           inputMode="numeric"
//           aria-label="Bill Sl No."
//           placeholder="1"
//           {...(locked ? lockedProps : { onChange: (event) => onChange(event.target.value) })}
//           onWheel={(event) => event.currentTarget.blur()}
//           className={`w-full rounded-md px-2 py-2 text-sm ${locked ? `cursor-not-allowed pr-7 ${readOnlyClass}` : editableClass}`}
//         />
//         {locked && (
//           <svg
//             viewBox="0 0 24 24"
//             aria-hidden="true"
//             className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//           >
//             <rect x="5" y="11" width="14" height="9" rx="2" />
//             <path d="M8 11V8a4 4 0 0 1 8 0v3" />
//           </svg>
//         )}
//       </div>
//     </div>
//   );
// }

// /* The five prices worked out from a form's rate, discount, markups and
//    offers - the arithmetic the rate effect below has always done, in one place
//    so re-seeding the markups from a supplier recalculates the same way. */
// function withFormPrices(current) {
//   const purchaseRate = Number(current.purchaseRate || 0);
//   const discount = Number(current.discount || 0);
//   const finalValue = current.discountType === "Flat"
//     ? Math.max(0, purchaseRate - discount)
//     : Math.max(0, purchaseRate - (purchaseRate * discount) / 100);
//   const rspPrice = finalValue * (1 + Number(current.markupRSP || 0) / 100);
//   const wspPrice = finalValue * (1 + Number(current.markupWSP || 0) / 100);
//   const dpPrice = finalValue * (1 + Number(current.markupDP || 0) / 100);
//   const rspOfferPct = Number(current.rspOfferPct || 0);
//   const wspOfferPct = Number(current.wspOfferPct || 0);
//   const dpOfferPct = Number(current.dpOfferPct || 0);

//   return {
//     ...current,
//     finalPrice: finalValue.toFixed(2),
//     rspPrice: rspPrice.toFixed(2),
//     wspPrice: wspPrice.toFixed(2),
//     dpPrice: dpPrice.toFixed(2),
//     rspOfferPrice: (rspPrice * (1 - rspOfferPct / 100)).toFixed(2),
//     wspOfferPrice: (wspPrice * (1 - wspOfferPct / 100)).toFixed(2),
//     dpOfferPrice: (dpPrice * (1 - dpOfferPct / 100)).toFixed(2),
//   };
// }

// /* OFFER PRICE / MARK DOWN FROM THE INVENTORY ITEM.

//    Inventory > Item stores an item's offers as percentages (RSP / WSP / Ecomm
//    Offer %; /api/item/<id>/detail returns them as rspOfferPct, wspOfferPct,
//    dpOfferPct). `item` is that detail, or null when the item is cleared. Its
//    percentages go into the offer boxes - and OFFER APPLICABLE is ticked, since
//    the boxes are disabled otherwise - and withFormPrices turns them into offer
//    prices off the row's RSP / WSP / E-COMM, the same arithmetic as a typed %.
//    A % the operator typed is never overwritten, and an item with no offer
//    clears only what the previous item filled in.

//    Pure: what the last item filled in (and whether it ticked the box) is kept
//    on the form itself as _autoOffer, which the submitted row never carries -
//    so it is safe inside a setForm updater, which React may run twice. */
// function withItemOffers(current, item) {
//   const previous = current._autoOffer || null;
//   const next = { ...current };
//   const applied = {};
//   OFFER_PCT_KEYS.forEach((key) => {
//     const now = Number(current[key] || 0);
//     const auto = previous?.[key] != null ? Number(previous[key]) : null;
//     if (now !== 0 && now !== auto) return;                 // typed by the operator
//     if (item?.[key] != null) {
//       /* rounded once, so the box and the record of it always agree */
//       const pct = Number(fixed2(item[key]));
//       next[key] = fixed2(pct);
//       applied[key] = pct;
//     } else if (auto !== null) {
//       next[key] = 0;
//     }
//   });
//   const any = Object.keys(applied).length > 0;
//   if (any) next.offerApplicable = true;
//   /* untick only what an item ticked, and never while a % the operator typed
//      is still in a box - it would sit disabled and be dropped on Submit */
//   else if (previous?.ticked && OFFER_PCT_KEYS.every((key) => Number(next[key] || 0) === 0)) next.offerApplicable = false;
//   next._autoOffer = any ? { ...applied, ticked: Boolean(previous?.ticked) || !current.offerApplicable } : null;
//   return next;
// }

// /* SUPPLIER -> PRICE CALCULATION SETUP, as this form shows it.

//    The fields that have an input of their own on the form (Discount Type,
//    Discount, and Mark Up on Cost RSP / WSP / E-comm) are not repeated here -
//    those inputs start from the supplier's values. What is left (the Round Off
//    values) is listed read-only, with the supplier it came from. */
// function SupplierPriceSetupPanel({ setup }) {
//   if (!setup) return null;
//   const message = setupStatusMessage(setup);
//   const extra = unmappedSetupFields(setup);
//   return (
//     <div className="mb-4 rounded-md border border-[#dfe4eb] bg-[#f8fafc] px-3 py-2 text-[12px] text-gray-700" data-testid="supplier-price-setup">
//       <div className="flex flex-wrap items-baseline justify-between gap-2">
//         <span className="font-semibold">Supplier Price Calculation Setup</span>
//         {setup.supplierName && (
//           <span className="text-gray-500">{setup.supplierName}{setup.supplierCode ? ` (${setup.supplierCode})` : ""}</span>
//         )}
//       </div>
//       {message ? (
//         <div className="mt-1 text-gray-500">{message}</div>
//       ) : (
//         <>
//           {extra.length > 0 && (
//             <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
//               {extra.map((field) => (
//                 <span key={field.key}>
//                   {field.label}: <span className="font-semibold">{field.value === null ? "-" : formatSetupValue(field.value)}</span>
//                 </span>
//               ))}
//             </div>
//           )}
//           {/* the "... fill the matching inputs below." hint that listed those
//               fields is removed (user, 2026-09-17); the inputs themselves still
//               start from the supplier's values */}
//         </>
//       )}
//     </div>
//   );
// }

// function AddItemModal({ open, onClose, onSubmit, onSubmitAndPrint, barcodeFormat, business = "", markupDefaults = {}, priceSetup = null, rateCodeMapping = null, grcId = null, initialBillSlNo = 1, initialNextSerialNo = 1 }) {
//   /* The form's starting prices: the GRC supplier's Price Calculation Setup
//      when the screen has it, otherwise the three markups it has always been
//      handed. A value the supplier does not have is left blank - never a
//      made-up percentage. */
//   const markups = markupDefaults || {};
//   const supplierDefaults = priceSetup
//     ? formDefaultsFromSetup(priceSetup)
//     : {
//       ...(markups.rsp != null ? { markupRSP: formatSetupValue(markups.rsp) } : {}),
//       ...(markups.wsp != null ? { markupWSP: formatSetupValue(markups.wsp) } : {}),
//       ...(markups.dp != null ? { markupDP: formatSetupValue(markups.dp) } : {}),
//     };
//   const supplierMarkups = {
//     markupRSP: supplierDefaults.markupRSP ?? "",
//     markupWSP: supplierDefaults.markupWSP ?? "",
//     markupDP: supplierDefaults.markupDP ?? "",
//   };
//   const createBlankForm = (overrides = {}) => ({
//     oldBarcode: "",
//     itemCode: "",
//     itemName: "",
//     itemId: "",
//     hsnId: "",
//     hsn: "",
//     hsn2Id: "",
//     hsn2: "",
//     gst: "0",
//     goodsType: "",
//     sm: "",
//     p_m_f: "",
//     /* the vendor's own wording for the goods. Was previously never a form
//        field - the generated row just copied itemName into it - so it is
//        seeded from the Old Barcode lookup and editable from row 2. */
//     supplierDescription: "",
//     printDescription: "",
//     uniqueBarcode: true,
//     isMtr: false,
//     qty: "",
//     noOfCuts: "",
//     totalMtr: "",
//     purchaseRate: "",
//     discountType: supplierDefaults.discountType || "Percentage",
//     discount: supplierDefaults.discount ?? "0",
//     finalPrice: "0.00",
//     markupRSP: supplierMarkups.markupRSP,
//     rspPrice: "0.00",
//     markupWSP: supplierMarkups.markupWSP,
//     wspPrice: "0.00",
//     markupDP: supplierMarkups.markupDP,
//     dpPrice: "0.00",
//     rspOfferPct: 0,
//     rspOfferPrice: "0.00",
//     wspOfferPct: 0,
//     wspOfferPrice: "0.00",
//     dpOfferPct: 0,
//     dpOfferPrice: "0.00",
//     offerApplicable: false,
//     serialNo: initialBillSlNo,
//     ...overrides,
//   });

//   const [form, setForm] = useState(() => createBlankForm());
//   /* Required-field problems from the last Submit, { formKey: message }. An
//      entry drops as soon as its field is put right (the effect below); none is
//      ever added except by Submit, so the form is not red before it is tried. */
//   const [fieldErrors, setFieldErrors] = useState({});
//   const formRootRef = useRef(null);
//   useEffect(() => {
//     setFieldErrors((current) => {
//       const keys = Object.keys(current);
//       if (!keys.length) return current;
//       const now = requiredFieldErrors(form);
//       const still = Object.fromEntries(keys.filter((key) => now[key]).map((key) => [key, now[key]]));
//       /* a field whose problem CHANGED (not a number -> not above 0) shows the new one */
//       return keys.every((key) => now[key] === current[key]) ? current : still;
//     });
//   }, [form]);
//   /* the red outline and the message under a required field */
//   const invalid = (key) => (fieldErrors[key] ? " !border-red-500 ring-1 ring-red-500" : "");
//   const fieldError = (key) => (fieldErrors[key]
//     ? <p className="text-[11px] font-medium text-red-600" role="alert">{fieldErrors[key]}</p>
//     : null);
//   /* State for the next Serial No. (4th part of barcode) - fetched from backend.
//      Seeded from Item Summary SL NO (the row's position in the summary table),
//      passed in as initialNextSerialNo. The operator can still override it. */
//   const [nextSerialNo, setNextSerialNo] = useState(initialNextSerialNo);
//   const [serialNoLoading, setSerialNoLoading] = useState(false);
//   /* the reservation round trip - the Add buttons are disabled while it runs
//      so a double-click cannot burn a second block of numbers */
//   const [reserving, setReserving] = useState(false);
//   const [reserveError, setReserveError] = useState("");
//   /* Says why the offer boxes did not fill: the picked item has no RSP / WSP /
//      E-COMM Offer % saved in Inventory > Item (most items have none). */
//   const [offerNote, setOfferNote] = useState("");
//   const noteItemOffers = (item, code) => setOfferNote(
//     item && OFFER_PCT_KEYS.some((key) => item[key] != null)
//       ? ""
//       : item
//         ? `No RSP / WSP / E-COMM Offer % is saved for ${code} in Inventory > Item.`
//         : `${code} was not found in Inventory > Item, so no Offer % was filled.`
//   );
//   /* Server-side search state for Item Code and HSN */
//   const [itemOptions, setItemOptions] = useState([]);
//   const [itemLoading, setItemLoading] = useState(false);
//   const [itemLabel, setItemLabel] = useState('');
//   const [hsnOptions, setHsnOptions] = useState([]);
//   const [hsnLoading, setHsnLoading] = useState(false);
//   const [hsnLabel, setHsnLabel] = useState('');
//   /* The selected HSN's tax slabs, rates already resolved. GST% is derived from
//      these rather than stored once, because a price-banded HSN answers
//      differently as the row's value moves - see the effect below. */
//   const [hsnSlabs, setHsnSlabs] = useState([]);
//   /* What that effect last wrote into GST%. Anything else in the box is the
//      operator's own figure and is left alone; null means the HSN just changed,
//      so the next auto-fill overrides whatever is there. */
//   const autoGstRef = useRef(null);
//   /* picking a second HSN while the first is still loading must not let the
//      first one's slabs land on top - same guard the item detail read uses */
//   const hsnDetailRef = useRef(0);
//   const itemTimerRef = useRef(null);
//   const hsnTimerRef = useRef(null);
//   const itemDetailRef = useRef(0);

//   /* ── Second HSN field (Row 3) — independent state so it can be changed
//      without touching the first HSN field (Row 1) and vice-versa. */
//   const [hsn2Options, setHsn2Options] = useState([]);
//   const [hsn2Loading, setHsn2Loading] = useState(false);
//   const [hsn2Label, setHsn2Label] = useState('');
//   const [hsn2Slabs, setHsn2Slabs] = useState([]);
//   const hsn2DetailRef = useRef(0);
//   const hsn2TimerRef = useRef(null);
//   const [cutRows, setCutRows] = useState([{ id: 1, value: "" }]);
//   const [focusedCutIndex, setFocusedCutIndex] = useState(0);
//   const [cutError, setCutError] = useState("");
//   /* Refs for each CUTS(MTR) input — used for Tab/Shift+Tab keyboard navigation
//      so focus jumps directly to the next/prev input and never lands on the
//      +/− buttons between rows. The array is rebuilt on every render; stale
//      entries are avoided because React calls each ref callback with null when
//      the element unmounts and with the new element when it mounts. */
//   const cutsInputRefs = useRef([]);

//   /* Debounced server-side item search */
//   const searchItems = (q) => {
//     clearTimeout(itemTimerRef.current);
//     setItemLoading(true);
//     itemTimerRef.current = setTimeout(() => {
//       const qs = new URLSearchParams({ perPage: '20', search: q || '' });
//       if (business) qs.set('business', business);
//       fetch('/api/item?' + qs)
//         .then((r) => r.json())
//         .then((d) => {
//           setItemOptions((d.rows || []).map((row) => ({
//             value: String(row._id),
//             primaryLabel: row.itemCode || row.name || '',
//             secondaryLabel: row.name !== row.itemCode ? row.name : '',
//             itemCode: row.itemCode || '',
//             name: row.name || '',
//             subGroupId: row.subGroupId || '',
//             description: row.description || '',
//           })));
//         })
//         .catch(() => setItemOptions([]))
//         .finally(() => setItemLoading(false));
//     }, 300);
//   };

//   /* Debounced server-side HSN search */
//   const searchHsn = (q) => {
//     clearTimeout(hsnTimerRef.current);
//     setHsnLoading(true);
//     hsnTimerRef.current = setTimeout(() => {
//       const qs = new URLSearchParams({ perPage: '20', search: q || '' });
//       /* this company's HSN Master only - the same code can exist under
//          another company with a different (or missing) tax slab */
//       if (business) qs.set('business', business);
//       fetch('/api/hsn?' + qs)
//         .then((r) => r.json())
//         .then((d) => {
//           setHsnOptions((d.rows || []).map((row) => ({
//             value: String(row._id),
//             primaryLabel: row.code || '',
//             secondaryLabel: row.description || '',
//             code: row.code || '',
//             description: row.description || '',
//             taxSlabs: Array.isArray(row.taxSlabs) ? row.taxSlabs : [],
//           })));
//         })
//         .catch(() => setHsnOptions([]))
//         .finally(() => setHsnLoading(false));
//     }, 300);
//   };

//   /* Debounced server-side HSN search — second HSN field (Row 3).
//      Identical query to searchHsn but writes into hsn2Options/hsn2Loading so
//      the two dropdowns are completely independent. */
//   const searchHsn2 = (q) => {
//     clearTimeout(hsn2TimerRef.current);
//     setHsn2Loading(true);
//     hsn2TimerRef.current = setTimeout(() => {
//       const qs = new URLSearchParams({ perPage: '20', search: q || '' });
//       if (business) qs.set('business', business);
//       fetch('/api/hsn?' + qs)
//         .then((r) => r.json())
//         .then((d) => {
//           setHsn2Options((d.rows || []).map((row) => ({
//             value: String(row._id),
//             primaryLabel: row.code || '',
//             secondaryLabel: row.description || '',
//             code: row.code || '',
//             description: row.description || '',
//             taxSlabs: Array.isArray(row.taxSlabs) ? row.taxSlabs : [],
//           })));
//         })
//         .catch(() => setHsn2Options([]))
//         .finally(() => setHsn2Loading(false));
//     }, 300);
//   };

//   /* OLD BARCODE LOOKUP.

//      status: idle | loading | found | error. `resolvedRef` holds the code that
//      is currently loaded into the form, so re-scanning the same label - the
//      classic double-trigger of a wedge scanner - neither refetches nor
//      rebuilds the form. `inFlightRef` blocks a second request while one is
//      already running. */
//   const [lookup, setLookup] = useState({ status: "idle", message: "" });
//   const resolvedRef = useRef("");
//   const inFlightRef = useRef("");

//   /* the shared scanner hook every other scanning screen uses (POS, stock
//      transfer, receiving, returns), so this screen talks to /api/barcode/scan
//      the same way and surfaces the same server messages */
//   const { lookup: scanLookup } = useBarcodeLookup({ business, intent: "LOOKUP" });

//   const readOnlyClass = "border border-[#dfe4eb] bg-[#f3f5f9] text-gray-700";
//   const editableClass = "border border-[#dfe4eb] bg-white text-gray-700";

//   useEffect(() => {
//     if (!open) return;
//     /* NOTHING RESETS THE BILL SL NO. HERE.

//        This effect used to open the modal with serialNo = the grid's row count
//        plus one - and that count is the number of BARCODE ROWS, so after
//        twenty pieces of bill line 1 the modal proposed bill line 21, and that
//        number went into the third part of every barcode it made. The Bill Sl
//        No. is the supplier's line number, not a count of anything here, so
//        what the operator last entered is simply left alone. */
//     setCutRows((current) => {
//       if (!form.isMtr) return [{ id: 1, value: "" }];
//       const count = Math.max(1, Number(form.noOfCuts || current.length || 1));
//       return makeMeterCutRows(count, Number(form.totalMtr || 0));
//     });
//     setCutError("");
//     setFieldErrors({});

//     /* pre-populate dropdowns with initial results so they are not blank on open */
//     searchItems('');
//     searchHsn('');
//     searchHsn2('');
//   }, [open]);

//   useEffect(() => {
//     setForm((current) => withFormPrices(current));
//   }, [form.purchaseRate, form.discount, form.discountType]);

//   /* A DIFFERENT SUPPLIER, OR A CHANGED SETUP, RE-SEEDS THE PRICE FIELDS.

//      Keyed on the supplier and its setup values rather than on the object the
//      page hands down: the page re-reads the GRC after every Submit, and that
//      must not throw away markups the operator has typed. The first render is
//      already seeded by createBlankForm. */
//   const setupKey = setupIdentity(priceSetup);
//   const seededSetupRef = useRef(setupKey);
//   useEffect(() => {
//     if (seededSetupRef.current === setupKey) return;
//     seededSetupRef.current = setupKey;
//     /* nothing of the previous supplier's survives: a field the new one has
//        no value for goes back to the form's own starting value */
//     setForm((current) => withFormPrices({
//       ...current,
//       ...supplierMarkups,
//       discountType: supplierDefaults.discountType || "Percentage",
//       discount: supplierDefaults.discount ?? "0",
//     }));
//     // supplierDefaults/supplierMarkups are derived from the setup this key names
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [setupKey]);

//   /* The real Purchase Rate written through the active Purchase Rate Code
//      Master. Derived, never stored in form state and never written back into
//      form.purchaseRate - the typed number has to stay exactly as entered.
//      Empty string while the master is unconfigured or still loading, which is
//      what hides the read-only echo under the input. */
//   const encodedPurchaseRate = useMemo(
//     () => encodeRate(form.purchaseRate, rateCodeMapping),
//     [form.purchaseRate, rateCodeMapping]
//   );

//   /* GST% <- the HSN's Tax Slabs.

//      A single-slab HSN is one flat rate. A price-banded HSN answers by value,
//      so the rate is re-derived whenever the row's value moves rather than being
//      frozen at the moment the HSN was picked - edit the purchase rate or the
//      discount and a row can cross a slab boundary. Final Price is the value
//      matched against the bands, falling back to Purchase Rate before any
//      discount has been worked out.

//      The field stays editable throughout: once the operator types over the
//      auto-filled rate, form.gst no longer matches what this effect last wrote
//      and their figure is left standing until a different HSN is chosen. */
//   useEffect(() => {
//     if (!hsnSlabs.length) return;

//     const amount = Number(form.finalPrice) || Number(form.purchaseRate) || 0;
//     const next = String(gstPercentForAmount(hsnSlabs, amount) || 0);

//     if (autoGstRef.current !== null && form.gst !== autoGstRef.current) return;
//     autoGstRef.current = next;
//     if (form.gst !== next) setForm((current) => ({ ...current, gst: next }));
//   }, [hsnSlabs, form.finalPrice, form.purchaseRate, form.gst]);

//   if (!open) return null;

//   const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

//   /* Both Bill Sl No. boxes come through here, which is why they stay in
//      step. See SerialNoField for why the digits are stripped rather than
//      validated. */
//   const updateSerialNo = (raw) => updateField("serialNo", String(raw ?? "").replace(/\D/g, ""));

//   /* Fetch next Serial No. (4th part of barcode) when Bill Sl No. changes */
//   const fetchNextSerialNo = useCallback(async (billSlNo) => {
//     if (!grcId || !billSlNo || !String(billSlNo).trim()) {
//       setNextSerialNo(1);
//       return;
//     }
//     setSerialNoLoading(true);
//     try {
//       const response = await fetch(`/api/barcode-generation/next-serial?grcId=${grcId}&billSlNo=${encodeURIComponent(String(billSlNo).trim())}`);
//       const data = await response.json();
//       if (data.ok && data.nextSerialNo) {
//         setNextSerialNo(Number(data.nextSerialNo));
//       } else {
//         setNextSerialNo(1);
//       }
//     } catch {
//       setNextSerialNo(1);
//     } finally {
//       setSerialNoLoading(false);
//     }
//   }, [grcId]);

//   useEffect(() => {
//     const billSlNo = String(form.serialNo ?? "").trim();
//     if (billSlNo) {
//       fetchNextSerialNo(billSlNo);
//     } else {
//       setNextSerialNo(1);
//     }
//   }, [form.serialNo, fetchNextSerialNo]);

//   /* HSN appears in row 1 and again in row 3. Both call this, so both read
//      the same form.hsnId / hsnLabel and both go through handleHsnSelection -
//      picking in either box updates the other and pulls the GST slab with it.
//      Fully editable in both places: this is a live search, never locked. */
//   const renderHsnField = () => (
//     <div className="space-y-1">
//       <label className="block text-[11px] font-semibold text-gray-700">HSN *</label>
//       <SearchSelect
//         placeholder="Search HSN…"
//         value={form.hsnId || form.hsn}
//         label={hsnLabel}
//         onSearch={searchHsn}
//         options={hsnOptions}
//         loading={hsnLoading}
//         onSelect={(opt) => handleHsnSelection(opt)}
//         onClear={() => handleHsnSelection(null)}
//         editableClass={editableClass}
//         editableSelection
//       />
//     </div>
//   );

//   /* Second HSN field (Row 3) — bound to its own independent state so the
//      operator can set a different HSN here without affecting the first one,
//      and vice-versa.  Initialised from the item master alongside the first
//      field, but fully editable after that. */
//   const renderHsn2Field = () => (
//     <div className="space-y-1">
//       <label className="block text-[11px] font-semibold text-gray-700">HSN *</label>
//       <SearchSelect
//         placeholder="Search HSN…"
//         value={form.hsn2Id || form.hsn2}
//         label={hsn2Label}
//         onSearch={searchHsn2}
//         options={hsn2Options}
//         loading={hsn2Loading}
//         onSelect={(opt) => handleHsn2Selection(opt)}
//         onClear={() => handleHsn2Selection(null)}
//         editableClass={editableClass}
//         editableSelection
//       />
//     </div>
//   );

//   const resolveProductGroup = async (subGroupId) => {
//     if (!subGroupId) {
//       setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
//       return;
//     }

//     try {
//       const response = await fetch(`/api/product-group/${subGroupId}`);
//       const payload = await response.json();
//       const subGroup = payload?.doc || null;
//       if (!subGroup) {
//         setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
//         return;
//       }

//       let groupName = "";
//       if (subGroup.parentId) {
//         const groupResponse = await fetch(`/api/product-group/${subGroup.parentId}`);
//         const groupPayload = await groupResponse.json();
//         groupName = groupPayload?.doc?.name || "";
//       }

//       setForm((current) => ({
//         ...current,
//         subGroupName: subGroup.name || "",
//         groupName,
//       }));
//     } catch (error) {
//       console.error(error);
//       setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
//     }
//   };

//   /* Hands the form a new slab table. A fresh HSN overrides whatever GST% holds
//      - including a hand-typed figure, which belonged to the HSN that was there
//      before - so the override guard is cleared with it. An HSN with no slabs at
//      all leaves GST% at 0 and editable rather than blocking the operator. */
//   const applyHsnSlabs = (slabs) => {
//     autoGstRef.current = null;
//     setHsnSlabs(slabs);
//     if (!slabs.length) setForm((current) => ({ ...current, gst: "0" }));
//   };

//   /* HSN picked -> its Tax Slabs from HSN Master. The search dropdown already
//      carries them, so the extra read only runs for an HSN that arrived without
//      one (a code typed in, or a stale option). Which slab applies is settled by
//      the effect below, not here, because that answer depends on the price. */
//   const resolveHsnGst = async (hsnDoc) => {
//     const detailRequest = hsnDetailRef.current + 1;
//     hsnDetailRef.current = detailRequest;

//     const code = hsnDoc?.code || hsnDoc?.label || "";
//     let hsnId = hsnDoc?.value || "";
//     let taxSlabs = Array.isArray(hsnDoc?.taxSlabs) ? hsnDoc.taxSlabs : [];

//     if (!taxSlabs.length && code) {
//       try {
//         const response = await fetch(`/api/hsn?perPage=20&search=${encodeURIComponent(code)}${business ? `&business=${encodeURIComponent(business)}` : ""}`);
//         const payload = await response.json();
//         const match = (payload.rows || []).find((row) => String(row.code || '').trim() === String(code).trim());
//         taxSlabs = Array.isArray(match?.taxSlabs) ? match.taxSlabs : [];
//         /* a code looked up by text still records the master's id */
//         if (!hsnId && match?._id) hsnId = String(match._id);
//       } catch {
//         taxSlabs = [];
//       }
//     }

//     if (hsnDetailRef.current !== detailRequest) return;

//     setForm((current) => ({ ...current, hsn: code, hsnId: hsnId || current.hsnId }));

//     const slabs = await resolveSlabRates(taxSlabs);
//     if (hsnDetailRef.current !== detailRequest) return;
//     /* an HSN this company's master has no slab for leaves the GST% already on
//        the form (an Old Barcode's own rate) instead of resetting it to 0 */
//     if (!slabs.length && hsnDoc?.keepGst) return;
//     applyHsnSlabs(slabs);
//   };

//   /* Clears everything the previous Old Barcode put on the form, so barcode B
//      can never inherit barcode A's item, HSN or GST. */
//   const clearFetchedItem = () => {
//     resolvedRef.current = "";
//     hsnDetailRef.current += 1;
//     hsn2DetailRef.current += 1;
//     applyHsnSlabs([]);
//     applyHsn2Slabs([]);
//     setItemLabel('');
//     setHsnLabel('');
//     setHsn2Label('');
//     setOfferNote('');
//     setForm((current) => withFormPrices(withItemOffers({
//       ...current,
//       itemId: "", itemCode: "", itemName: "",
//       hsnId: "", hsn: "", hsn2Id: "", hsn2: "", gst: "0",
//       printDescription: "", supplierDescription: "", subGroupName: "", groupName: "",
//     }, null)));
//   };

//   /* An old barcode's item in Inventory > Item, with its detail (offer %).
//      Stored barcode rows carry no itemId, and the Item master keeps most codes
//      in `name` (itemCode blank), so the code is matched the way the Item Code
//      picker lists items - itemCode first, then name. null when not found. */
//   const itemDetailByCode = async (itemId, itemCode) => {
//     try {
//       let id = itemId ? String(itemId) : "";
//       const code = String(itemCode || "").trim();
//       if (!id && code) {
//         const qs = new URLSearchParams({ perPage: "20", search: code });
//         if (business) qs.set("business", business);
//         const response = await fetch("/api/item?" + qs);
//         if (!response.ok) return null;
//         const rows = (await response.json()).rows || [];
//         const match = rows.find((row) => String(row.itemCode || "").trim() === code)
//           || rows.find((row) => String(row.name || "").trim() === code);
//         id = match?._id ? String(match._id) : "";
//       }
//       if (!id) return null;
//       const response = await fetch(`/api/item/${encodeURIComponent(id)}/detail`);
//       return response.ok ? (await response.json())?.item || null : null;
//     } catch {
//       return null;
//     }
//   };

//   /* Old Barcode -> the item it belongs to.

//      Reuses POST /api/barcode/scan, the single endpoint every scanner in the
//      app already talks to. With intent 'LOOKUP' it is a pure read - it never
//      writes, reserves or consumes anything - and it is the only lookup that
//      matches on oldBarcode as well as barcodeNo/barcodeGenerated, which is
//      exactly what is printed on incoming supplier goods. */
//   const lookupOldBarcode = async (rawCode) => {
//     const code = String(rawCode || "").trim();

//     if (!code) {
//       setLookup({ status: "idle", message: "" });
//       /* only what an old barcode loaded is cleared with it - Tab through an
//          empty Old Barcode box used to wipe an Item Code picked by hand */
//       if (resolvedRef.current) clearFetchedItem();
//       return;
//     }
//     /* already loaded, or already being fetched - a repeat scan is a no-op */
//     if (code === resolvedRef.current || code === inFlightRef.current) return;

//     inFlightRef.current = code;
//     setLookup({ status: "loading", message: "Fetching barcode..." });
//     /* the previous LOOKUP's item must not linger while the new one is on its
//        way - but an Item Code / HSN / description the operator entered is only
//        replaced by a barcode that is actually found (see below), never wiped
//        by one that is not */
//     if (resolvedRef.current) clearFetchedItem();

//     try {
//       const result = await scanLookup(code);

//       /* the user typed on - this answer is for a code that is no longer in
//          the box, so dropping it avoids a late response overwriting a newer one */
//       if (inFlightRef.current !== code) return;

//       if (!result?.ok || !result.unit) {
//         /* "belongs to a different business" is worth repeating verbatim - it
//            tells the operator to change the company selector, which the
//            generic wording would send them hunting for. Anything else reads
//            as plain not-found. */
//         setLookup({
//           status: "error",
//           message: result?.code === "BARCODE_WRONG_BUSINESS"
//             ? result.error
//             : result?.code === "OFFLINE"
//               ? "Could not reach the server. Try the scan again."
//               : "Barcode not found. Please enter or scan a valid barcode.",
//         });
//         return;
//       }

//       const unit = result.unit;
//       /* a match replaces whatever item / HSN / GST was on the form */
//       clearFetchedItem();

//       /* When a barcode is scanned, populate labels so the SearchSelect
//          closed state shows the item code and HSN code correctly. */
//       /* The SAME fallback the gate and the row use, so the box can never
//          read as empty while submit() thinks an item is selected. A stored
//          label whose itemCode is blank but which carries a name used to leave
//          this label '' - the control then showed its "Search Item Code…"
//          placeholder, looking unselected, while Submit quietly went ahead on
//          the slugified name. */
//       setItemLabel(unit.itemCode || unit.itemName || '');
//       if (unit.hsn) setHsnLabel(unit.hsn);
//       if (unit.hsn) setHsn2Label(unit.hsn);

//       setForm((current) => ({
//         ...current,
//         oldBarcode: code,
//         itemId: unit.itemId ? String(unit.itemId) : "",
//         itemCode: unit.itemCode || "",
//         itemName: unit.itemName || "",
//         hsnId: "",
//         hsn: unit.hsn || "",
//         hsn2Id: "",
//         hsn2: unit.hsn || "",
//         gst: unit.gst ? String(unit.gst) : current.gst,
//         printDescription: unit.printDescription || unit.description || unit.itemName || "",
//         /* the vendor's wording as recorded on the matched label - falls back
//            to the merged description so an older row without a separate
//            supplier description still fills the field */
//         supplierDescription: unit.supplierDescription || unit.description || "",
//         purchaseRate: unit.rate ? String(unit.rate) : current.purchaseRate,
//         uom: unit.uom || current.uom,
//       }));

//       resolvedRef.current = code;
//       setLookup({
//         status: "found",
//         message: `${unit.itemCode || unit.itemName || "Item"} loaded.`,
//       });

//       /* GST% from this company's HSN Master for the record's HSN - the path a
//          hand-picked HSN takes, so the rate follows the tax slab rather than
//          the old label's stored GST% (keepGst: an HSN missing from the master
//          leaves the record's own rate standing) - and the HSN ids the two HSN
//          boxes are shown by. */
//       if (unit.hsn) {
//         resolveHsnGst({ code: unit.hsn, keepGst: true });
//         resolveHsn2Gst({ code: unit.hsn });
//       }
//       /* the scan itself is applied - a code re-entered from here on is a new
//          lookup, not a repeat of one still in flight */
//       if (inFlightRef.current === code) inFlightRef.current = "";
//       /* the item's own offer % from Inventory > Item - the old label's offer
//          price belongs to that label, not to the item. Dropped if another code
//          was entered, or an item was picked by hand, while it was on its way. */
//       const offerTurn = itemDetailRef.current;
//       const offerItem = await itemDetailByCode(unit.itemId, unit.itemCode || unit.itemName);
//       if (resolvedRef.current !== code || itemDetailRef.current !== offerTurn) return;
//       setForm((current) => withFormPrices(withItemOffers(current, offerItem)));
//       noteItemOffers(offerItem, unit.itemCode || unit.itemName || code);
//     } catch {
//       if (inFlightRef.current !== code) return;
//       setLookup({ status: "error", message: "Could not reach the server. Try the scan again." });
//     } finally {
//       if (inFlightRef.current === code) inFlightRef.current = "";
//     }
//   };

//   const handleItemSelection = async (opt) => {
//     hsnDetailRef.current += 1;
//     hsn2DetailRef.current += 1;
//     /* The operator is answering the very complaint the banner makes, so the
//        banner goes now rather than surviving until a submit finally passes.
//        setReserveError("") used to be reached ONLY at the end of submit(),
//        after every gate had cleared - so "Please select an Item Code." stayed
//        on screen while the operator picked the item it asked for, and only a
//        successful Submit could take it down. */
//     setReserveError("");
//     if (!opt) {
//       itemDetailRef.current += 1;
//       setItemLabel('');
//       applyHsnSlabs([]);
//       applyHsn2Slabs([]);
//       setHsn2Label('');
//       /* Clearing the item also forgets the Old Barcode it may have come
//          from. lookupOldBarcode short-circuits on `code === resolvedRef.current`
//          (it will not re-fetch a code it has already resolved), so leaving the
//          ref set stranded the screen: the X emptied the Item Code box while a
//          green "<code> loaded." note still claimed the item was there, and
//          re-visiting the unchanged Old Barcode field would not bring it back.
//          Submit then answered "Please select an Item Code." - the reported
//          symptom again, from the opposite direction. */
//       resolvedRef.current = "";
//       inFlightRef.current = "";
//       setLookup({ status: "idle", message: "" });
//       setForm((current) => withFormPrices(withItemOffers({
//         ...current,
//         itemId: "", itemName: "", itemCode: "", subGroupName: "", groupName: "", printDescription: "",
//         hsnId: "", hsn: "", hsn2Id: "", hsn2: "", gst: "0",
//         ...supplierMarkups,
//       }, null)));
//       setOfferNote("");
//       return;
//     }
//     const detailRequest = itemDetailRef.current + 1;
//     itemDetailRef.current = detailRequest;
//     const itemCode = opt.itemCode || opt.primaryLabel || "";
//     const itemName = opt.name || opt.secondaryLabel || "";
//     setItemLabel(itemCode);
//     applyHsnSlabs([]);
//     applyHsn2Slabs([]);
//     setForm((current) => ({
//       ...current,
//       itemId: opt.value,
//       itemCode,
//       itemName,
//       printDescription: opt.description || "",
//       hsnId: "",
//       hsn: "",
//       hsn2Id: "",
//       hsn2: "",
//       gst: "0",
//       ...supplierMarkups,
//     }));
//     try {
//       const response = await fetch(`/api/item/${encodeURIComponent(opt.value)}/detail`);
//       const payload = await response.json();
//       if (itemDetailRef.current !== detailRequest) return;
//       if (!response.ok) {
//         /* no detail - the previous item's offer % must not stay on this one */
//         setForm((current) => withFormPrices(withItemOffers(current, null)));
//         setOfferNote("");
//         return;
//       }
//       const item = payload?.item || {};
//       setHsnLabel(item.hsnCode || '');
//       setHsn2Label(item.hsnCode || '');
//       /* the detail route resolves the item's HSN slabs for us - bands and
//          rates both - so the rate is picked by value here exactly as it is
//          when the HSN is chosen by hand */
//       applyHsnSlabs(Array.isArray(item.slabs) ? item.slabs : []);
//       applyHsn2Slabs(Array.isArray(item.slabs) ? item.slabs : []);
//       /* An item's OWN markup, when the item master has a real number for
//          it, is more specific than the supplier's; otherwise the supplier's
//          Price Calculation Setup value stays. Anything that is not a number
//          never replaces it - "No" used to arrive here and blank Markup E-COMM %. */
//       const itemMarkup = (value, fallback) => (value == null || fixed2(value) === "" ? fallback : fixed2(value));
//       setForm((current) => withFormPrices(withItemOffers({
//         ...current,
//         hsnId: item.hsnId || "",
//         hsn: item.hsnCode || "",
//         hsn2Id: item.hsnId || "",
//         hsn2: item.hsnCode || "",
//         markupRSP: itemMarkup(item.markupRSP, supplierMarkups.markupRSP),
//         markupWSP: itemMarkup(item.markupWSP, supplierMarkups.markupWSP),
//         markupDP: itemMarkup(item.markupDP, supplierMarkups.markupDP),
//       }, item)));
//       noteItemOffers(item, itemCode);
//     } catch {
//       if (itemDetailRef.current === detailRequest) {
//         setHsnLabel('');
//         setHsn2Label('');
//         setForm((current) => withFormPrices(withItemOffers(current, null)));
//         setOfferNote("");
//       }
//     }
//     await resolveProductGroup(opt.subGroupId || "");
//   };

//   const handleHsnSelection = async (opt) => {
//     if (!opt) {
//       hsnDetailRef.current += 1;
//       setHsnLabel('');
//       applyHsnSlabs([]);
//       setForm((current) => ({ ...current, hsnId: "", hsn: "", gst: "0" }));
//       return;
//     }
//     setHsnLabel(opt.code || opt.primaryLabel || "");
//     await resolveHsnGst({
//       value: opt.value,
//       code: opt.code || opt.primaryLabel || "",
//       label: opt.primaryLabel || "",
//       taxSlabs: opt.taxSlabs || [],
//     });
//   };

//   /* ── Second HSN field handlers (Row 3) ─────────────────────────────────────
//      Mirror of applyHsnSlabs / resolveHsnGst / handleHsnSelection but operating
//      on hsn2 form fields and hsn2* state only.  Changing the second HSN never
//      touches form.hsnId / form.hsn / hsnSlabs / autoGstRef, and vice-versa. */

//   const applyHsn2Slabs = (slabs) => {
//     setHsn2Slabs(slabs);
//   };

//   const resolveHsn2Gst = async (hsnDoc) => {
//     const detailRequest = hsn2DetailRef.current + 1;
//     hsn2DetailRef.current = detailRequest;

//     const code = hsnDoc?.code || hsnDoc?.label || "";
//     let hsn2Id = hsnDoc?.value || "";
//     let taxSlabs = Array.isArray(hsnDoc?.taxSlabs) ? hsnDoc.taxSlabs : [];

//     if (!taxSlabs.length && code) {
//       try {
//         const response = await fetch(`/api/hsn?perPage=20&search=${encodeURIComponent(code)}${business ? `&business=${encodeURIComponent(business)}` : ""}`);
//         const payload = await response.json();
//         const match = (payload.rows || []).find((row) => String(row.code || '').trim() === String(code).trim());
//         taxSlabs = Array.isArray(match?.taxSlabs) ? match.taxSlabs : [];
//         if (!hsn2Id && match?._id) hsn2Id = String(match._id);
//       } catch {
//         taxSlabs = [];
//       }
//     }

//     if (hsn2DetailRef.current !== detailRequest) return;

//     setForm((current) => ({ ...current, hsn2: code, hsn2Id: hsn2Id || current.hsn2Id }));

//     const slabs = await resolveSlabRates(taxSlabs);
//     if (hsn2DetailRef.current !== detailRequest) return;
//     applyHsn2Slabs(slabs);
//   };

//   const handleHsn2Selection = async (opt) => {
//     if (!opt) {
//       hsn2DetailRef.current += 1;
//       setHsn2Label('');
//       applyHsn2Slabs([]);
//       setForm((current) => ({ ...current, hsn2Id: "", hsn2: "" }));
//       return;
//     }
//     setHsn2Label(opt.code || opt.primaryLabel || "");
//     await resolveHsn2Gst({
//       value: opt.value,
//       code: opt.code || opt.primaryLabel || "",
//       label: opt.primaryLabel || "",
//       taxSlabs: opt.taxSlabs || [],
//     });
//   };

//   /* Markup RSP % and RSP Offer % take two digits - 0 to 99 - and nothing else.

//      The cap lives here and not on the input maxLength because maxLength only
//      limits typing. A paste, an autofill, a drop or an input event raised by an
//      extension all bypass it, and every one of those still fires onChange - so
//      sanitising on the way into state is what actually holds.

//      Stripping non-digits also removes the minus sign and the decimal point, so
//      these two fields carry whole positive percentages only. No separate
//      "> 99" test is needed: two digits IS 0-99, and the slice enforces it
//      before the value is ever parsed.

//      Deliberately scoped to these two fields only - Markup WSP %, Markup E-COMM %,
//      Discount and GST% are untouched and still accept their existing range. */
//   const twoDigitPercent = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 2);
//   const updateMarkupValue = (key, value) => {
//     setForm((current) => {
//       const next = { ...current, [key]: value };
//       const netPrice = Number(current.finalPrice || 0);

//       if (key === "markupRSP") {
//         const pct = Number(value || 0);
//         next.rspPrice = (netPrice * (1 + pct / 100)).toFixed(2);
//         next.rspOfferPrice = (Number(next.rspPrice) * (1 - Number(current.rspOfferPct || 0) / 100)).toFixed(2);
//       }
//       if (key === "rspPrice") {
//         const price = Number(value || 0);
//         next.markupRSP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
//         next.rspOfferPrice = (price * (1 - Number(current.rspOfferPct || 0) / 100)).toFixed(2);
//       }
//       if (key === "markupWSP") {
//         const pct = Number(value || 0);
//         next.wspPrice = (netPrice * (1 + pct / 100)).toFixed(2);
//         next.wspOfferPrice = (Number(next.wspPrice) * (1 - Number(current.wspOfferPct || 0) / 100)).toFixed(2);
//       }
//       if (key === "wspPrice") {
//         const price = Number(value || 0);
//         next.markupWSP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
//         next.wspOfferPrice = (price * (1 - Number(current.wspOfferPct || 0) / 100)).toFixed(2);
//       }
//       if (key === "markupDP") {
//         const pct = Number(value || 0);
//         next.dpPrice = (netPrice * (1 + pct / 100)).toFixed(2);
//         next.dpOfferPrice = (Number(next.dpPrice) * (1 - Number(current.dpOfferPct || 0) / 100)).toFixed(2);
//       }
//       if (key === "dpPrice") {
//         const price = Number(value || 0);
//         next.markupDP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
//         next.dpOfferPrice = (price * (1 - Number(current.dpOfferPct || 0) / 100)).toFixed(2);
//       }

//       return next;
//     });
//   };

//   const updateOfferValue = (key, value) => {
//     setForm((current) => {
//       const next = { ...current, [key]: value };
//       const rspBase = Number(current.rspPrice || 0);
//       const wspBase = Number(current.wspPrice || 0);
//       const dpBase = Number(current.dpPrice || 0);

//       if (key === "rspOfferPct") {
//         const pct = Number(value || 0);
//         next.rspOfferPrice = (rspBase * (1 - pct / 100)).toFixed(2);
//       }
//       if (key === "rspOfferPrice") {
//         const offerPrice = Number(value || 0);
//         next.rspOfferPct = rspBase > 0 ? fixed2(((rspBase - offerPrice) / rspBase) * 100) : '0.00';
//       }
//       if (key === "wspOfferPct") {
//         const pct = Number(value || 0);
//         next.wspOfferPrice = (wspBase * (1 - pct / 100)).toFixed(2);
//       }
//       if (key === "wspOfferPrice") {
//         const offerPrice = Number(value || 0);
//         next.wspOfferPct = wspBase > 0 ? fixed2(((wspBase - offerPrice) / wspBase) * 100) : '0.00';
//       }
//       if (key === "dpOfferPct") {
//         const pct = Number(value || 0);
//         next.dpOfferPrice = (dpBase * (1 - pct / 100)).toFixed(2);
//       }
//       if (key === "dpOfferPrice") {
//         const offerPrice = Number(value || 0);
//         next.dpOfferPct = dpBase > 0 ? fixed2(((dpBase - offerPrice) / dpBase) * 100) : '0.00';
//       }

//       return next;
//     });
//   };

//   /* one EMPTY row on the end - the cuts already entered are kept as they are */
//   const addCutRow = () => {
//     const next = resizeCutRows(cutRows, cutRows.length + 1);
//     setCutRows(next);
//     updateField("noOfCuts", String(next.length));
//   };

//   const removeCutRow = (index) => {
//     if (cutRows.length <= 1) return;
//     const next = cutRows.filter((_, rowIndex) => rowIndex !== index);
//     setCutRows(next);
//     updateField("noOfCuts", String(next.length));
//     setCutError("");
//     setFocusedCutIndex((focused) => (focused > index ? focused - 1 : Math.min(focused, next.length - 1)));
//   };

//   /* Writes this box and nothing else. Total MTR is the available length the
//      balance is worked from, so a cut no longer rewrites it either. Returns
//      what the box now holds - the previous value when the edit was refused. */
//   const updateCutValue = (index, raw) => {
//     const value = decimal2(raw);
//     const problem = cutEditError(cutRows, index, value, form.totalMtr);
//     setCutError(problem);
//     if (problem) return cutRows[index]?.value ?? "";
//     setCutRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, value } : row)));
//     return value;
//   };

//   /* Barcode numbers are RESERVED FROM THE SERVER, not counted in the browser.

//      This used to read a running number out of sequenceRef, which starts from
//      whatever the Barcode Setting says and advances locally. Two operators
//      generating at the same time therefore both started from the same place
//      and printed overlapping numbers - and once two garments carry the same
//      label there is no way to tell them apart again.

//      The reservation happens here, when the row is created, so the number the
//      operator sees in the grid is the number that will be saved and the number
//      on the label they may print immediately. */
//   const submit = async (printAfterSubmit = false) => {
//     /* every required field that is wrong is outlined at once, whichever check
//        below stops the Submit first - they are enforced before the price rule */
//     const requiredErrors = requiredFieldErrors(form);
//     setFieldErrors(requiredErrors);
//     /* Old Barcode is OPTIONAL - a blank one generates a label with no link
//        back to a previous barcode, which is the normal case for goods that
//        arrive unlabelled.

//        It is still checked when one IS entered: a code that never resolved
//        would otherwise save a label pointing at a record that does not exist.
//        So the rule is "if you typed something, it has to be real", not "you
//        have to type something". */
//     const enteredOldBarcode = form.oldBarcode?.trim() || "";
//     if (enteredOldBarcode && resolvedRef.current !== enteredOldBarcode) {
//       setReserveError("Barcode not found. Please enter or scan a valid barcode.");
//       return;
//     }
//     /* Only while the Bill Sl No. box is on screen (SHOW_BILL_SL_NO): a
//        hidden field cannot be corrected, so it is not checked here - it holds
//        the form's own value (1, or the one carried from the previous entry),
//        and the save route still refuses a row that reaches it without one. */
//     if (SHOW_BILL_SL_NO) {
//       /* the field only ever holds digits, so "not a number" cannot get here -
//          what is left to check is that it is present and not zero */
//       const serialEntered = String(form.serialNo ?? "").trim();
//       if (!serialEntered) {
//         setReserveError("Bill Sl No. is required - it is the line of the supplier's bill these goods came in on, and the third part of their barcode.");
//         return;
//       }
//       if (Number(serialEntered) < 1) {
//         setReserveError("Bill Sl No. must be 1 or more.");
//         return;
//       }
//     }
//     /* THE ROW'S OWN ITEM CODE, worked out ONCE - here to check it and below
//        to build the row with it, so the thing validated and the thing saved
//        cannot be two different values.

//        A code picked or typed stands as it is; failing that the item's name is
//        slugified into one. That second half is not new - it is the rule the
//        generated row has always used, and it is what lets an item carrying a
//        name but no code of its own (most of the seeded Item master) be
//        labelled at all.

//        This used to test form.itemName. That is the item's NAME, not its
//        code, and it is EMPTY for an item entered through Inventory -> Item
//        with a code but no name. Picking such an item filled the Item Code box
//        with, say, "10-PLNBTM", left itemName blank, and Submit then answered
//        "Please select an Item Code." about an item that was plainly selected.
//        The grid and the save route never had this disagreement: both already
//        read `itemCode || itemName` (validRows, and the API's own row checks).
//        Only this one gate looked at the name alone. */
//     const rowItemCode = String(form.itemCode || "").trim()
//       || String(form.itemName || "").trim().replace(/\s+/g, "-").toUpperCase();
//     if (!rowItemCode) {
//       setReserveError("Please select an Item Code.");
//       formRootRef.current?.querySelector('input[placeholder="Search Item Code…"]')?.focus();
//       return;
//     }
//     /* P-M-F is required - for Submit and Submit & Print Label alike, before
//        anything is added or saved. No value is assumed for it. */
//     if (!pmfOf(form)) {
//       setReserveError(PMF_REQUIRED_MESSAGE);
//       formRootRef.current?.querySelector('[data-field="p_m_f"]')?.focus();
//       return;
//     }
//     /* Checked HERE, before any barcode number is reserved: a zero-price line
//        used to be generated, reserved and appended to the grid, and was only
//        refused when the whole GRC was submitted - by which time it had spent
//        real numbers from the sequence. Same rule as the grid and the API
//        (lib/purchasePrice.js). */
//     /* THE REQUIRED FIELDS (requiredFieldErrors) - already outlined in red at
//        the top of submit(); here the Submit stops, says which fields, and puts
//        the cursor in the first of them. Nothing is added, saved or printed. */
//     if (Object.keys(requiredErrors).length) {
//       const first = Object.keys(requiredErrors)[0];
//       /* one problem: its own message (it may be the price rule's, "must be
//          more than 0"); several: the fields, by name */
//       const keys = Object.keys(requiredErrors);
//       setReserveError(keys.length === 1
//         ? requiredErrors[first].replace(/\.?$/, ".")
//         : "Please fill the required fields: " + keys.map((key) => REQUIRED_LABELS[key] || key).join(", ") + ".");
//       formRootRef.current?.querySelector(`[data-field="${first}"]`)?.focus();
//       return;
//     }
//     const priceProblem = purchasePriceError(form.purchaseRate);
//     if (priceProblem) {
//       setReserveError(priceProblem);
//       return;
//     }
//     /* MTR without Unique is one barcode for the whole length, so with no cut
//        typed it takes Total MTR - as it did when Total MTR was copied into
//        Cut 1. Only the plan reads it this way; no cut box is written. */
//     const planCutRows = form.isMtr && !form.uniqueBarcode && sumCutRows(cutRows) <= 0 && Number(form.totalMtr || 0) > 0
//       ? [{ id: 1, value: String(form.totalMtr) }]
//       : cutRows;
//     /* No cut is ever filled in for the operator, so an MTR entry with none
//        typed would make no barcode (Unique) or one of the wrong length. */
//     if (form.isMtr) {
//       const cutsTotal = sumCutRows(planCutRows);
//       const availableMtr = round2(Number(form.totalMtr || 0));
//       if (cutsTotal <= 0) {
//         setReserveError("Enter at least one cut length in CUTS (MTR).");
//         return;
//       }
//       if (availableMtr > 0 && cutsTotal > availableMtr) {
//         setReserveError(`Total cuts (${cutsTotal.toFixed(2)} MTR) exceed the available ${availableMtr.toFixed(2)} MTR. Reduce a cut or correct Total MTR.`);
//         return;
//       }
//     }
//     if (reserving) return;                       // guards the double-click

//     const generatedRows = [];
//     const baseSerial = String(Number(form.serialNo) >= 1 ? form.serialNo : 1).trim();
//     const finalPriceValue = Number(form.finalPrice || 0);
//     const purchaseRateValue = Number(form.purchaseRate || 0);
//     const barcodePlan = buildBarcodePlan({
//       uom: form.isMtr ? "MTR" : "PC",
//       uniqueBarcode: Boolean(form.uniqueBarcode),
//       qtyOrCuts: form.isMtr ? (cutRows.length || Number(form.noOfCuts || 1)) : Number(form.qty || 1),
//       totalMtr: Number(form.totalMtr || 0),
//       cutRows: planCutRows,
//     });

//     /* No number is reserved any more - the save route gives every barcode its
//        value - so the plan rule that reservation used to enforce is checked
//        here: a unique piece quantity must be whole (lib/barcodeEngine.js
//        planBarcodes). */
//     if (!form.isMtr && form.uniqueBarcode && !Number.isInteger(Number(form.qty || 1))) {
//       setReserveError("A unique piece quantity must be a whole number.");
//       return;
//     }
//     setReserveError("");

//     barcodePlan.forEach((planItem, index) => {
//       generatedRows.push(calculatePrices({
//         ...emptyRow(`${Date.now()}-${index}`),
//         /* carried through to the saved label (the save route already persists
//            oldBarcode), so the new barcode stays traceable to the old one.
//            Empty when none was entered - stored as '' to match the schema
//            default, never faked or copied from another barcode. */
//         oldBarcode: enteredOldBarcode,
//         /* the very value the check above passed on */
//         itemCode: rowItemCode,
//         itemName: form.itemName,
//         goodsType: form.goodsType,
//         sm: form.sm,
//         p_m_f: form.p_m_f,
//         hsn: form.hsn,
//         hsn2: form.hsn2,
//         gst: form.gst,
//         uom: form.isMtr ? "MTR" : "PC",
//         qty: String(planItem.qty || 0),
//         /* the cuts entered - a box left empty is not a cut and makes no barcode */
//         noOfCuts: form.isMtr ? String(planCutRows.filter((cut) => Number(cut.value || 0) > 0).length) : "",
//         totalMtr: form.isMtr ? String(form.totalMtr || 0) : "",
//         purchaseRate: String(purchaseRateValue),
//         /* Encoded from the SAME value on the line above, so the two can never
//            disagree. Kept as a separate key - purchaseRate stays the real
//            number, and the server copies both across (buildDocs is a
//            whitelist). '' when no Purchase Rate Code Master is configured. */
//         encodedPurchaseRate: encodeRate(String(purchaseRateValue), rateCodeMapping),
//         discountType: form.discountType,
//         discount: String(form.discount || 0),
//         finalPrice: String(finalPriceValue),
//         retailPrice: String(form.rspPrice || 0),
//         uniqueBarcode: Boolean(form.uniqueBarcode) ? "Yes" : "No",
//         /* No barcode value here. The save route gives every new barcode its
//            value - SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SERIAL_NO, the Bill Sl
//            No. being this row's own and SERIAL_NO the per-Bill-Sl-No running number
//            (lib/barcodeValue.js) - and the grid shows the value it will get by
//            the same rule. Built here too, the two could
//            differ, and a label printed from this copy would not scan as the
//            stored barcode. (grcHeader is not in scope here either.) */
//         barcodeNo: "",
//         /* what the operator typed in row 2, falling back to the old behaviour
//            (itemName) so a blank field still saves what it always did - and
//            then to the item code, which only ever comes up for an item that
//            has no name to fall back on. That case could not arise before: such
//            an item was refused by the Item Code check above, so this reaches
//            no label that used to print a description. It is the same
//            code-then-name order the grid and the label sheet already use. */
//         supplierDescription: form.supplierDescription?.trim() || form.itemName?.trim() || rowItemCode,
//         printDescription: form.printDescription,
//         mode: Boolean(form.uniqueBarcode) ? "unique" : "batch",
//         groupId: planItem.groupId || null,
//         groupSize: planItem.groupSize || 1,
//         billSlNo: String(baseSerial),
//         serialNo: nextSerialNo ? String(nextSerialNo) : "",  // Operator-overridable starting Serial No.
//         rsp: String(form.rspPrice || 0),
//         wsp: String(form.wspPrice || 0),
//         dp: String(form.dpPrice || 0),
//         offerPrice: form.offerApplicable ? String(form.rspOfferPrice || form.rspPrice || 0) : '',
//         wspPrice: form.offerApplicable ? String(form.wspOfferPrice || form.wspPrice || 0) : '',
//         dpPrice: form.offerApplicable ? String(form.dpOfferPrice || form.dpPrice || 0) : '',
//         rspOfferPct: form.offerApplicable ? form.rspOfferPct : '',
//         wspOfferPct: form.offerApplicable ? form.wspOfferPct : '',
//         dpOfferPct: form.offerApplicable ? form.dpOfferPct : '',
//         markupRSP: form.markupRSP,
//         markupWSP: form.markupWSP,
//         markupDP: form.markupDP,
//       }));
//     });

//     if (printAfterSubmit && onSubmitAndPrint) await onSubmitAndPrint(generatedRows);
//     else onSubmit(generatedRows);

//     /* The Bill Sl No. is not bumped after an Add. It is the supplier's line
//        number, not a counter of ours: several items can sit on one bill line,
//        and the operator moves it on when the bill does. */
//     const nextSerial = baseSerial;
//     /* the next row is a different physical piece, so its Old Barcode starts
//        empty - createBlankForm already clears it, this just clears the
//        matching lookup state so the old "loaded" note does not linger */
//     resolvedRef.current = "";
//     inFlightRef.current = "";
//     setLookup({ status: "idle", message: "" });
//     setForm((current) => createBlankForm({
//       itemId: current.itemId,
//       itemName: current.itemName,
//       itemCode: current.itemCode,
//       hsnId: current.hsnId,
//       hsn: current.hsn,
//       hsn2Id: current.hsn2Id,
//       hsn2: current.hsn2,
//       gst: current.gst,
//       goodsType: current.goodsType,
//       sm: current.sm,
//       p_m_f: current.p_m_f,
//       printDescription: current.printDescription,
//       /* carried forward alongside printDescription - consecutive pieces off
//          the same GRC line share the vendor's wording */
//       supplierDescription: current.supplierDescription,
//       uniqueBarcode: current.uniqueBarcode,
//       isMtr: current.isMtr,
//       /* MTR stays ticked with one empty cut row (setCutRows below), so No. of
//          Cuts says 1 - left blank, the next MTR entry was refused for it */
//       noOfCuts: current.isMtr ? "1" : "",
//       discountType: current.discountType,
//       discount: current.discount,
//       markupRSP: current.markupRSP,
//       markupWSP: current.markupWSP,
//       markupDP: current.markupDP,
//       offerApplicable: current.offerApplicable,
//       /* the item stays picked, so the offer % it gave stays with it */
//       ...Object.fromEntries(OFFER_PCT_KEYS
//         .filter((key) => current._autoOffer?.[key] != null)
//         .map((key) => [key, fixed2(current._autoOffer[key])])),
//       _autoOffer: current._autoOffer || null,
//       serialNo: nextSerial,
//     }));
//     setCutRows([{ id: 1, value: "" }]);
//     setCutError("");
//     onClose();
//   };

//   return (
//     <div ref={formRootRef} className="mt-4 w-full rounded-[8px] border border-slate-200 bg-white shadow-sm">
//       <div className="px-5 py-4">
//           {/* ROW 1: Old Barcode | Item Code | HSN | GST% | SM | P-M-F.

//               Four tracks for five fields: HSN and GST% share the third cell.
//               GST% is normally not typed - it is derived from whichever HSN is
//               picked and the row's value - so sitting them side by side is how
//               the operator checks the pick landed. It stays editable for the
//               transaction that needs a different rate. They are two separate
//               controls; the grouping is only the cell they share.

//               Explicit widths rather than equal quarters: GST% holds two digits
//               and the two add-on inputs share the final track. The two-column
//               md: stage exists because the sidebar is a
//               fixed 280px - at 768px viewport a four-across row leaves each
//               field about 90px, which is unreadable. */}
//           <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_270px_230px]">
//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Old Barcode</label>
//               <input
//                 value={form.oldBarcode}
//                 autoFocus
//                 placeholder="Enter / Scan Old Barcode"
//                 onChange={(event) => {
//                   const next = event.target.value;
//                   setForm((current) => ({ ...current, oldBarcode: next }));
//                   if (lookup.status !== "idle") setLookup({ status: "idle", message: "" });
//                 }}
//                 onKeyDown={(event) => {
//                   if (event.key === "Enter") {
//                     event.preventDefault();
//                     lookupOldBarcode(event.currentTarget.value);
//                   }
//                 }}
//                 onBlur={(event) => lookupOldBarcode(event.currentTarget.value)}
//                 className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
//               />
//               {lookup.status !== "idle" && (
//                 <p className={`text-[11px] ${
//                   lookup.status === "error" ? "text-red-600"
//                     : lookup.status === "found" ? "text-green-700"
//                       : "text-gray-500"
//                 }`}>
//                   {lookup.message}
//                 </p>
//               )}
//             </div>

//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Item Code *</label>
//               <SearchSelect
//                 placeholder="Search Item Code…"
//                 /* the code counts as selected too: an Old Barcode fills the
//                    code, but stored barcodes carry no item id */
//                 value={form.itemId || form.itemCode}
//                 label={itemLabel}
//                 onSearch={searchItems}
//                 options={itemOptions}
//                 loading={itemLoading}
//                 onSelect={(opt) => handleItemSelection(opt)}
//                 onClear={() => handleItemSelection(null)}
//                 editableClass={editableClass}
//               />
//             </div>

//             {/* HSN + GST% - grouped in one cell, still two separate controls */}
//             <div className="grid grid-cols-[minmax(0,1fr)_86px] gap-2">
//               {renderHsnField()}
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">GST% *</label>
//                 {/* decimal2 keeps this to a number the rate can actually be -
//                     a GST rate is a positive percentage, never a minus sign or
//                     a second decimal point */}
//                 <input
//                   value={form.gst}
//                   inputMode="decimal"
//                   title="Filled from the HSN's tax slab - edit to override for this row"
//                   onChange={(event) => updateField("gst", decimal2(event.target.value))}
//                   className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
//                 />
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-2">
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">SM(Number)</label>
//                 <input type="number" step="1" min={0} value={form.sm} onChange={(event) => updateField("sm", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">P-M-F *</label>
//                 <input data-field="p_m_f" value={form.p_m_f} onChange={(event) => updateField("p_m_f", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
//               </div>
//             </div>
//           </div>

//           {/* ROW 2: [Bill Sl No.] | Serial No. | Supplier Description | Print Description.

//               Bill Sl No. is the supplier's bill line number (3rd part of barcode),
//               hidden while SHOW_BILL_SL_NO is off - its value still travels.
//               Serial No. is the auto-incrementing counter per Bill Sl No. (4th part of barcode).
//               Row 2 Serial No. is EDITABLE - the operator can override the auto-suggested value. */}
//           <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 ${SHOW_BILL_SL_NO ? "xl:grid-cols-[90px_90px_minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)]"}`}>
//             {SHOW_BILL_SL_NO && <SerialNoField value={form.serialNo} onChange={updateSerialNo} editableClass={editableClass} />}
//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Serial No. *</label>
//               <div className="relative">
//                 <input
//                   value={nextSerialNo ?? ""}
//                   inputMode="numeric"
//                   aria-label="Serial No."
//                   placeholder="1"
//                   onWheel={(event) => event.currentTarget.blur()}
//                   onChange={(event) => {
//                     const digits = String(event.target.value).replace(/\D/g, "");
//                     setNextSerialNo(digits === "" ? "" : Number(digits));
//                   }}
//                   className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
//                 />
//                 {serialNoLoading && (
//                   <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-600">Loading...</div>
//                 )}
//               </div>
//             </div>

//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Supplier Description</label>
//               <input value={form.supplierDescription} title={form.supplierDescription} onChange={(event) => updateField("supplierDescription", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
//             </div>

//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Print Description</label>
//               <input value={form.printDescription} title={form.printDescription} onChange={(event) => updateField("printDescription", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
//             </div>
//           </div>

//           {/* ROW 3: [Bill Sl No.] | Serial No. | HSN (second, independent) | Unique Barcode | MTR.

//               Bill Sl No. here is a locked read-back of the value entered in row 2
//               — one value, two windows, hidden with it. Serial No. shows the next
//               auto-increment value. */}
//           <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 ${SHOW_BILL_SL_NO ? "xl:grid-cols-[90px_90px_170px_230px_230px]" : "xl:grid-cols-[90px_170px_230px_230px]"}`}>
//             {SHOW_BILL_SL_NO && <SerialNoField value={form.serialNo} readOnlyClass={readOnlyClass} locked />}
//             <div className="space-y-1">
//               <label className="block text-[11px] font-semibold text-gray-700">Serial No. *</label>
//               <div className="relative">
//                 <input
//                   value={nextSerialNo ?? ""}
//                   inputMode="numeric"
//                   aria-label="Serial No."
//                   placeholder="1"
//                   readOnly
//                   tabIndex={-1}
//                   onWheel={(event) => event.currentTarget.blur()}
//                   className={`w-full rounded-md px-2 py-2 text-sm ${readOnlyClass} cursor-not-allowed pr-7`}
//                 />
//                 <svg
//                   viewBox="0 0 24 24"
//                   aria-hidden="true"
//                   className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
//                   fill="none"
//                   stroke="currentColor"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                 >
//                   <rect x="5" y="11" width="14" height="9" rx="2" />
//                   <path d="M8 11V8a4 4 0 0 1 8 0v3" />
//                 </svg>
//               </div>
//             </div>

//             {renderHsn2Field()}

//             <div className="flex items-end gap-0">
//               <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
//                 <input type="checkbox" checked={form.uniqueBarcode} onChange={(event) => updateField("uniqueBarcode", event.target.checked)} className="h-4 w-4 accent-[#0d5ddc]" /> Unique Barcode
//               </label>
//               <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
//                 <input type="checkbox" checked={form.isMtr} onChange={(event) => {
//                   const checked = event.target.checked;
//                   updateField("isMtr", checked);
//                   setCutError("");
//                   if (checked) {
//                     const count = Math.max(1, Number(form.noOfCuts || 1));
//                     updateField("noOfCuts", String(count));
//                     setCutRows(makeMeterCutRows(count, Number(form.totalMtr || 0)));
//                   } else {
//                     setFocusedCutIndex(0);
//                     setCutRows([{ id: 1, value: "" }]);
//                   }
//                 }} className="h-4 w-4 accent-[#0d5ddc]" /> MTR
//               </label>
//               <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
//                 <input type="checkbox" checked={form.offerApplicable} onChange={(event) => updateField("offerApplicable", event.target.checked)} className="h-4 w-4 accent-[#0d5ddc]" /> OFFER APPLICABLE
//               </label>
//             </div>
//           </div>

//           {/* What the two boxes above resolve to, by the same rule the label
//               printer uses (lib/barcodeLabelPrint.js) - so there is one answer
//               to "is this Unique, MTR or Batch" and the operator can see it.
//               MTR and Unique are not exclusive here: MTR + Unique is one barcode
//               per cut, MTR alone one barcode for the whole length, and either
//               way it is metres of cloth - MTR, 2 labels. Unique unticked on a
//               piece item is a BATCH barcode: one barcode for the whole
//               quantity, and Print asks how many labels. */}
//           {(() => {
//             const type = resolveLabelMode({
//               uom: form.isMtr ? "MTR" : "PC",
//               uniqueBarcode: form.uniqueBarcode ? "Yes" : "No",
//               mode: form.uniqueBarcode ? "unique" : "batch",
//             }).mode;
//             return (
//               <div className="mt-2 text-right text-xs text-gray-600">
//                 Barcode type: <span className="font-bold text-gray-800">{type}</span>
//                 {type === LABEL_MODE.METER ? " - 2 labels per barcode"
//                   : type === LABEL_MODE.UNIQUE ? " - 1 label per barcode"
//                     : " - one barcode for the whole quantity; you choose how many labels when printing"}
//               </div>
//             );
//           })()}

//           <div className="mt-5">
//             <div className="mb-4 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Price Calculation</div>

//             {SHOW_SUPPLIER_PRICE_SETUP && <SupplierPriceSetupPanel setup={priceSetup} />}

//             {/* Price Calculation grid */}
//             <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">{form.isMtr ? "No. of Cuts *" : "Quantity *"}</label>
//                 {form.isMtr ? (
//                   <input data-field="noOfCuts" type="number" min={1} value={form.noOfCuts} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => {
//                     const raw = event.target.value;
//                     updateField("noOfCuts", raw);

//                     /* blank or not a count yet (mid-edit): the rows and the cuts
//                        in them stay exactly as they are */
//                     const count = Number(raw);
//                     if (raw === "" || !Number.isFinite(count) || count <= 0) return;

//                     setCutError("");
//                     setCutRows((current) => resizeCutRows(current, count));
//                   }} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("noOfCuts")}`} />
//                 ) : (
//                   <input data-field="qty" type="text" inputMode="decimal" value={form.qty} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("qty", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("qty")}`} />
//                 )}
//                 {fieldError(form.isMtr ? "noOfCuts" : "qty")}
//               </div>

//               {form.isMtr && (
//                 <div className="space-y-1">
//                   <label className="block text-[11px] font-semibold text-gray-700">Total MTR *</label>
//                   {/* the available length the CUTS (MTR) balance is worked from -
//                       it no longer writes itself into Cut 1, nor clears the cuts */}
//                   <input type="number" min={0} step="0.01" value={form.totalMtr} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => {
//                     updateField("totalMtr", event.target.value);
//                     setCutError("");
//                   }} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
//                 </div>
//               )}

//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Purchase Rate *</label>
//                 <input data-field="purchaseRate" type="text" inputMode="decimal" value={form.purchaseRate} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("purchaseRate", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("purchaseRate")}`} />
//                 {fieldError("purchaseRate")}
//                 {/* Read-only echo of the SAME value through the Purchase Rate
//                     Code Master. The input above keeps the real number - this
//                     is only what a label would print. Hidden entirely when no
//                     mapping is configured, rather than showing a half-encoded
//                     string. */}
//                 {encodedPurchaseRate && (
//                   <div className="mt-1 text-[10px] text-gray-500">
//                     Encoded: <span className="font-mono font-semibold text-gray-700">{encodedPurchaseRate}</span>
//                   </div>
//                 )}
//               </div>

//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Discount Type</label>
//                 <select data-field="discountType" value={form.discountType} onChange={(event) => updateField("discountType", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("discountType")}`}>
//                   {/* a type that is neither (an old record) shows as blank, and
//                       Submit asks for one rather than guessing */}
//                   {!DISCOUNT_TYPES.includes(form.discountType) && <option value="">Select</option>}
//                   <option value="Percentage">Percentage</option>
//                   <option value="Flat">Flat</option>
//                 </select>
//                 {fieldError("discountType")}
//               </div>

//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Discount *</label>
//                 <input data-field="discount" type="text" inputMode="decimal" value={form.discount} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("discount", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("discount")}`} />
//                 {fieldError("discount")}
//               </div>

//               {!form.isMtr && (
//                 <div className="space-y-1">
//                   <label className="block text-[11px] font-semibold text-gray-700">Final Price *</label>
//                   {/* worked out, never typed - so not a Tab stop: Tab goes from
//                       Discount straight on to the next box that takes input */}
//                   <input data-field="finalPrice" value={form.finalPrice} readOnly tabIndex={-1} className={`w-full rounded-md px-2 py-2 text-sm font-semibold ${readOnlyClass}${invalid("finalPrice")}`} />
//                   {fieldError("finalPrice")}
//                 </div>
//               )}
//             </div>

//             <div className="mt-5 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Mark up on Net Price</div>
//             <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Markup RSP % *</label>
//                 <input data-field="markupRSP" type="text" inputMode="decimal" value={form.markupRSP} onChange={(event) => updateMarkupValue("markupRSP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupRSP")}`} />
//                 {fieldError("markupRSP")}
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">RSP Price *</label>
//                 <input data-field="rspPrice" type="text" inputMode="decimal" value={form.rspPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("rspPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("rspPrice")}`} />
//                 {fieldError("rspPrice")}
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Markup WSP % *</label>
//                 <input data-field="markupWSP" type="text" inputMode="decimal" value={form.markupWSP} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("markupWSP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupWSP")}`} />
//                 {fieldError("markupWSP")}
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">WSP Price *</label>
//                 <input data-field="wspPrice" type="text" inputMode="decimal" value={form.wspPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("wspPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("wspPrice")}`} />
//                 {fieldError("wspPrice")}
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">Markup E-COMM % *</label>
//                 <input data-field="markupDP" type="text" inputMode="decimal" value={form.markupDP} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("markupDP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupDP")}`} />
//                 {fieldError("markupDP")}
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">E-COMM Price *</label>
//                 <input data-field="dpPrice" type="text" inputMode="decimal" value={form.dpPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("dpPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("dpPrice")}`} />
//                 {fieldError("dpPrice")}
//               </div>
//             </div>

//             <div className="mt-5 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Offer Price /Mark Down</div>
//             {offerNote && <div className="mt-2 text-center text-[11px] text-amber-700" data-testid="offer-note">{offerNote}</div>}
//             <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">RSP Offer %</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.rspOfferPct} onChange={(event) => updateOfferValue("rspOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">RSP Offer Price</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.rspOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("rspOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">WSP Offer %</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.wspOfferPct} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("wspOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">WSP Offer Price</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.wspOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("wspOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">E-COMM Offer %</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.dpOfferPct} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("dpOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//               <div className="space-y-1">
//                 <label className="block text-[11px] font-semibold text-gray-700">E-COMM Offer Price</label>
//                 <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.dpOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("dpOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
//               </div>
//             </div>

//             {form.isMtr && (() => {
//               /* worked out on every render from the boxes and Total MTR - never
//                  stored, and never written into a cut */
//               const cutsTotal = sumCutRows(cutRows);
//               const availableMtr = round2(Number(form.totalMtr || 0));
//               const hasAvailable = availableMtr > 0;
//               const balanceMtr = round2(availableMtr - cutsTotal);
//               const overAvailable = hasAvailable && balanceMtr < 0;
//               /* side by side only from lg: with the 280px sidebar open, a
//                  tablet-width content area cannot hold both */
//               const cutGrid = "grid grid-cols-[40px_minmax(0,1fr)_32px] items-center gap-2 sm:grid-cols-[40px_minmax(0,220px)_32px]";
//               return (
//                 <div className="mt-5 rounded-md border border-[#dfe4eb] bg-[#f8fafc] p-3">
//                   <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
//                     <div className="w-full lg:w-auto">
//                       <div className={`${cutGrid} px-0.5`}>
//                         <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">SL</div>
//                         <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Cut (MTR)</div>
//                         <div />
//                       </div>

//                       {cutRows.map((cut, index) => (
//                         <div key={cut.id ?? index} className={`mt-1 rounded-md p-0.5 ${cutGrid} ${index === focusedCutIndex ? "bg-orange-50" : ""}`}>
//                           <div className={`flex h-8 items-center justify-center rounded-md border border-gray-300 text-xs font-medium text-gray-700 ${index === focusedCutIndex ? "bg-orange-100" : "bg-[#f3f5f9]"}`}>{index + 1}</div>
//                           <input
//                             type="text"
//                             inputMode="decimal"
//                             autoComplete="off"
//                             aria-label={`Cut ${index + 1} (MTR)`}
//                             value={cut.value}
//                             ref={(el) => { cutsInputRefs.current[index] = el; }}
//                             onFocus={() => setFocusedCutIndex(index)}
//                             onChange={(event) => {
//                               /* a refused or cleaned-up keystroke: put the kept
//                                  text back here, caret where it was, so React
//                                  finds nothing to rewrite and the caret does not
//                                  jump to the end */
//                               const input = event.target;
//                               const typed = input.value;
//                               const caret = input.selectionStart ?? typed.length;
//                               const kept = updateCutValue(index, typed);
//                               if (kept !== typed) {
//                                 const at = Math.max(0, Math.min(kept.length, caret - (typed.length - kept.length)));
//                                 input.value = kept;
//                                 input.setSelectionRange(at, at);
//                               }
//                             }}
//                             onKeyDown={(e) => {
//                               if (e.key === "Tab" && !e.shiftKey && index < cutRows.length - 1) {
//                                 e.preventDefault();
//                                 cutsInputRefs.current[index + 1]?.focus();
//                               } else if (e.key === "Tab" && e.shiftKey && index > 0) {
//                                 e.preventDefault();
//                                 cutsInputRefs.current[index - 1]?.focus();
//                               }
//                             }}
//                             className={`h-8 w-full rounded-md px-2 text-sm tabular-nums ${index === focusedCutIndex ? "border border-orange-300 bg-orange-50" : editableClass} focus:border-[#0d5ddc] focus:outline-none focus:ring-2 focus:ring-[#0d5ddc]/20`}
//                           />
//                           <div className="flex h-8 items-center justify-center">
//                             {index === cutRows.length - 1 ? (
//                               <button type="button" tabIndex={-1} onClick={addCutRow} aria-label="Add cut" title="Add cut" className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2fbf6c] text-base font-bold text-white">+</button>
//                             ) : (
//                               <button type="button" tabIndex={-1} onClick={() => removeCutRow(index)} aria-label={`Remove cut ${index + 1}`} title="Remove cut" className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e34a3a] text-lg font-bold text-white">−</button>
//                             )}
//                           </div>
//                         </div>
//                       ))}
//                     </div>

//                     <div className="w-full lg:w-64">
//                       <dl className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm" aria-live="polite">
//                         <div className="flex items-center justify-between gap-3 px-3 py-1.5">
//                           <dt className="text-gray-600">Total Cuts (MTR)</dt>
//                           <dd className="font-semibold tabular-nums text-gray-800">{cutsTotal.toFixed(2)}</dd>
//                         </div>
//                         <div className="flex items-center justify-between gap-3 px-3 py-1.5">
//                           <dt className="text-gray-600">Available (MTR)</dt>
//                           <dd className="font-semibold tabular-nums text-gray-800">{hasAvailable ? availableMtr.toFixed(2) : "-"}</dd>
//                         </div>
//                         <div className="flex items-center justify-between gap-3 px-3 py-1.5">
//                           <dt className="text-gray-600">Balance (MTR)</dt>
//                           <dd className={`font-semibold tabular-nums ${overAvailable ? "text-red-600" : hasAvailable && balanceMtr === 0 ? "text-green-700" : "text-gray-800"}`}>{hasAvailable ? balanceMtr.toFixed(2) : "-"}</dd>
//                         </div>
//                       </dl>
//                       {!hasAvailable && <p className="mt-1 text-[11px] text-gray-500">Enter Total MTR to see the balance.</p>}
//                     </div>
//                   </div>

//                   {(cutError || overAvailable) && (
//                     <div role="alert" className="mt-2 rounded border border-[#f5c2c7] bg-[#f8d7da] px-3 py-1.5 text-[12px] text-[#842029]">
//                       {cutError || `Total cuts (${cutsTotal.toFixed(2)} MTR) exceed the available ${availableMtr.toFixed(2)} MTR. Reduce a cut or correct Total MTR.`}
//                     </div>
//                   )}
//                 </div>
//               );
//             })()}
//           </div>

//           <div className="mt-6 flex items-center justify-end gap-2">
//             {reserveError && <div className="mb-2 w-full rounded border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[13px] text-[#842029]">{reserveError}</div>}
//             <button type="button" disabled={reserving} onClick={() => submit(false)} className="rounded-md bg-[#0d5ddc] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(13,93,220,0.35)] transition hover:bg-[#0b4bb6] disabled:opacity-60">{reserving ? "Reserving barcodes..." : "Submit"}</button>
//             <button type="button" disabled={reserving} onClick={() => submit(true)} className="rounded-md bg-[#198754] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(25,135,84,0.3)] transition hover:bg-[#146c43] disabled:opacity-60">Submit &amp; Print Label</button>
//           </div>
//       </div>
//     </div>
//   );
// }

// /* ==========================================================================
//    Labels.

//    Which barcode type a row is, what goes ON its label and how MANY labels it
//    gets are all decided in lib/barcodeLabelPrint.js, not here - the same
//    module GET /api/grc/[id] uses to stamp each row's barcodeType/labelCount -
//    so this screen's preview, its print run and the GRC Barcode Print page
//    cannot drift apart:

//      resolveLabelMode     UNIQUE / MTR / BATCH, from the uomType / batchType
//                           the save route stores (or, for a row not saved yet,
//                           what it WILL store)
//      getLabelPrintCount   UNIQUE 1 / MTR 2 / BATCH as the operator enters
//      toLabelData          the whitelisted label content, read by
//                           BarcodeLabelSheet

//    Two helpers that lived here went with that. toLabelRow copied the GRC
//    header's supplier name and GRC number, and the bill serial, onto every row
//    so the sticker could print "supplier · GRC · Sl n"; a label no longer
//    receives any of it. defaultCopies seeded a count the operator could then
//    type over - a metre barcode could go out as five stickers, a unique one
//    as fifty, and a batch defaulted to its entire quantity. Counts now follow
//    the rule, and a batch asks.
//    ========================================================================== */

// function PrintLabelPicker({ rows, open, onClose }) {
//   const scope = useScope();
//   const [selected, setSelected] = useState([]);
//   /* The operator's answer for each BATCH barcode, keyed by barcode number.
//      UNIQUE and MTR barcodes never get an entry: their count is the rule
//      (lib/barcodeLabelPrint.js), not something to type. */
//   const [batchCounts, setBatchCounts] = useState({});
//   /* the open "Print Batch Labels" dialog - { key, continueToPrint } */
//   const [batchPrompt, setBatchPrompt] = useState(null);

//   /* label geometry - the sticker stock this tenant actually buys */
//   const [formats, setFormats] = useState([]);
//   const [formatName, setFormatName] = useState('');
//   const [paper, setPaper] = useState('a4');

//   /* the print run: mounted -> measured -> dialog. See runPrint below. */
//   const [printing, setPrinting] = useState(false);
//   const [printError, setPrintError] = useState('');
//   const printRootRef = useRef(null);
//   /* how many labels this particular run was asked for - frozen at the click */
//   const wantedRef = useRef(0);
//   /* Taken synchronously the moment a run is asked for and released when it
//      ends, so a double click, a double confirm in the batch dialog or a
//      re-render cannot start a second run - and a second print dialog - for
//      one action. `printing` alone cannot do it: state set in a click is not
//      visible to a second click that lands before the re-render. */
//   const printLockRef = useRef(false);

//   /* Seeded when the picker OPENS, and not again while it is open.

//      `rows` is a fresh array on every parent render, and saving calls
//      router.refresh() - so keying this on rows meant a refresh landing behind
//      the open picker silently threw away whatever the operator had ticked and
//      typed, and put the defaults back.

//      Every barcode starts ticked. No batch count is assumed: a batch barcode
//      is asked about when it is printed, or when its Set quantity is pressed. */
//   const wasOpen = useRef(false);
//   useEffect(() => {
//     if (!open) { wasOpen.current = false; return; }
//     if (wasOpen.current) return;
//     wasOpen.current = true;

//     setSelected(rows.map(labelKey).filter(Boolean));
//     setBatchCounts({});
//     setBatchPrompt(null);
//   }, [open, rows]);

//   /* Label formats, loaded the same way the Inventory print screen loads them
//      (components/BarcodePrintLabel.jsx): the whole seeded catalog is offered,
//      and the format ticked as Default in Settings -> Barcode Label Settings is
//      preselected. This screen previously loaded NO geometry at all, so a label
//      had no physical size to be printed at. */
//   useEffect(() => {
//     if (!open) return;
//     let cancelled = false;

//     (async () => {
//       const qs = new URLSearchParams({
//         business: scope.business || '',
//         location: scope.location || '',
//         finYear: scope.finYear || '',
//       });
//       const [chosen, catalog] = await Promise.all([
//         fetch('/api/barcode-label-setting?' + qs).then((r) => r.json()).catch(() => ({})),
//         fetch('/api/catalog?name=barcodeLabels').then((r) => r.json()).catch(() => ({})),
//       ]);
//       if (cancelled) return;

//       const list = catalog.rows || [];
//       setFormats(list);

//       const ticked = ((chosen.doc && chosen.doc.rows) || []).filter((r) => r.choice);
//       const preferred = ticked.find((t) => t.isDefault)?.name || ticked[0]?.name;
//       setFormatName(list.some((c) => c.name === preferred) ? preferred : (list[0]?.name || ''));
//     })();

//     return () => { cancelled = true; };
//   }, [open, scope.business, scope.location, scope.finYear]);

//   const format = useMemo(
//     () => formats.find((f) => f.name === formatName) || null,
//     [formats, formatName]
//   );

//   /* every row that has a barcode to print, and the ones currently ticked */
//   const printable = useMemo(() => rows.filter((row) => labelKey(row)), [rows]);
//   const chosen = useMemo(
//     () => printable.filter((row) => selected.includes(labelKey(row))),
//     [printable, selected]
//   );

//   /* The ticked barcodes, each carrying its sticker count as `copies` - from
//      getLabelPrintCount, through withLabelCounts. The preview AND the print
//      surface are both built from this one list, so the screen cannot show a
//      different number of labels from the number that is printed. A batch with
//      no count yet carries 0 and is simply not on the sheet. */
//   const selectedRows = useMemo(() => withLabelCounts(chosen, batchCounts), [chosen, batchCounts]);

//   /* the count shown against every barcode in the list, ticked or not */
//   const countByKey = useMemo(
//     () => Object.fromEntries(withLabelCounts(printable, batchCounts).map((row) => [labelKey(row), row.copies])),
//     [printable, batchCounts]
//   );

//   /* what the printer is being asked for, counted from the same list the sheet
//      is built from - this is the number the readiness check has to find drawn */
//   const expectedLabels = useMemo(
//     () => selectedRows.reduce((total, row) => total + (row.copies || 0), 0),
//     [selectedRows]
//   );

//   /* ticked BATCH barcodes that have not been given a count yet */
//   const pendingBatch = useMemo(() => pendingBatchRows(chosen, batchCounts), [chosen, batchCounts]);

//   /* Paper. A4 is the default because that is what a desktop printer and
//      "Microsoft Print to PDF" are loaded with; the sticker-stock option sets
//      the page to one physical sheet from the catalog, which is what a label
//      printer feeds.

//      On sticker stock the sheet IS the page, so a gutter between labels would
//      push the last column off the edge of the paper - hence gap 0 there, and
//      a 1mm cut line on a sheet of A4 that somebody has to guillotine. */
//   /* ONE call, so this page and the Barcode Generation picker cannot arrive
//      at two different sheets from one format. labelRun fits the labels inside
//      the page's PRINTABLE width - the sheet less the unprintable edge the
//      printer's grippers take - which is what stops the leading sticker's
//      barcode number being clipped on stock. */
//   const run = labelRun(format, paper);
//   const { gap, pageRule, stockSize } = run;

//   /* ---------------------------------------------------------------- print --
//      window.print() photographs the DOM as it stands at the instant it is
//      called. It used to be called straight out of the click handler, before
//      React had committed anything and before JsBarcode had drawn a single bar,
//      so what went to the printer was whatever happened to be on screen.

//      The run is therefore staged. `printing` mounts the sheet; the effect
//      below waits for the browser to have actually finished with it, checks
//      that every barcode it was asked for is really there, and only then opens
//      the dialog. No timers: each await is a real signal from the browser. */
//   useEffect(() => {
//     if (!printing) return undefined;
//     let cancelled = false;

//     /* The class is what arms the print rules in globals.css. Gating them on it
//        rather than on the mere existence of the sheet means every other print
//        screen in the application - and this one at any other moment - keeps
//        printing exactly the way it does today. Removed in the cleanup below,
//        so there is no state to unwind by hand. */
//     document.body.classList.add('printing-labels');

//     const done = () => setPrinting(false);
//     window.addEventListener('afterprint', done);

//     (async () => {
//       try {
//         /* Fonts first. The code, the price and the description are text; print
//            before the face has loaded and they are measured with fallback
//            metrics and re-flow inside a fixed-size sticker. */
//         if (document.fonts && document.fonts.ready) {
//           try { await document.fonts.ready; } catch { /* unsupported - the frames below still gate on layout */ }
//         }
//         if (cancelled) return;

//         /* Two frames. The first lets React's commit reach the screen, the
//            second lets the browser lay out the SVG children JsBarcode appended
//            synchronously during that commit. */
//         await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
//         if (cancelled) return;

//         const root = printRootRef.current;
//         const drawn = root ? Array.from(root.querySelectorAll('svg[data-barcode]')) : [];
//         const blank = drawn.filter((svg) => {
//           const box = svg.getBoundingClientRect();
//           return !svg.firstChild || box.width < 1 || box.height < 1;
//         });

//         const wanted = wantedRef.current;
//         if (!root || drawn.length !== wanted || blank.length) {
//           /* Refusing to open the dialog is the point. A run that is short a
//              label, or carries an empty box where a barcode should be, produces
//              stickers that cannot be scanned and goods that cannot be found -
//              and the operator would have no way of knowing until the till. */
//           setPrintError(
//             'Printing stopped: ' + drawn.length + ' of ' + wanted +
//             ' barcodes were drawn' + (blank.length ? ', ' + blank.length + ' of them empty' : '') +
//             '. Nothing was sent to the printer.'
//           );
//           setPrinting(false);
//           return;
//         }

//         setPrintError('');
//         window.print();

//         /* afterprint is the signal that the dialog is finished with, and in
//            every current browser print() has already blocked until then. The
//            frame below is the belt to that braces: it hands control back once
//            more so a browser whose print() returns EARLY still has its
//            afterprint delivered first, and the sheet is never pulled out from
//            under a dialog that is still reading it. */
//         await new Promise((resolve) => requestAnimationFrame(resolve));
//         if (!cancelled) setPrinting(false);
//       } catch (error) {
//         /* Without this the run could end with `printing` stuck true - which
//            leaves printing-labels welded to <body>, and every LATER print
//            anywhere in the application comes out blank. */
//         console.error('Barcode label print failed', error);
//         setPrintError('Printing stopped: the label sheet could not be prepared. Nothing was sent to the printer.');
//         setPrinting(false);
//       }
//     })();

//     return () => {
//       cancelled = true;
//       window.removeEventListener('afterprint', done);
//       document.body.classList.remove('printing-labels');
//     };
//     /* expectedLabels is deliberately NOT a dependency. It is read from a ref
//        taken when Print was pressed, because the picker stays interactive
//        behind the dialog: nudging a copy count mid-run would otherwise re-run
//        this effect and open a SECOND print dialog for the same click. */
//   }, [printing]);

//   /* Closing the picker abandons the run. The component is not unmounted when
//      it closes - it just renders null - so a run left in flight would keep the
//      body class on and re-run the check against a sheet that is no longer
//      there, reporting a failure nobody caused. */
//   useEffect(() => {
//     if (!open) {
//       setPrinting(false);
//       setPrintError('');
//     }
//   }, [open]);

//   /* the run is over - printed, refused or abandoned - so the next click may
//      start one */
//   useEffect(() => {
//     if (!printing) printLockRef.current = false;
//   }, [printing]);

//   /* Starts ONE print run, sized from the counts passed in rather than from
//      state: the batch dialog's confirm records a count AND starts the run in
//      the same click, and a count set in that click cannot be read back from
//      state until the next render. The sheet is rendered from state, which by
//      then holds the same counts - so the readiness check still compares the
//      number asked for with the number drawn. */
//   function startPrint(counts) {
//     if (printLockRef.current) return;
//     const wanted = withLabelCounts(chosen, counts).reduce((total, row) => total + (row.copies || 0), 0);
//     if (!wanted) {
//       setPrintError('Nothing is selected to print.');
//       return;
//     }
//     printLockRef.current = true;
//     setPrintError('');
//     wantedRef.current = wanted;
//     setPrinting(true);
//   }

//   /* Print. A ticked BATCH barcode with no count is asked about first - one
//      "Print Batch Labels" dialog per batch barcode, in list order - and the
//      last answer starts the run. UNIQUE and MTR are never asked about. */
//   function runPrint() {
//     if (printLockRef.current) return;
//     setPrintError('');
//     if (pendingBatch.length) {
//       setBatchPrompt({ key: labelKey(pendingBatch[0]), continueToPrint: true });
//       return;
//     }
//     startPrint(batchCounts);
//   }

//   /* The dialog only ever hands over a count validateBatchLabelCount accepted. */
//   function confirmBatchCount(value) {
//     if (!batchPrompt) return;
//     const next = { ...batchCounts, [batchPrompt.key]: value };
//     setBatchCounts(next);
//     if (!batchPrompt.continueToPrint) { setBatchPrompt(null); return; }
//     const remaining = pendingBatchRows(chosen, next);
//     if (remaining.length) {
//       setBatchPrompt({ key: labelKey(remaining[0]), continueToPrint: true });
//       return;
//     }
//     setBatchPrompt(null);
//     startPrint(next);
//   }

//   if (!open) return null;

//   const promptRow = batchPrompt ? printable.find((row) => labelKey(row) === batchPrompt.key) || null : null;

//   /* The box is capped to the viewport and scrolls INTERNALLY.

//      It used to be an uncapped panel inside a centred `fixed inset-0` overlay.
//      Once enough barcodes were generated the list and the preview cards grew
//      taller than the screen, and because the panel was centred it overflowed
//      off BOTH the top and the bottom with no scrollbar anywhere to reach it -
//      the Print and Close buttons included. The overlay covers the whole
//      viewport, so the wheel could not scroll the page behind it either, and
//      the screen read as frozen.

//      max-h + flex-col + an overflow-y-auto body fixes all of that: the list
//      scrolls, the header and footer stay put, and nothing is ever pushed out
//      of reach. */
//   return (
//     /* no-print: the picker itself is never paper. An operator who reaches for
//        Ctrl+P instead of the Print button would otherwise send this dialog -
//        checkboxes, copy counts and all - to the printer. */
//     <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
//       <BatchLabelCountDialog
//         open={Boolean(batchPrompt)}
//         barcode={promptRow ? promptRow.barcodeNo || '' : ''}
//         description={promptRow ? (promptRow.printDescription || promptRow.itemName || promptRow.supplierDescription || '') : ''}
//         available={batchAvailableQty(promptRow)}
//         initialValue={batchPrompt ? (batchCounts[batchPrompt.key] ?? '') : ''}
//         onCancel={() => setBatchPrompt(null)}
//         onConfirm={confirmBatchCount}
//       />
//       <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[960px] flex-col rounded-lg bg-white shadow-xl">
//         <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
//           <h3 className="text-lg font-semibold">Print Label Picker</h3>
//           <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-500">×</button>
//         </div>

//         <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
//           <div>
//             {printable.length === 0 && <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">No barcode generated yet.</div>}
//             {printable.map((row, index) => {
//               const key = labelKey(row);
//               const { mode, assumed } = resolveLabelMode(row);
//               const count = countByKey[key] || 0;
//               return (
//                 <div key={key || index} className="mb-3 flex items-center gap-3 rounded border border-gray-200 p-2">
//                   <input type="checkbox" checked={selected.includes(key)} onChange={() => setSelected((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])} />
//                   <div className="min-w-0 flex-1">
//                     <div className="font-medium">{row.itemCode || row.itemName || row.supplierDescription || "Item"}</div>
//                     {/* the unit's own barcodeNo only - the composed value
//                         ("G1319*05183*1*1") is hidden here (user, 2026-09-17) */}
//                     <div className="font-mono text-xs text-gray-600" style={{ textTransform: "none" }}>
//                       {row.barcodeNo}
//                     </div>
//                   </div>
//                   {/* The count is the rule's, not an input: an MTR barcode
//                       is always two stickers and a unique one always one. Only
//                       a batch is the operator's to decide, through the same
//                       dialog Print opens. */}
//                   <div className="shrink-0 text-right text-xs">
//                     <div className="font-semibold text-gray-700">
//                       {mode === LABEL_MODE.METER ? 'Meter' : mode === LABEL_MODE.BATCH ? 'Batch' : 'Unique'}
//                     </div>
//                     {mode === LABEL_MODE.BATCH && isUnprintableBatch(row) ? (
//                       /* No whole quantity recorded, so no count can ever be
//                          valid. Print does not ask about it (pendingBatchRows
//                          leaves it out) - asking would only block every other
//                          label - so it says here why it prints nothing. */
//                       <div className="text-red-700">No quantity recorded - cannot print</div>
//                     ) : mode === LABEL_MODE.BATCH ? (
//                       <>
//                         <div className={count ? 'text-gray-600' : 'text-amber-700'}>
//                           {count ? count + ' label' + (count === 1 ? '' : 's') : 'Quantity not set'}
//                         </div>
//                         <button
//                           type="button"
//                           disabled={printing}
//                           onClick={() => setBatchPrompt({ key, continueToPrint: false })}
//                           className="mt-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
//                         >
//                           {count ? 'Change' : 'Set quantity'}
//                         </button>
//                       </>
//                     ) : (
//                       <div className="text-gray-600">{count} label{count === 1 ? '' : 's'}</div>
//                     )}
//                     {assumed && (
//                       <div className="text-amber-700" title="No Unique / Batch type is recorded for this barcode, so it prints as one label.">
//                         Type not recorded
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           {/* The preview is the SAME component, with the SAME rows and the
//               SAME geometry that the print sheet below is built from, so what
//               is on screen and what comes out of the printer cannot drift
//               apart. It used to be a hand-drawn card whose "barcode" was a
//               striped CSS background - it encoded nothing, and being a
//               background image Chrome would have dropped it from the paper
//               even if the rest had worked. */}
//           <div className="rounded border border-gray-200 bg-gray-50 p-4">
//             <div className="mb-3 flex items-baseline justify-between text-sm font-semibold">
//               <span>Preview</span>
//               <span className="text-[11px] font-normal text-gray-500">
//                 {expectedLabels} label{expectedLabels === 1 ? '' : 's'}
//                 {format?.labelSize ? ' · ' + format.labelSize : ''}
//               </span>
//             </div>
//             {chosen.length === 0 ? (
//               <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Select a barcode to preview.</div>
//             ) : expectedLabels === 0 ? (
//               <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
//                 {pendingBatch.length
//                   ? 'Set the number of labels for the batch barcode' + (pendingBatch.length === 1 ? '' : 's')
//                     + ' to preview ' + (pendingBatch.length === 1 ? 'it' : 'them') + ' - Print will ask.'
//                   : 'Nothing to print.'}
//               </div>
//             ) : (
//               <>
//                 {/* A batch is never previewed at a quantity nobody chose, so
//                     say what is missing rather than show a short sheet
//                     silently. */}
//                 {pendingBatch.length > 0 && (
//                   <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
//                     {pendingBatch.length} batch barcode{pendingBatch.length === 1 ? ' is' : 's are'} not in the preview yet - Print will ask how many labels.
//                   </div>
//                 )}
//                 <div className="overflow-auto rounded border border-gray-300 bg-white p-2">
//                   {/* GrcBarcodeLabelSheet is the same component the
//                       barcode-print page renders, so Preview = Print exactly. */}
//                   <GrcBarcodeLabelSheet rows={selectedRows} format={format} gap={gap} page={run.page} />
//                 </div>
//               </>
//             )}
//           </div>
//         </div>

//         <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
//           {printError && (
//             <span className="mr-auto text-sm font-medium text-red-700">{printError}</span>
//           )}

//           <label className="flex items-center gap-1 text-xs text-gray-600">
//             Label
//             <select
//               value={formatName}
//               onChange={(event) => setFormatName(event.target.value)}
//               className="rounded border border-gray-300 px-2 py-1 text-xs"
//             >
//               {formats.length === 0 && <option value="">Default 50 x 40 mm</option>}
//               {formats.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
//             </select>
//           </label>

//           <label className="flex items-center gap-1 text-xs text-gray-600">
//             Paper
//             <select
//               value={paper}
//               onChange={(event) => setPaper(event.target.value)}
//               className="rounded border border-gray-300 px-2 py-1 text-xs"
//             >
//               <option value="a4">A4 sheet</option>
//               <option value="stock" disabled={!stockSize}>
//                 {stockSize ? 'Label stock ' + format.pageSize : 'Label stock (no size set)'}
//               </option>
//             </select>
//           </label>

//           {/* event.detail > 1 is the second click of a double click. The lock
//               cannot stop it on its own: the real window.print() blocks while
//               the print dialog is open, the lock is released when it returns,
//               and a second click queued behind the dialog would then open it
//               again. A single click is detail 1 and the keyboard detail 0. */}
//           <button type="button" disabled={printing} onClick={(event) => { if (event.detail > 1) return; runPrint(); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">{printing ? 'Preparing...' : 'Print'}</button>
//           <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">Close</button>
//         </div>
//       </div>

//       {/* THE PRINT SURFACE.

//           Portaled to <body> so it is a sibling of the application rather than
//           a descendant of this modal. That matters: the modal is
//           `fixed inset-0` with a `max-h` scrolling body, and Chrome prints a
//           fixed box on the first page only and clips an overflow box instead
//           of paginating it - a sheet of labels left inside it would have come
//           out as one truncated page however the CSS was written.

//           At <body> level the sheet is ordinary in-flow content that fragments
//           across as many pages as it needs, and the @media print rules in
//           globals.css take the rest of the application out of the box tree so
//           not one sheet of paper is spent on it. */}
//       {printing && typeof document !== 'undefined' && createPortal(
//         <div id="barcode-print-root" ref={printRootRef}>
//           <style>{pageRule}</style>
//           {/* GrcBarcodeLabelSheet matches the print page exactly — same
//               component, same 2-column grid, same Label, same data contract. */}
//           <GrcBarcodeLabelSheet rows={selectedRows} format={format} gap={gap} page={run.page} />
//         </div>,
//         document.body
//       )}
//     </div>
//   );
// }

// export default function GCRBarcodeGeneration({ grcId = null, initialRows = NO_ROWS, supplierMarkup = {}, supplierPriceSetup = null, grcHeader = {}, onSaved = null }) {
//   const router = useRouter();
//   const scope = useScope();

//   const [rows, setRows] = useState([]);
//   const [activeTab, setActiveTab] = useState("items");
//   const [showSaveConfirm, setShowSaveConfirm] = useState(false);
//   const [showPrint, setShowPrint] = useState(false);
//   const [printRows, setPrintRows] = useState([]);
//   const [showAddItem, setShowAddItem] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [importMessage, setImportMessage] = useState("");
//   /* why the last save was refused, in the server's own words */
//   const [saveError, setSaveError] = useState("");
//   /* Set the moment a save starts - `saving` only lands on the next render, so
//      a second click before then would send the same rows again. */
//   const savingRef = useRef(false);
//   /* The GRC the rows were saved to. On the standalone screen (no grcId) the
//      first Submit creates it; every later Submit must update that GRC rather
//      than raise another one carrying the same barcode numbers. */
//   const [savedGrcId, setSavedGrcId] = useState(null);
//   /* Saved rows the operator removed from the grid, as { row, index }. They
//      leave the database only when Submit is pressed - sent as explicit ids,
//      never inferred from what the save leaves out - and Undo puts them back
//      until then. */
//   const [pendingDeletes, setPendingDeletes] = useState([]);
//   /* asks the ITEMS sheet to put its cursor on a cell: a refused Submit
//      points at the first cell to fix */
//   const [sheetFocus, setSheetFocus] = useState(null);
//   const sheetRowSeq = useRef(0);
//   /* the rows as last rendered, for the next serial of a new sheet row */
//   const sheetRowsRef = useRef([]);
//   sheetRowsRef.current = rows;
//   const importInputRef = useRef(null);
//   const [barcodeFormat, setBarcodeFormat] = useState({ prefix: "", suffix: "", startNumber: 1, numberLenght: 4 });
//   /* sequenceRef was the browser-held running number. It is kept only so the
//      Barcode Setting's Start From can still be shown as a preview on the
//      settings card; NOTHING is numbered from it any more - the save route
//      gives every barcode its value (lib/barcodeValue.js). */
//   const sequenceRef = useRef(1);

//   useEffect(() => {
//     /* a fresh read from the database: any deletion that was pending has
//        been saved, or the page was reopened and it no longer applies */
//     setPendingDeletes([]);
//     if (!Array.isArray(initialRows) || initialRows.length === 0) {
//       setRows([]);
//       return;
//     }

//     /* toGridRow (lib/barcodeRowSync.js) is shared with the save route, which
//        uses it to tell a row the operator edited from one left untouched. Each
//        row keeps its database _id - that is how the save finds it again. */
//     setRows(initialRows.map(toGridRow));
//   }, [initialRows]);

//   /* GST% FOR SAVED ROWS THAT CARRY NONE.

//      Some rows were saved with GST% "0" although their HSN has a tax slab in
//      HSN Master, so every total showed GST 0.00 and Net equal to Taxable. When
//      the GRC loads, each such row is given the rate of its own HSN - this
//      company's HSN Master, the band picked by the row's final rate, exactly as
//      the Add Item form picks it. NOTHING IS WRITTEN: the rows show the rate,
//      the totals follow, and the notice asks the operator to Submit to store
//      it. A row that already has a rate, or has been sold / moved, is left
//      alone, and an HSN with no rate changes nothing. */
//   useEffect(() => {
//     /* the company is not known yet - an unscoped HSN search could take
//        another company's slab for the same code */
//     if (!scope.businessReady) return undefined;
//     const loaded = Array.isArray(initialRows) ? initialRows : [];
//     const pending = loaded.filter((row) => row._id && !isLockedRow(row)
//       && String(row.hsn || "").trim() && !(Number(row.gst) > 0));
//     if (!pending.length) return undefined;
//     let cancelled = false;
//     const rateOf = (row) => Number(row.finalPrice || row.finalNet) || Number(row.purchaseRate || row.purRate) || 0;
//     /* each row's HSN is looked up in its OWN company's HSN Master */
//     const businessOf = (row) => String(row.businessId || scope.business || "");
//     const keyOf = (row) => businessOf(row) + "|" + String(row.hsn || "").trim();
//     (async () => {
//       const slabsByKey = new Map();
//       await Promise.all([...new Map(pending.map((row) => [keyOf(row), row])).values()].map(async (row) => {
//         const code = String(row.hsn).trim();
//         const business = businessOf(row);
//         if (!business) return;
//         try {
//           const qs = new URLSearchParams({ perPage: "20", search: code, business });
//           const response = await fetch("/api/hsn?" + qs);
//           if (!response.ok) return;
//           const payload = await response.json();
//           const match = (payload.rows || []).find((hsn) => String(hsn.code || "").trim() === code);
//           if (match) slabsByKey.set(keyOf(row), await resolveSlabRates(match.taxSlabs || []));
//         } catch { /* no rate found - the row keeps its own */ }
//       }));
//       if (cancelled) return;
//       const rateFor = (row) => {
//         const slabs = slabsByKey.get(keyOf(row));
//         return slabs && slabs.length ? Number(gstPercentForAmount(slabs, rateOf(row))) || 0 : 0;
//       };
//       const ids = new Set(pending.filter((row) => rateFor(row) > 0).map((row) => String(row._id)));
//       if (!ids.size) return;
//       setRows((current) => current.map((row) => (
//         ids.has(String(row._id)) && !(Number(row.gst) > 0) && !isLockedRow(row)
//           ? { ...row, gst: String(rateFor(row)) }
//           : row
//       )));
//       setImportMessage(`${GST_FILL_NOTICE} on ${ids.size} saved row${ids.size === 1 ? "" : "s"} and has been filled from HSN Master - check the totals and press Submit to save it.`);
//     })();
//     return () => { cancelled = true; };
//   }, [initialRows, scope.business, scope.businessReady]);

//   /* The active Purchase Rate Code Master for this scope. Loaded once here and
//      handed down, so the Add Item form never has to fetch it itself and every
//      row generated in one session encodes against the same table. An absent or
//      inactive record leaves the mapping empty, and encodeRate() then returns
//      '' rather than inventing an alphabet. */
//   const [rateCodeMapping, setRateCodeMapping] = useState(null);

//   useEffect(() => {
//     const params = new URLSearchParams({
//       business: scope.business || "",
//       location: scope.location || "",
//     });
//     fetch("/api/purchase-rate-code?" + params)
//       .then((response) => response.json())
//       .then((result) => {
//         const doc = result.doc;
//         setRateCodeMapping(doc && doc.isActive !== false ? doc.digitMappings || {} : {});
//       })
//       .catch(() => setRateCodeMapping({}));
//   }, [scope.business, scope.location]);

//   useEffect(() => {
//     const params = new URLSearchParams({
//       business: scope.business || "",
//       finYear: scope.finYear || "",
//       page: "1",
//       perPage: "50",
//     });

//     fetch("/api/barcode-setting?" + params)
//       .then((response) => response.json())
//       .then((result) => {
//         const rows = Array.isArray(result.rows) ? result.rows : [];
//         const active = rows
//           .filter((row) => isDateActive(row))
//           .sort((a, b) => new Date(b.effectiveDate || 0) - new Date(a.effectiveDate || 0))[0]
//           || rows[0]
//           || null;

//         if (active) {
//           const format = {
//             prefix: active.prefix || "",
//             suffix: active.suffix || "",
//             startNumber: Number(active.startNumber) || 1,
//             numberLenght: Number(active.numberLenght) || 4,
//           };
//           setBarcodeFormat(format);
//           sequenceRef.current = format.startNumber;
//         }
//       })
//       .catch(() => {});
//   }, [scope.business, scope.finYear]);

//   const validRows = useMemo(() => rows.filter((row) => String(row.itemCode || row.itemName || "").trim()), [rows]);
//   const additionalFields = useMemo(() => customFieldNames(validRows), [validRows]);

//   /* ---- the money on this screen, from lib/grcMoney.js --------------------

//      One module for every figure here, the save route, the GRC list and the
//      print sheet, worked out in the order the business rule states:

//        1. net amount = line taxable + line GST, summed
//        2. GST amount = line taxable x the row's OWN GST% / 100, summed
//        3. taxable    = net amount - GST amount

//      so TAXABLE + GST = NET AMOUNT on the totals bar, in the Item Summary and
//      in what the save stores, to the paisa. The GST rate is each row's own -
//      filled from the item / HSN master, never fixed here.

//      This used to set the taxable value to the line's net amount and then add
//      GST on top of it, which put the tax in twice. It is derived from `rows`,
//      so a changed rate, quantity, discount, offer or GST% recalculates all
//      three together: none of them can be left showing the value before the
//      edit. */
//   const totals = useMemo(() => {
//     const money = grcTotals(validRows);
//     return validRows.reduce((acc, row) => {
//       const qty = rowQty(row);
//       acc.pcs += pcRegex.test(String(row.uom || "")) ? qty : 0;
//       acc.mtr += meterRegex.test(String(row.uom || "")) ? qty : 0;
//       return acc;
//     }, { taxable: money.taxable, gst: money.gst, net: money.netAmount, pcs: 0, mtr: 0 });
//   }, [validRows]);

//   /* ITEM SUMMARY - one line per BILL LINE of the supplier's bill.

//      The Bill Sl No. is part of the key, not a number worked out from the
//      position of the line in this table. It used to be neither: the table
//      rendered {index + 1} in that column and this object carried no billSlNo
//      at all, so the screen the barcode rule cites as the place to check the
//      third segment was showing a row counter instead - and one item received
//      on two different bill lines was folded into a single line that could not
//      name either of them. */
//   const summaryRows = useMemo(() => {
//     const map = new Map();
//     validRows.forEach((row) => {
//       const billSlNo = String(row.billSlNo ?? "").trim();
//       const key = `${billSlNo}-${row.itemCode || row.itemName || "item"}-${row.hsn || ""}-${row.gst || ""}-${row.uom || ""}`;
//       if (!map.has(key)) {
//         map.set(key, {
//           id: key,
//           billSlNo,
//           itemName: row.itemName || row.supplierDescription || row.itemCode,
//           qty: 0,
//           beforeTax: 0,
//           gst: 0,
//           net: 0,
//           customFields: {},
//         });
//       }
//       const entry = map.get(key);
//       /* the same three figures as the totals bar, for this bill line */
//       entry.qty += rowQty(row);
//       entry.beforeTax = r2(entry.beforeTax + rowTaxable(row));
//       entry.gst = r2(entry.gst + rowGst(row));
//       entry.net = r2(entry.beforeTax + entry.gst);
//       Object.entries(row.customFields || {}).forEach(([key, value]) => {
//         const current = entry.customFields[key];
//         entry.customFields[key] = current && current !== value ? `${current}, ${value}` : value;
//       });
//     });
//     return Array.from(map.values());
//   }, [validRows]);

//   function appendRows(items) {
//     setRows((current) => [...current, ...items]);
//   }

//   function exportRowsToExcel() {
//     const headers = [...Object.values(exportFieldLabels), ...additionalFields];
//     const fields = Object.keys(exportFieldLabels);
//     const sheetRows = [headers, ...validRows.map((row) => [
//       ...fields.map((field) => row[field] ?? ""),
//       ...additionalFields.map((field) => row.customFields?.[field] ?? ""),
//     ])];
//     const workbook = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), "Barcode Items");
//     /* the same rows again, very hidden, so Import can tell which cells were
//        changed - see EXPORT_SNAPSHOT_SHEET */
//     XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), EXPORT_SNAPSHOT_SHEET);
//     workbook.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 2 }] };
//     XLSX.writeFile(workbook, "barcode-items-template.xlsx");
//   }

//   async function importRowsFromExcel(event) {
//     const file = event.target.files?.[0];
//     /* cleared at once, so picking the same file again after editing it still
//        fires onChange - a browser does not re-report an unchanged selection */
//     event.target.value = "";
//     if (!file) return;

//     try {
//       const { rows: importedRows, snapshot } = await readExcelFile(file);
//       if (importedRows.length === 0) throw new Error("No item rows were found in the Excel file.");

//       /* ---- match every sheet row to the grid row it edits --------------
//          A row with a Barcode No matches the grid row carrying that barcode
//          and nothing else; a row without one matches on Item Code + Serial No.
//          A match is UPDATED in place and anything else is added, so importing
//          the same sheet again edits rows instead of duplicating them. When the
//          sheet carries its export snapshot, only the cells that were changed
//          are taken from it. Matching comes before validation so each row is
//          checked as it will end up. */
//       const currentByKey = new Map();
//       rows.forEach((row) => {
//         [rowMatchKey(row), rowItemKey(row)].filter(Boolean).forEach((key) => currentByKey.set(key, row));
//       });

//       const problems = [];
//       const lineByKey = new Map();
//       const planned = [];
//       importedRows.forEach((importedRow, index) => {
//         const line = index + 2;                   // +1 for the header, +1 for 1-based
//         const matchKey = rowMatchKey(importedRow) || `new:${index}`;
//         if (lineByKey.has(matchKey)) {
//           /* the second copy used to be skipped without a word, so an edit on
//              the lower row silently did nothing */
//           if (matchKey.startsWith("barcode:")) {
//             problems.push(`Row ${line}: Barcode No ${importedRow.barcodeNo} is also on row ${lineByKey.get(matchKey)}`);
//           }
//           return;
//         }
//         lineByKey.set(matchKey, line);
//         const existing = currentByKey.get(matchKey);
//         const original = existing && snapshot ? snapshot.get(String(importedRow.barcodeNo || "").trim()) || null : null;
//         const changes = original ? changedCells(importedRow, original) : importedRow;
//         planned.push({ importedRow, changes, original, index, line, existing });
//       });

//       /* ---- validate BEFORE anything is written -------------------------
//          An import that is half applied leaves the grid in a state nobody can
//          reason about, and if it is then saved it puts wrong stock into the
//          system. Every row is checked first and the whole file is rejected
//          with the offending row numbers if any of them fail. A price that is
//          not a number is refused, never read as 0. */
//       const numericKeys = ["purchaseRate", "finalPrice", "retailPrice", "rsp", "offerPrice", "wsp", "wspPrice", "dp", "dpPrice",
//         "rspOfferPct", "wspOfferPct", "dpOfferPct", "discount", "gst"];
//       planned.forEach(({ changes, original, line, existing }) => {
//         const where = `Row ${line}${changes.barcodeNo ? ` (${changes.barcodeNo})` : ""}`;
//         const row = { ...(existing || {}), ...changes };
//         const name = String(row.itemName || row.itemCode || "").trim();
//         if (!name) problems.push(`${where}: item code or name is required`);

//         const qty = Number(row.qty ?? row.totalMtr ?? 0);
//         if (!Number.isFinite(qty) || qty <= 0) problems.push(`${where}: quantity must be a positive number`);

//         const isMtr = meterRegex.test(String(row.uom || ""));
//         const unique = String(row.uniqueBarcode || "").trim().toLowerCase() === "yes";
//         if (!isMtr && unique && !Number.isInteger(qty)) {
//           problems.push(`${where}: a unique piece quantity must be a whole number (got ${qty})`);
//         }

//         /* Purchase price, checked here - BEFORE the new rows are numbered
//            below. The save refuses a price that is not greater than 0 anyway
//            (lib/purchasePrice.js), so a file carrying one used to reserve real
//            barcode numbers that the save then threw away. */
//         const priceProblem = purchasePriceError(
//           String(row.purchaseRate ?? "").trim() !== "" ? row.purchaseRate : row.purRate
//         );
//         if (priceProblem) problems.push(`${where}: ${priceProblem}`);
//         /* a new row needs a P-M-F; a saved one may not lose the one it has */
//         if (!pmfOf(row) && (!existing || pmfOf(existing))) problems.push(`${where}: ${PMF_REQUIRED_MESSAGE}`);

//         numericKeys.forEach((key) => {
//           const value = changes[key];
//           if (value !== undefined && String(value).trim() !== "" && !Number.isFinite(Number(value))) {
//             problems.push(`${where}: invalid ${exportFieldLabels[key] || key} value "${value}"`);
//           }
//         });
//         priceConflicts(changes, existing, Boolean(original)).forEach((message) => problems.push(`${where}: ${message}`));
//       });

//       if (problems.length) {
//         const shown = problems.slice(0, 12).join(" · ");
//         throw new Error(
//           `The file was not imported - ${problems.length} problem${problems.length === 1 ? "" : "s"} found. ` +
//           shown +
//           (problems.length > 12 ? ` ...and ${problems.length - 12} more` : "")
//         );
//       }

//       /* ---- NEW rows get no number here: the save route gives each its
//          barcode value (SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SEQ) on
//          Submit. */
//       const updatedById = new Map();
//       const addedRows = [];
//       const notes = { offerKept: [], offerStarted: [], finalKept: [] };
//       planned.forEach(({ changes, original, index, existing }) => {
//         if (original && Object.keys(changes).length === 1) return;   // exported and left untouched
//         const id = existing?.id || `import-${Date.now()}-${index}`;
//         const barcodeNo = existing?.barcodeNo || changes.barcodeNo || "";
//         const rowNotes = [];
//         const merged = mergeImportedRow(existing, changes, {
//           id, barcodeNo, rateCodeMapping, original, onNote: (kind) => rowNotes.push(kind),
//         });
//         /* a sheet imported again after its changes were applied changes
//            nothing more - not counted as an update, not reported twice */
//         if (existing && !rowDiffers(merged, existing)) return;
//         rowNotes.forEach((kind) => notes[kind].push(barcodeNo || merged.itemCode || `row ${index + 2}`));
//         if (existing) updatedById.set(existing.id, { ...merged, _importStatus: 'CHANGED' });
//         else addedRows.push({ ...merged, _importStatus: 'NEW' });
//       });

//       /* an updated row is swapped in by id, so it keeps its place in the grid.
//          Existing rows that were not touched have their _importStatus cleared so
//          they do not stay highlighted from a previous import. */
//       setRows((list) =>
//         list.map((row) => updatedById.get(row.id) || { ...row, _importStatus: undefined })
//             .concat(addedRows)
//       );

//       const list = (codes) => codes.slice(0, 8).join(", ") + (codes.length > 8 ? ` and ${codes.length - 8} more` : "");
//       const unchanged = planned.length - updatedById.size - addedRows.length;
//       setImportMessage(
//         `${planned.length} row${planned.length === 1 ? "" : "s"} read: ${updatedById.size} updated, ${addedRows.length} added` +
//         (unchanged ? `, ${unchanged} unchanged` : "") +
//         `.${updatedById.size || addedRows.length ? " Click Submit to save them." : ""}` +
//         (!snapshot && updatedById.size
//           ? " This sheet has no export snapshot (it was exported before this update, or made elsewhere), so every filled cell was applied - use Export Excel for a sheet where only the cells you change are applied."
//           : "") +
//         (notes.offerKept.length
//           ? ` ${list(notes.offerKept)}: RSP changed but the running offer was kept, so the label and till still sell at the Offer Price - change Offer Price in the sheet if it should move.`
//           : "") +
//         (notes.offerStarted.length
//           ? ` Check Offer Price on ${list(notes.offerStarted)}: it now differs from the RSP, so the label and till will sell at the Offer Price. If no offer is intended, set it equal to the RSP or leave it empty, and import again.`
//           : "") +
//         (notes.finalKept.length
//           ? ` ${list(notes.finalKept)}: Final Price was not recalculated from the new Purchase Rate because the unit's discount is not known - set Final Price in the sheet if it should change.`
//           : "")
//       );
//     } catch (error) {
//       setImportMessage(error.message || "Unable to import the Excel file.");
//     }
//   }

//   async function saveRows(rowsToSave = validRows, printAfterSave = false, { printIds = null } = {}) {
//     /* one save at a time - see savingRef */
//     if (savingRef.current) return false;
//     savingRef.current = true;
//     setSaving(true);
//     setSaveError("");
//     /* Strip the UI-only fields before sending to the API, and leave out the
//        empty rows the ITEMS sheet keeps for typing into */
//     rowsToSave = rowsToSave.filter((row) => !isBlankRow(row)).map(({ _importStatus, _edited, ...rest }) => rest);
//     /* saved rows removed on the grid - deleted by this Submit, by id */
//     const deleteIds = pendingDeletes.map((entry) => entry.row._id).filter(Boolean);
//     try {
//       /* The ITEMS sheet's own rules (lib/itemsSheet.js), over every row that
//          is new or was edited, before anything is sent. A refusal names the
//          cells and puts the sheet's cursor on the first of them. */
//       const problems = sheetProblems(rows, sheetColumns(additionalFields));
//       if (problems.length > 0) {
//         setShowSaveConfirm(false);
//         setActiveTab("items");
//         setSheetFocus({ rowId: problems[0].rowId, key: problems[0].key, at: Date.now() });
//         setSaveError(
//           `Fix ${problems.length} cell${problems.length === 1 ? "" : "s"} in the ITEMS table before submitting: ` +
//           problems.slice(0, 3).map((p) => `Row ${p.index + 1} ${p.label}: ${p.message}`).join(" · ") +
//           (problems.length > 3 ? ` · and ${problems.length - 3} more` : "")
//         );
//         return false;
//       }
//       if (rowsToSave.length === 0 && deleteIds.length === 0) {
//         setShowSaveConfirm(false);
//         setSaveError("There is nothing to save.");
//         return false;
//       }

//       /* Purchase price, before anything is sent - the same rule the Add Item
//          form, the Excel import and the API apply (lib/purchasePrice.js). The
//          offending lines are named so they can be found in the grid. */
//       const priceErrors = [];
//       rowsToSave.forEach((row, index) => {
//         const problem = purchasePriceError(
//           String(row.purchaseRate ?? '').trim() !== '' ? row.purchaseRate : row.purRate
//         );
//         if (problem) priceErrors.push({ ref: row.itemCode || row.itemName || `Row ${index + 1}`, problem });
//       });

//       if (priceErrors.length > 0) {
//         const shown = priceErrors.slice(0, 3).map((p) => p.ref).join(', ');
//         const more = priceErrors.length > 3 ? ` and ${priceErrors.length - 3} more` : '';
//         /* the confirm dialog sits over the banner - as on the API-error path
//            below, it has to go or the operator never sees why */
//         setShowSaveConfirm(false);
//         setSaveError(`${priceErrors[0].problem} Check: ${shown}${more}`);
//         return false;
//       }

//       /* P-M-F on every barcode this Submit CREATES (no _id yet) - rows added
//          on the sheet, imported or from the Add Item form. A saved barcode keeps
//          the P-M-F it was stored with: the ITEMS sheet has no P-M-F column to
//          correct one, and requiring it there would stop every edit of a GRC
//          saved before the rule. */
//       const pmfErrors = [];
//       rowsToSave.forEach((row, index) => {
//         if (!row._id && !pmfOf(row)) pmfErrors.push(row.itemCode || row.itemName || `Row ${index + 1}`);
//       });
//       if (pmfErrors.length > 0) {
//         const shown = pmfErrors.slice(0, 3).join(', ');
//         const more = pmfErrors.length > 3 ? ` and ${pmfErrors.length - 3} more` : '';
//         setShowSaveConfirm(false);
//         setSaveError(`${PMF_REQUIRED_MESSAGE} Check: ${shown}${more}`);
//         return false;
//       }

//       /* Rows added on the sheet need no number from the browser: the save
//          route composes each barcode number, and every row carries its own id,
//          so a Submit pressed twice is matched by that id (clientRowId) rather
//          than inserted again. */
//       /* the same arithmetic as the totals bar (lib/grcMoney.js), so what the
//          save is told agrees to the paisa with what the operator confirmed */
//       const sending = grcTotals(rowsToSave);
//       const saveTotals = { count: sending.totalQuantity, value: sending.netAmount };
//       const response = await fetch("/api/barcode-generation", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           rows: rowsToSave,
//           grcId: grcId || savedGrcId || null,
//           deleteIds,
//           business: scope.business,
//           location: scope.location,
//           finYear: scope.finYear,
//           supplierId: scope.supplierId || null,
//           totals: {
//             count: saveTotals.count,
//             value: saveTotals.value,
//           },
//         }),
//       });
//       /* The API answers a failure as { error, code } (lib/apiError.js) - the
//          message is written for the operator and says WHICH rule was broken:
//          a missing Goods Type, an Old Barcode that matches nothing, a barcode
//          that has already moved, a permission the user does not hold. Throwing
//          a flat "Save failed" here discarded all of it, so a rejected save was
//          indistinguishable from a server being down and left nothing on screen
//          to act on. */
//       if (!response.ok) {
//         /* a refusal is an answer, not a crash: shown in the banner rather
//            than thrown into console.error, which Next's dev overlay reports
//            as a runtime error */
//         const data = await response.json().catch(() => ({}));
//         setShowSaveConfirm(false);
//         setSaveError(data.error || `Save failed (HTTP ${response.status})`);
//         return false;
//       }
//       setShowSaveConfirm(false);
//       const saved = await response.json().catch(() => ({}));
//       /* The barcode values are the server's - SEQ is given there - so every
//          row takes back what was stored: its _id, value and SEQ. A print
//          straight after the save prints exactly those, and never a row the
//          save did not store. */
//       const storedById = new Map((saved.rows || []).map((s) => [String(s._id), s]));
//       const storedByClientId = new Map((saved.createdRows || []).map((s) => [String(s.id), s]));
//       /* Both barcode fields as the server stored them, taken together off the
//          one record it answered with. barcodeGenerated used to be filled in
//          here from barcodeNo, which printed the number twice on any barcode
//          whose composed value is a different string - a label taken straight
//          after Submit then disagreed with the same label printed from the
//          Barcode Print page, which reads the record back from the database. */
//       const asStored = (row) => {
//         const s = (row._id && storedById.get(String(row._id))) || storedByClientId.get(String(row.id));
//         return s
//           ? {
//             ...row, _id: s._id, barcodeNo: s.barcodeNo, barcodeGenerated: s.barcodeGenerated ?? '', seq: s.seq,
//             /* the parts the stored value was made from, so the grid and a
//                print straight after Submit agree with the value */
//             ...(s.billSlNo !== undefined ? { billSlNo: s.billSlNo } : {}),
//             ...(s.serialNo !== undefined ? { serialNo: s.serialNo } : {}),
//           }
//           : row;
//       };
//       if (printAfterSave) {
//         const wanted = printIds ? new Set(printIds.map(String)) : null;
//         setPrintRows(rowsToSave
//           .filter((row) => !wanted || wanted.has(String(row.id)))
//           .map(asStored)
//           .filter((row) => row._id && labelKey(row)));
//         setShowPrint(true);
//       }
//       router.refresh?.();
//       /* re-read from the database, so the grid shows what was saved.
//          Also clear _importStatus on saved rows so highlights disappear. */
//       setRows((list) => list.map((r) => {
//         const next = asStored(r);
//         return (next._importStatus || next._edited) ? { ...next, _importStatus: undefined, _edited: undefined } : next;
//       }));
//       setPendingDeletes([]);
//       if (onSaved) {
//         onSaved();
//       } else if (saved.grcId) {
//         /* The standalone screen has no page to re-read for it: remember the
//            GRC the first Submit created, and take the rows back with their
//            database ids, so the next Submit updates what is already saved. */
//         setSavedGrcId(saved.grcId);
//         fetch(`/api/grc/${saved.grcId}`, { cache: "no-store" })
//           .then((result) => result.json())
//           .then((result) => { if (Array.isArray(result.rows)) setRows(result.rows.map(toGridRow)); })
//           .catch(() => {});
//       }
//       return true;
//     } catch (error) {
//       console.error(error);
//       /* the confirm dialog sits over the banner, so it has to go or the
//          operator never sees why the save was refused */
//       setShowSaveConfirm(false);
//       setSaveError(error.message || "Save failed");
//       return false;
//     } finally {
//       savingRef.current = false;
//       setSaving(false);
//     }
//   }

//   /* Removing a row - from the ITEMS sheet or the Item With Barcode tab. A row
//      that was never saved lives only in this screen and simply goes. A saved
//      one leaves the grid now but the database only when Submit is pressed:
//      its id is sent as an explicit deletion (a save never infers one from a
//      missing row), the server refuses a unit that has already moved, and
//      until then Undo puts it back where it was. */
//   function removeRow(row) {
//     if (isLockedRow(row)) return;
//     const index = rows.findIndex((item) => item.id === row.id);
//     if (index < 0) return;
//     setRows((list) => list.filter((item) => item.id !== row.id));
//     if (row._id) setPendingDeletes((list) => [...list, { row, index }]);
//   }

//   function undoDeletes() {
//     const restore = [...pendingDeletes].sort((a, b) => a.index - b.index);
//     setRows((list) => {
//       const next = list.slice();
//       restore.forEach(({ row, index }) => next.splice(Math.min(index, next.length), 0, row));
//       return next;
//     });
//     setPendingDeletes([]);
//   }

//   /* A new row on the ITEMS sheet. The grid has no column for how the unit is
//      counted or discounted, so those follow the row above
//      (SHEET_INHERITED_FIELDS); everything the operator types starts empty.

//      THE BILL SL NO. IS CARRIED DOWN FROM THE ROW ABOVE, NOT COUNTED UP.
//      It is the line of the supplier's bill these goods came in on, and it is
//      the third part of every barcode of that line - so several rows of one
//      bill line share it, and it changes only when the bill line does. This
//      used to be `highest on the grid + 1`, which made the number a running
//      row counter: twenty pieces of bill line 1 produced bill lines 1 to 20,
//      and the barcode carried the row's position where the bill line belongs.
//      A row with nothing above it starts blank, and the save route refuses a
//      blank one by name rather than inventing a number for it.

//      No barcode number here either: the save route composes it. */
//   const createSheetRow = useCallback((template) => {
//     const row = emptyRow(`sheet-${Date.now()}-${sheetRowSeq.current++}`);
//     if (template) {
//       SHEET_INHERITED_FIELDS.forEach((key) => {
//         if (template[key] !== undefined && template[key] !== null) row[key] = template[key];
//       });
//     }
//     const carried = String(template?.billSlNo ?? "").trim()
//       || String([...sheetRowsRef.current].reverse().find((item) => String(item?.billSlNo ?? "").trim())?.billSlNo ?? "").trim();
//     row.billSlNo = carried;
//     return row;
//   }, []);

//   /* THE barcode value of every row, for the ITEMS sheet's Barcode Identifier
//      column when that column is shown (the Item With Barcode tab's Barcode No
//      shows the saved barcodeNo instead) - in the canonical spelling
//      the label encodes and prints (lib/barcodeValue.js):

//         SUPPLIER_CODE*GRC_NUMBER*BILL_SL_NO*SERIAL_NO

//       - a saved row: its STORED value, never one rebuilt from its fields - or,
//         when its Bill Sl No. has been changed on the grid, that value with the
//         new Bill Sl No., which is what the save restates it to
//       - a row not saved yet: the value the save route will give it - the next
//         SERIAL_NO on its Bill Sl No. after every serial the saved values carry
//         and after the GRC's floor for that line, in grid order
//       - a row saved before values were composed: its own number as printed
//       Printing reads only stored values, so the text and the bars cannot
//       disagree. */
//   const provisionalSerialNo = useMemo(() => {
//     const saved = rows.filter((row) => row._id).concat(pendingDeletes.map((entry) => entry.row));
//     const nextByBill = new Map();
//     const byRow = new Map();
//     rows.forEach((row) => {
//       if (row._id || !String(row.itemCode || row.itemName || "").trim()) return;
//       const billSlNo = billSlNoForBarcode(row.billSlNo);
//       if (!billSlNo) return;
//       const previous = nextByBill.has(billSlNo)
//         ? nextByBill.get(billSlNo)
//         : Math.max(highestSerialNo(saved, billSlNo), serialFloorOf(grcHeader, billSlNo, saved));
//       /* a typed starting Serial No. moves the line on, never back - as the
//          save route applies it */
//       const requested = /^\d+$/.test(String(row.serialNo ?? "").trim()) ? Number(row.serialNo) : 0;
//       const serial = Math.max(previous + 1, requested);
//       nextByBill.set(billSlNo, serial);
//       byRow.set(row.id, serial);
//     });
//     return byRow;
//   }, [rows, pendingDeletes, grcHeader]);

//   const barcodeValueOf = useCallback((row) => {
//     const parts = { supplierCode: grcHeader.supplierCode, referenceCode: grcHeader.grcNumber };
//     if (row._id) {
//       const stored = composedValueOf(row);
//       if (!stored) return unitNumberOf(row);
//       const storedParts = parseBarcodeValue(stored);
//       const billSlNo = billSlNoForBarcode(row.billSlNo);
//       if (!billSlNo || storedParts.billSlNo === billSlNo) return stored;
//       return generateBarcodeValue({ ...parts, billSlNo, serialNo: storedParts.serialNo }) || stored;
//     }
//     const serialNo = provisionalSerialNo.get(row.id);
//     return serialNo ? generateBarcodeValue({ ...parts, billSlNo: row.billSlNo, serialNo }) : "";
//   }, [provisionalSerialNo, grcHeader.grcNumber, grcHeader.supplierCode]);

//   /* The final Submit bar is position:fixed - on a desktop that alone keeps it
//      at the window's bottom-right through any scroll. On a phone or tablet this
//      page is wider than the screen (fixed-width top bar and sidebar), and the
//      browser then pins fixed elements to that wider layout instead of to what
//      is on screen, so the bar sat off to the right and far below. This moves it
//      back by exactly the gap between where it landed and the visible
//      bottom-right - zero on a desktop, where nothing changes. */
//   const submitBarRef = useRef(null);
//   useEffect(() => {
//     const viewport = window.visualViewport;
//     const bar = submitBarRef.current;
//     if (!viewport || !bar) return undefined;
//     const place = () => {
//       bar.style.transform = "";
//       const box = bar.getBoundingClientRect();
//       const css = getComputedStyle(bar);
//       const dx = viewport.offsetLeft + viewport.width - parseFloat(css.right) - box.right;
//       const dy = viewport.offsetTop + viewport.height - parseFloat(css.bottom) - box.bottom;
//       if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) bar.style.transform = `translate(${dx}px, ${dy}px)`;
//     };
//     place();
//     viewport.addEventListener("resize", place);
//     viewport.addEventListener("scroll", place);
//     /* the page widening later (rows loaded) can widen that layout too */
//     const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
//     observer?.observe(document.body);
//     return () => {
//       viewport.removeEventListener("resize", place);
//       viewport.removeEventListener("scroll", place);
//       observer?.disconnect();
//     };
//   }, []);

//   return (
//     <div className="min-h-screen bg-gray-100 px-2 pb-24 pt-4 md:pt-6">
//       <div className="flex items-center justify-between gap-4 pb-3">
//         <div>
//           <h1 className="text-xl font-semibold text-gray-800">GRC Barcode Generation</h1>
//         </div>
//         <div className="text-sm text-gray-500">Barcode labels are ready after submit</div>
//       </div>

//       <AddItemModal
//         open={showAddItem}
//         barcodeFormat={barcodeFormat}
//         /* scopes the Old Barcode lookup to the selected company, so a code
//            belonging to another business reports that rather than "not found" */
//         business={scope.business}
//         markupDefaults={supplierMarkup}
//         /* the GRC supplier's Price Calculation Setup (GET /api/grc/[id]) */
//         priceSetup={supplierPriceSetup}
//         rateCodeMapping={rateCodeMapping}
//         grcId={grcHeader.grcId || grcId}
//         /* The next Bill Sl No. to suggest in the form, derived from the Item
//            Summary: the highest billSlNo already present in the saved rows + 1.
//            When the GRC has no rows yet, this is 1. This mirrors exactly what
//            the Item Summary table shows - it is built from the same rows array
//            - so the Serial No. field is always in step with that table. */
//         initialBillSlNo={
//           validRows.length === 0
//             ? 1
//             : Math.max(...validRows.map((r) => Number(r.billSlNo) || 0)) + 1
//         }
//         /* The Serial No.* field initial value — the SL NO from the Item Summary
//            for the next new entry. Item Summary SL NO is simply the row counter
//            of that table (1, 2, 3...), so the next one is summaryRows.length + 1. */
//         initialNextSerialNo={summaryRows.length + 1}
//         onClose={() => setShowAddItem(true)}
//         onSubmit={(items) => appendRows(items)}
//         onSubmitAndPrint={(items) => {
//           const nextRows = [...rows, ...items];
//           setRows(nextRows);
//           /* the whole grid is saved, but only the barcodes this entry made
//              go to the picker - Submit & Print used to offer, pre-ticked,
//              every label of the GRC again */
//           return saveRows(nextRows, true, { printIds: items.map((item) => item.id) });
//         }}
//       />

//       <div className="mt-4 rounded-lg border border-gray-300 bg-white shadow-sm">
//         <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
//           <div className="flex gap-6 text-sm font-semibold">
//             {[
//               { key: "items", label: "ITEMS" },
//               { key: "summary", label: "ITEM SUMMARY" },
//               { key: "withBarcode", label: "ITEM WITH BARCODE" },
//             ].map((tab) => (
//               <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={activeTab === tab.key ? "border-b-2 border-blue-600 pb-1 text-blue-700" : "pb-1 text-gray-600"}>{tab.label}</button>
//             ))}
//           </div>
//           <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
//             <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,.html" onChange={importRowsFromExcel} className="hidden" />
//             <button type="button" onClick={() => importInputRef.current?.click()} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50" title="Import edited Excel template">
//               <Icon name="file" size={14} /> Import Excel
//             </button>
//             <button type="button" onClick={exportRowsToExcel} disabled={validRows.length === 0} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50" title="Export all item fields to Excel">
//               <Icon name="file" size={14} /> Export Excel
//             </button>
//             {/* The picker could only ever be reached by adding another item
//                 and pressing Submit & Print Label. Re-opening a GRC to reprint
//                 a damaged sticker - the ordinary reason to come back to this
//                 screen - meant generating a barcode nobody wanted. */}
//             <button type="button" onClick={() => { setPrintRows([]); setShowPrint(true); }} disabled={validRows.filter((row) => row._id && row.barcodeNo).length === 0} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50" title="Print labels for the barcodes on this GRC">
//               <Icon name="printer" size={14} /> Print Labels
//             </button>
//             <span className="rounded border border-gray-300 bg-gray-50 px-2 py-1">Pc(s) {totals.pcs}</span>
//           </div>
//         </div>

//         {importMessage && (() => {
//           /* Colour the banner based on what happened:
//              - any error (no rows updated/added) → red
//              - changes or new rows present         → amber (action needed)
//              - all unchanged                        → green (nothing to do) */
//           const changedCount = validRows.filter((r) => r._importStatus === 'CHANGED').length;
//           const newCount     = validRows.filter((r) => r._importStatus === 'NEW').length;
//           const hasAction    = changedCount > 0 || newCount > 0 || importMessage.startsWith(GST_FILL_NOTICE);
//           const isError      = importMessage.startsWith("The file was not imported") || importMessage.startsWith("Unable to");
//           const banner = isError
//             ? "border-red-200 bg-red-50 text-red-800"
//             : hasAction
//               ? "border-amber-200 bg-amber-50 text-amber-900"
//               : "border-green-200 bg-green-50 text-green-800";
//           const dismiss = isError ? "text-red-600" : hasAction ? "text-amber-700" : "text-green-700";
//           return (
//             <div className={`flex items-start justify-between gap-4 border-b px-4 py-2 text-sm ${banner}`}>
//               <div className="flex flex-col gap-1">
//                 {/* Counts line when we have statuses to show */}
//                 {!isError && (changedCount > 0 || newCount > 0) && (
//                   <div className="flex items-center gap-3 font-semibold">
//                     {changedCount > 0 && (
//                       <span className="flex items-center gap-1">
//                         <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
//                         {changedCount} changed
//                       </span>
//                     )}
//                     {newCount > 0 && (
//                       <span className="flex items-center gap-1">
//                         <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
//                         {newCount} new
//                       </span>
//                     )}
//                     {validRows.filter((r) => !r._importStatus).length > 0 && (
//                       <span className="flex items-center gap-1 font-normal text-gray-500">
//                         <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
//                         {validRows.filter((r) => !r._importStatus).length} unchanged
//                       </span>
//                     )}
//                   </div>
//                 )}
//                 <span>{importMessage}</span>
//               </div>
//               <button type="button" onClick={() => setImportMessage("")} className={`mt-0.5 shrink-0 ${dismiss}`} aria-label="Dismiss import message">×</button>
//             </div>
//           );
//         })()}

//         {saveError && (
//           <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
//             <span>{saveError}</span>
//             <button type="button" onClick={() => setSaveError("")} className="text-red-700" aria-label="Dismiss save error">×</button>
//           </div>
//         )}

//         <div className="overflow-auto">
//           {activeTab === "items" && (
//             <ItemsSheet
//               rows={rows}
//               customFields={additionalFields}
//               rateCodeMapping={rateCodeMapping}
//               createRow={createSheetRow}
//               onChangeRows={setRows}
//               onRemoveRow={removeRow}
//               pendingDeleteCount={pendingDeletes.length}
//               onUndoDeletes={undoDeletes}
//               focusRequest={sheetFocus}
//             />
//           )}

//           {activeTab === "summary" && (
//             <table className="min-w-[1000px] w-full border-collapse text-xs">
//               <thead>
//                 <tr className="bg-gray-100 text-left text-gray-700">
//                   <th className="border border-gray-300 px-2 py-2">Sl No</th>
//                   <th className="border border-gray-300 px-2 py-2">Bill Sl No.</th>
//                   <th className="border border-gray-300 px-2 py-2">Item Name</th>
//                   <th className="border border-gray-300 px-2 py-2">QTY</th>
//                   <th className="border border-gray-300 px-2 py-2">Before GST Amount</th>
//                   <th className="border border-gray-300 px-2 py-2">GST Amount</th>
//                   <th className="border border-gray-300 px-2 py-2">Net Amount</th>
//                   {additionalFields.map((field) => <th key={field} className="border border-gray-300 px-2 py-2">{field}</th>)}
//                 </tr>
//               </thead>
//               <tbody>
//                 {summaryRows.length === 0 ? (
//                   <tr><td colSpan={7 + additionalFields.length} className="px-3 py-8 text-center text-gray-500">No data found</td></tr>
//                 ) : summaryRows.map((row, index) => (
//                   <tr key={row.id} className="odd:bg-white even:bg-gray-50">
//                     {/* Sl No is this table's own counter; Bill Sl No is the
//                         bill line the goods came in on, and the third part of
//                         every barcode of that line. They are different numbers
//                         and are no longer both the row's position. */}
//                     <td className="border border-gray-300 px-2 py-2">{index + 1}</td>
//                     <td className="border border-gray-300 px-2 py-2">{row.billSlNo || "-"}</td>
//                     <td className="border border-gray-300 px-2 py-2">{row.itemName}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.qty)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.beforeTax)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.gst)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.net)}</td>
//                     {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2">{row.customFields?.[field] || "-"}</td>)}
//                   </tr>
//                 ))}
//                 {summaryRows.length > 0 && (
//                   <tr className="bg-gray-100 font-semibold">
//                     <td className="border border-gray-300 px-2 py-2" colSpan={3}>Total</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(totals.pcs + totals.mtr)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(totals.taxable)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(totals.gst)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(totals.net)}</td>
//                     {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2" />)}
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           )}

//           {activeTab === "withBarcode" && (
//             <table className="min-w-[1400px] w-full border-collapse text-xs">
//               <thead>
//                 <tr className="bg-gray-100 text-left text-gray-700">
//                   <th className="border border-gray-300 px-2 py-2">Sl No</th>
//                   <th className="border border-gray-300 px-2 py-2">Item</th>
//                   <th className="border border-gray-300 px-2 py-2">QTY/MTR</th>
//                   <th className="border border-gray-300 px-2 py-2">No. of Cuts</th>
//                   <th className="border border-gray-300 px-2 py-2">Purchase Rate</th>
//                   <th className="border border-gray-300 px-2 py-2">Discount</th>
//                   <th className="border border-gray-300 px-2 py-2">Final Rate</th>
//                   <th className="border border-gray-300 px-2 py-2">Before Tax</th>
//                   <th className="border border-gray-300 px-2 py-2">GST Amount</th>
//                   <th className="border border-gray-300 px-2 py-2">Net Amount</th>
//                   <th className="border border-gray-300 px-2 py-2">RSP</th>
//                   <th className="border border-gray-300 px-2 py-2">WSP</th>
//                   <th className="border border-gray-300 px-2 py-2">E-COMM</th>
//                   <th className="border border-gray-300 px-2 py-2">Variant</th>
//                   <th className="border border-gray-300 px-2 py-2">Barcode No</th>
//                   {additionalFields.map((field) => <th key={field} className="border border-gray-300 px-2 py-2">{field}</th>)}
//                   <th className="border border-gray-300 px-2 py-2">Action</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {validRows.length === 0 ? (
//                   <tr><td colSpan={16 + additionalFields.length} className="px-3 py-8 text-center text-gray-500">No data found</td></tr>
//                 ) : validRows.map((row, index) => (
//                   <tr key={row.id || index} className={
//                     row._importStatus === 'CHANGED' ? "bg-red-50 border-l-4 border-l-red-500" :
//                     row._importStatus === 'NEW'     ? "bg-green-50 border-l-4 border-l-green-500" :
//                     "odd:bg-white even:bg-gray-50"
//                   }>
//                     <td className="border border-gray-300 px-2 py-2">{index + 1}</td>
//                     <td className="border border-gray-300 px-2 py-2">
//                       {row.itemCode || "-"}
//                       {row._importStatus === 'CHANGED' && <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">CHANGED</span>}
//                       {row._importStatus === 'NEW'     && <span className="ml-1 rounded bg-green-600 px-1 py-0.5 text-[10px] font-semibold text-white">NEW</span>}
//                     </td>
//                     <td className="border border-gray-300 px-2 py-2">{row.qty || "-"}</td>
//                     <td className="border border-gray-300 px-2 py-2">{row.noOfCuts || "-"}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.purchaseRate || 0)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{row.discount || 0}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.finalPrice || 0)}</td>
//                     {/* taxable, GST and net through lib/grcMoney.js - the same
//                         three figures the totals bar and the save add up, so a
//                         line and the total below it can never disagree */}
//                     <td className="border border-gray-300 px-2 py-2">{money(rowTaxable(row))}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(rowGst(row))}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(rowNet(row))}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.rsp || row.retailPrice || 0)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.wsp || 0)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{money(row.dp || 0)}</td>
//                     <td className="border border-gray-300 px-2 py-2">{row.uniqueBarcode || "No"}</td>
//                     {/* Barcode No is the saved record's own barcodeNo, as stored
//                         ("9A1163") - never barcodeGenerated ("G1319 * 05183 *
//                         1 * 1"), and never a value worked out here. A row not
//                         saved yet has none until Submit gives it one. */}
//                     <td className="border border-gray-300 px-2 py-2"><input value={(row._id && row.barcodeNo) || ""} disabled className="w-52 rounded border border-gray-200 bg-gray-100 px-2 py-1 font-mono text-gray-500" aria-label="System generated barcode" /></td>
//                     {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2">{row.customFields?.[field] || "-"}</td>)}
//                     {/* Not Tab stops: this table has no inputs, so Tab out of
//                         the Add Item form ran through the toolbar straight onto
//                         row 1's Delete - which removes an unsaved row with no
//                         confirm. Deleting stays a deliberate click. */}
//                     <td className="border border-gray-300 px-2 py-2"><div className="flex gap-2"><button type="button" tabIndex={-1} className="text-blue-600 hover:underline">Edit</button><button type="button" tabIndex={-1} onClick={() => { if (!row._id || window.confirm(`Remove barcode ${row.barcodeNo || ""}? It will be deleted from this GRC when you click Submit.`)) removeRow(row); }} disabled={isLockedRow(row)} title={lockReason(row) || undefined} className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">Delete</button></div></td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           )}
//         </div>
//       </div>

//       <div className="mt-4 flex items-center justify-end gap-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm">
//         <div className="flex items-center gap-2"><span className="text-gray-500">Total Taxable</span><span className="font-mono font-semibold text-gray-800">₹ {money(totals.taxable)}</span></div>
//         <div className="flex items-center gap-2"><span className="text-gray-500">Total GST</span><span className="font-mono font-semibold text-gray-800">₹ {money(totals.gst)}</span></div>
//         <div className="flex items-center gap-2"><span className="text-gray-500">Grand Total</span><span className="font-mono font-bold text-indigo-700">₹ {money(totals.net)}</span></div>
//       </div>

//       {/* The picker deliberately receives the rows and nothing else. What a
//           label may carry is decided by toLabelData (lib/barcodeLabelPrint.js),
//           which whitelists it: the supplier's name and code, the GRC number and
//           the bill serial never reach a label. They used to be handed down here
//           for a "provenance line" on the sticker; that line is gone. */}
//       {/* Only saved barcodes, as saved, are printable: a label carries the
//           stored value (SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SEQ) and nothing
//           else. A row not saved yet, or with an edit not saved yet, prints
//           after Submit - see saveRows. */}
//       <PrintLabelPicker rows={printRows.length ? printRows : validRows.filter((row) => row._id && !row._edited)} open={showPrint} onClose={() => { setShowPrint(false); setPrintRows([]); }} />

//       {showSaveConfirm && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="w-full max-w-[520px] rounded-lg bg-white p-5 shadow-xl">
//             <h3 className="text-lg font-semibold text-gray-800">Confirm submit</h3>
//             <p className="mt-2 text-sm text-gray-600">Do you want to save all generated barcode rows?</p>
//             <div className="mt-5 flex justify-end gap-2">
//               <button type="button" onClick={() => setShowSaveConfirm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
//               <button type="button" onClick={() => saveRows(validRows, false)} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Submit"}</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Pinned to the viewport's bottom-right, which is the content area's
//           bottom-right too - the sidebar is on the left. z-40 keeps it above
//           the Items table's sticky/relative layers (without it they painted
//           over the bar mid-scroll) and below the z-50 dialogs; the root's pb-24
//           lets the last rows and totals scroll clear of it. Portal ensures the
//           button is rendered at document body level, preventing it from moving
//           with any parent scroll containers. */}
//       {typeof document !== 'undefined' && createPortal(
//         <div ref={submitBarRef} className="no-print fixed bottom-4 right-4 z-40 flex items-center gap-2">
//           {validRows.some((r) => r._importStatus === 'CHANGED') && (
//             <button
//               type="button"
//               onClick={() => {
//                 const changedRows = validRows.filter((r) => r._importStatus === 'CHANGED');
//                 if (window.confirm(`Generate barcodes for ${changedRows.length} changed row${changedRows.length === 1 ? '' : 's'} only?`)) {
//                   saveRows(changedRows, false);
//                 }
//               }}
//               disabled={saving}
//               className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 disabled:opacity-60"
//               title="Save only the rows that were changed during the last import"
//             >
//               {saving ? "Saving..." : `Generate For Changes (${validRows.filter((r) => r._importStatus === 'CHANGED').length})`}
//             </button>
//           )}
//           <button type="button" onClick={() => setShowSaveConfirm(true)} disabled={saving} className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60">Submit</button>
//         </div>,
//         document.body
//       )}
//     </div>
//   );
// }

// export { modeFromUom, usesMeterCuts, buildMeterCutPlan };



























"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useScope } from "./ScopeContext";
import GrcBarcodeLabelSheet from "./GrcBarcodeLabel";
/* One geometry module for the sticker stock - the same one the label
   renderer lays a label out with and the GRC Barcode Print page prints
   from, so the preview here cannot be measured differently. */
import { labelRun } from "@/lib/barcodeLabelGeometry";
import { useOptions } from "./useOptions";
import { useBarcodeLookup } from "./useScanner";
import Icon from "./Icon";
import { computeSampleBarcode } from "@/lib/barcodeFormat";
import { encodeRate } from "@/lib/purchaseRateCode";
import { gstPercentForAmount, slabGstPercent } from "@/lib/hsnGst";
import { purchasePriceError } from "@/lib/purchasePrice";
import { toGridRow, pmfOf, PMF_REQUIRED_MESSAGE } from "@/lib/barcodeRowSync";
import { grcTotals, r2, rowQty, rowTaxable, rowGst, rowNet } from "@/lib/grcMoney";
import {
  money, finalRateOf, sameValue, sheetColumns, sheetProblems, isLockedRow, lockReason, isBlankRow,
  SHEET_INHERITED_FIELDS, ITEM_FIELD_LABELS,
} from "@/lib/itemsSheet";
import ItemsSheet from "./ItemsSheet";
import {
  generateBarcodeValue, composedValueOf, unitNumberOf, parseBarcodeValue,
  billSlNoForBarcode, highestSerialNo, serialFloorOf,
} from "@/lib/barcodeValue";
import {
  LABEL_MODE, resolveLabelMode, batchAvailableQty, withLabelCounts, pendingBatchRows, labelKey,
  isUnprintableBatch,
} from "@/lib/barcodeLabelPrint";
import {
  formDefaultsFromSetup, unmappedSetupFields, setupStatusMessage, setupIdentity, formatSetupValue,
} from "@/lib/supplierPriceSetup";
import BatchLabelCountDialog from "./BatchLabelCountDialog";
import * as XLSX from "xlsx";

/* money(), sameValue() and finalRateOf() live in lib/itemsSheet.js, shared
   with the ITEMS sheet so the grid formats and re-derives prices exactly as
   the rest of this screen does. */

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const decimal2 = (value) => {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  const dot = raw.indexOf('.');
  if (dot < 0) return raw;
  return raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
};
const fixed2 = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '');

/* THE ADD ITEM FORM'S REQUIRED FIELDS, checked before Submit and Submit &
   Print Label - both go through submit(), so neither can skip them.
   Returns { formKey: message } in the order the fields sit on the form (the
   first is the one focused). Blank, null, undefined and non-numbers are
   refused; the Purchase Rate keeps its own rule (purchasePriceError: above
   0). An MTR entry has No. of Cuts where a piece entry has Quantity. */
const DISCOUNT_TYPES = ["Percentage", "Flat"];
const REQUIRED_NUMBERS = [
  ["purchaseRate", "Purchase Rate"],
  ["discountType", "Discount Type"],
  ["discount", "Discount"],
  ["finalPrice", "Final Price"],
  ["markupRSP", "Markup RSP %"],
  ["rspPrice", "RSP Price"],
  ["markupWSP", "Markup WSP %"],
  ["wspPrice", "WSP Price"],
  ["markupDP", "Markup E-COMM %"],
  ["dpPrice", "E-COMM Price"],
];
const REQUIRED_LABELS = Object.fromEntries([["qty", "Quantity"], ["noOfCuts", "No. of Cuts"], ...REQUIRED_NUMBERS]);
function requiredFieldErrors(form) {
  const errors = {};
  const blank = (value) => value === null || value === undefined || String(value).trim() === "";
  const notNumber = (value) => !Number.isFinite(Number(String(value).trim()));
  const [countKey, countLabel] = form?.isMtr ? ["noOfCuts", "No. of Cuts"] : ["qty", "Quantity"];
  const count = form?.[countKey];
  if (blank(count)) errors[countKey] = `${countLabel} is required`;
  else if (notNumber(count)) errors[countKey] = `${countLabel} must be a number`;
  else if (!(Number(count) > 0)) errors[countKey] = `${countLabel} must be greater than 0`;
  for (const [key, label] of REQUIRED_NUMBERS) {
    const value = form?.[key];
    if (key === "discountType") {
      if (!DISCOUNT_TYPES.includes(value)) errors[key] = `${label} is required`;
      continue;
    }
    if (blank(value)) errors[key] = `${label} is required`;
    else if (notNumber(value)) errors[key] = `${label} must be a number`;
    else if (key === "purchaseRate") {
      const problem = purchasePriceError(value);
      if (problem) errors[key] = problem;
    }
  }
  return errors;
}
/* the Add Item form's three offer percentages */
const OFFER_PCT_KEYS = ["rspOfferPct", "wspOfferPct", "dpOfferPct"];
/* start of the notice shown when saved rows get their GST% from HSN Master
   (an action for the operator - the banner shows it in amber) */
const GST_FILL_NOTICE = "GST% was missing";

/* BILL SL NO. IS HIDDEN, NOT REMOVED (2026-09-17, at the business's request).

   The Add Item form no longer shows or asks for it. It is still the third
   part of every barcode value (SUPPLIER * GRC * BILL_SL_NO * SERIAL_NO), so
   the form keeps carrying it exactly as before - form.serialNo, starting at 1
   and carried from one entry to the next - and the Item Summary and Excel
   columns still show and accept it. Set this back to true to show the two
   Bill Sl No. boxes and their "required" checks again. */
const SHOW_BILL_SL_NO = false;

/* THE "SUPPLIER PRICE CALCULATION SETUP" BOX IS HIDDEN, NOT REMOVED
   (2026-09-17, at the business's request). The supplier's setup still fills
   Discount Type, Discount and the three markups exactly as before, and its
   Round Off values still apply - only the read-only box above the Price
   Calculation inputs is not shown. Set this back to true to show it again. */
const SHOW_SUPPLIER_PRICE_SETUP = false;

/* The initialRows default. A fresh [] on every render made the effect that
   loads them run after every render - on the standalone screen, which passes
   none, that re-rendered for ever and wiped each row as it was added. */
const NO_ROWS = [];

/* HSN Master stores a tax slab as a reference to a Tax record plus a price
   band; the barcode screen needs the percentage. Tax records do not move
   during a session and one HSN routinely points several slabs at the same
   record, so each is fetched once and remembered for the life of the page. */
const taxRateCache = new Map();

async function fetchTaxRate(taxId) {
  const key = String(taxId || "");
  if (!key) return 0;
  if (taxRateCache.has(key)) return taxRateCache.get(key);

  try {
    const response = await fetch(`/api/tax/${key}`);
    /* a failed read is not a 0% rate - leave it uncached so the next lookup
       asks again */
    if (!response.ok) return 0;
    const payload = await response.json();
    const rate = slabGstPercent(payload?.doc || {});
    taxRateCache.set(key, rate);
    return rate;
  } catch {
    return 0;
  }
}

/* An HSN's raw taxSlabs -> the same bands with their rates filled in, which is
   the shape /api/item/<id>/detail already returns, so both routes into the
   form hand the slab picker identical rows. */
async function resolveSlabRates(taxSlabs) {
  const rows = Array.isArray(taxSlabs) ? taxSlabs.filter(Boolean) : [];
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((s) => String(s.gstTaxNameId || "")).filter(Boolean))];
  const pairs = await Promise.all(ids.map(async (id) => [id, await fetchTaxRate(id)]));
  const rates = new Map(pairs);

  return rows.map((s) => ({
    amountFrom: s.amountFrom,
    amountTo: s.amountTo,
    igst: rates.get(String(s.gstTaxNameId || "")) || 0,
  }));
}

const meterRegex = /(mtr|meter|metre|meters|metres)/i;
const pcRegex = /(pc|pcs|piece|pieces)/i;

/* Export Excel's headings - the same list, in the same order, as the ITEMS
   grid's columns (lib/itemsSheet.js), so a sheet and a workbook agree. */
const exportFieldLabels = ITEM_FIELD_LABELS;

/* These four columns were exported under "DP ..." before the label became
   E-COMM. A workbook exported back then is still a perfectly good file to
   import today, so the old headings keep resolving to the same keys. Without
   this they would stop matching, fall through to customFields, and the three
   E-COMM prices would silently arrive empty - which reads as lost data, not
   as a rename. The keys are unchanged; only what the heading says moved. */
const legacyExportHeaders = {
  "DP": "dp",
  "DP Offer Price": "dpPrice",
  "DP Offer %": "dpOfferPct",
  "Markup DP %": "markupDP",
};

const normalizeExportHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/* Universal Excel converter - converts ANY Excel format to ERP template format.
   Maps the column-name variations seen in exported and external workbooks to
   the grid's keys; anything unrecognised is kept as a custom field.

   Every column Export Excel writes maps back to its own key, so an exported
   sheet can be edited and imported again. The E-COMM and markup columns used
   to be dropped here, which silently threw away an edited E-COMM price. */
function convertToERPTemplate(rawHeaders, rawRows) {
  // Column mapping: external format → ERP key
  const columnMap = {
    'attributeaddon': 'goodsType',
    'goodstype': 'goodsType',
    'itemcode': 'itemCode',
    'itemname': 'itemName',
    'hsn': 'hsn',
    'gst': 'gst',
    'uom': 'uom',
    'quantity': 'qty',
    'noofcuts': 'noOfCuts',
    'totalmtr': 'totalMtr',
    /* the column was headed "Serial No" for years, so a workbook exported
       before the rename still imports into the same field */
    'serialno': 'billSlNo',
    'billslno': 'billSlNo',
    'purchaserate': 'purchaseRate',
    'discounttype': 'discountType',
    'discount': 'discount',
    'finalprice': 'finalPrice',
    'retailprice': 'retailPrice',
    'disc1': 'disc1',
    'uniquebarcode': 'uniqueBarcode',
    'barcodeno': 'barcodeNo',
    'supplierdescription': 'supplierDescription',
    'printdescription': 'printDescription',
    'rsp': 'rsp',
    'rspoffer': 'rspOfferPct',
    'offerprice': 'offerPrice',
    'wsp': 'wsp',
    'wspoffer': 'wspOfferPct',
    'wspofferprice': 'wspPrice',
    'dp': 'dp',
    'dpoffer': 'dpOfferPct',
    'dpofferprice': 'dpPrice',
    'ecomm': 'dp',
    'ecommoffer': 'dpOfferPct',
    'ecommofferprice': 'dpPrice',
    'markuprsp': 'markupRSP',
    'markupwsp': 'markupWSP',
    'markupecomm': 'markupDP',
    'markupdp': 'markupDP',
    'sm': 'sm',
    'smnumber': 'sm',
    'pmf': 'p_m_f',
  };

  // Build header mapping
  const headerMapping = new Map();
  rawHeaders.forEach((header, index) => {
    const normalized = normalizeExportHeader(header);
    
    const erpKey = columnMap[normalized];
    if (erpKey) {
      headerMapping.set(index, erpKey);
    } else if (header && header.trim()) {
      // Unknown column → custom field
      headerMapping.set(index, { customField: header.trim() });
    }
  });

  // Convert rows
  return rawRows.map((values) => {
    const result = {};
    const customFields = {};

    headerMapping.forEach((mapping, index) => {
      const value = values[index] ?? "";
      
      if (typeof mapping === 'string') {
        // Standard ERP field
        result[mapping] = NUMERIC_IMPORT_KEYS.has(mapping) ? importNumber(value) : value;
      } else if (mapping.customField) {
        // Custom field
        customFields[mapping.customField] = value;
      }
    });

    if (Object.keys(customFields).length > 0) {
      result.customFields = customFields;
    }

    return result;
  });
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });

        // Auto-detect sheet: prefer "Barcode Items", else use the first sheet (never the snapshot)
        const visible = workbook.SheetNames.filter((name) => name !== EXPORT_SNAPSHOT_SHEET);
        let sheetName = visible[0] || workbook.SheetNames[0];
        const barcodeSheet = visible.find((name) =>
          name.toLowerCase().includes('barcode') || name.toLowerCase().includes('items')
        );
        if (barcodeSheet) sheetName = barcodeSheet;

        const sheet = workbook.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

        if (sheetRows.length === 0) {
          throw new Error("The Excel file is empty.");
        }

        const rawHeaders = (sheetRows[0] || []).map((header) => String(header || "").trim());
        if (rawHeaders.length === 0) {
          throw new Error("The Excel file does not contain a header row.");
        }

        // Convert to ERP template format
        const convertedRows = convertToERPTemplate(rawHeaders, sheetRows.slice(1));

        // Validate critical columns
        const hasCriticalColumn = convertedRows.some((row) => row.itemCode || row.itemName || row.barcodeNo);
        if (!hasCriticalColumn && convertedRows.length > 0) {
          throw new Error("Invalid template: Item Code, Item Name, or Barcode No column not found");
        }

        // Filter out completely empty rows
        const rows = convertedRows.filter((row) =>
          Object.keys(row).some((key) => key !== "customFields" && row[key] !== "") ||
          Object.values(row.customFields || {}).some((value) => value !== "")
        );

        /* The hidden snapshot Export Excel writes: every exported row as it
           was, by Barcode No. Absent from older exports and other files. */
        let snapshot = null;
        const snapshotSheet = workbook.Sheets[EXPORT_SNAPSHOT_SHEET];
        if (snapshotSheet) {
          const snapRows = XLSX.utils.sheet_to_json(snapshotSheet, { header: 1, defval: "", raw: false });
          const snapHeaders = (snapRows[0] || []).map((header) => String(header || "").trim());
          snapshot = new Map(
            convertToERPTemplate(snapHeaders, snapRows.slice(1))
              .filter((row) => String(row.barcodeNo || "").trim())
              .map((row) => [String(row.barcodeNo).trim(), row])
          );
        }

        resolve({ rows, snapshot });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Unable to read the Excel file."));
    reader.readAsArrayBuffer(file);
  });
}

function rowMatchKey(row) {
  const barcode = String(row?.barcodeNo || "").trim();
  if (barcode) return `barcode:${barcode}`;
  return rowItemKey(row);
}

function rowItemKey(row) {
  const itemCode = String(row?.itemCode || "").trim();
  const serial = String(row?.billSlNo || "").trim();
  return itemCode || serial ? `item:${itemCode}|serial:${serial}` : null;
}

/* Money, quantity and percentage cells come back as the text Excel displays
   (sheet_to_json raw: false), so a price typed as 1,980 or ₹1,980 or a GST of
   5% arrives with its separators and reads as NaN wherever it is added up.
   Stripped here; anything still not a number is left exactly as typed so the
   import's own checks can report it. */
const NUMERIC_IMPORT_KEYS = new Set([
  "qty", "noOfCuts", "totalMtr", "purchaseRate", "discount", "finalPrice", "retailPrice", "disc1", "gst",
  "rsp", "rspOfferPct", "offerPrice", "wsp", "wspOfferPct", "wspPrice", "dp", "dpOfferPct", "dpPrice",
  "markupRSP", "markupWSP", "markupDP",
]);

function importNumber(value) {
  const text = String(value ?? "").trim();
  const cleaned = text.replace(/[,\s₹%]/g, "");
  return cleaned !== "" && Number.isFinite(Number(cleaned)) ? cleaned : text;
}


/* Export Excel writes this sheet, very hidden, beside "Barcode Items": every
   row exactly as it was exported. Import compares each sheet row with its
   snapshot row, so it knows which cells the operator actually changed.

   That is the only reliable way to read this template, which carries several
   prices twice - RSP and Retail Price are one stored value, WSP and WSP Offer
   Price another - because an operator edits one of a pair and leaves the
   other as exported. Judged from the sheet alone the untouched copy looks
   like an edit (an edited Retail Price was thrown away in favour of the stale
   RSP beside it); judged against the grid, the same sheet imported a second
   time undoes the first import. With the snapshot any one column can be
   edited, re-importing changes nothing more, and a cell nobody touched never
   overwrites the saved value. */
const EXPORT_SNAPSHOT_SHEET = "Export Snapshot";

/* The cells of a sheet row that differ from that row as it was exported. */
function changedCells(importedRow, original) {
  const changes = { barcodeNo: importedRow.barcodeNo };
  Object.keys(importedRow).forEach((key) => {
    if (key !== "customFields" && key !== "barcodeNo" && !sameValue(importedRow[key], original[key])) {
      changes[key] = importedRow[key];
    }
  });
  const custom = Object.entries(importedRow.customFields || {})
    .filter(([key, value]) => !sameValue(value, original.customFields?.[key]));
  if (custom.length) changes.customFields = Object.fromEntries(custom);
  return changes;
}

/* Prices the template carries twice. RSP and Retail Price are the same stored
   price (retailPrice). WSP and E-COMM are stored only as their offer price
   (wspPrice, dpPrice) - the base less its offer % - and rsp / wsp / dp
   themselves are never saved, so the stored side is the one that must move. */
const PRICE_PAIRS = [
  { base: "rsp", stored: "retailPrice", pct: null, label: "RSP", storedLabel: "Retail Price" },
  { base: "wsp", stored: "wspPrice", pct: "wspOfferPct", label: "WSP", storedLabel: "WSP Offer Price" },
  { base: "dp", stored: "dpPrice", pct: "dpOfferPct", label: "E-COMM", storedLabel: "E-COMM Offer Price" },
];

/* Whether applying an import actually changed a grid row. */
function rowDiffers(next, before) {
  return Object.keys(next).some((key) => key !== "id" && (key === "customFields"
    ? JSON.stringify(next.customFields || {}) !== JSON.stringify(before.customFields || {})
    : !sameValue(next[key], before[key])));
}

function offerFrom(base, pct) {
  const text = String(base ?? "").trim();
  return pct > 0 && text !== "" && Number.isFinite(Number(text)) ? fixed2(Number(text) * (1 - pct / 100)) : base;
}


/* A row whose two copies of one price disagree cannot be applied without
   guessing which was meant, so it is refused. `tracked` = read against the
   export snapshot, where only a pair changed on BOTH sides can disagree. */
function priceConflicts(changes, existing, tracked) {
  const given = (key) => key in changes && (tracked || String(changes[key] ?? "").trim() !== "");
  return PRICE_PAIRS.filter(({ base, stored, pct }) => {
    if (!given(base) || !given(stored)) return false;
    const rate = pct ? Number(pct in changes ? changes[pct] : existing?.[pct]) || 0 : 0;
    return !sameValue(changes[stored], offerFrom(changes[base], rate));
  }).map(({ base, stored, label, storedLabel }) =>
    `${label} (${changes[base]}) and ${storedLabel} (${changes[stored]}) ` +
    (tracked
      ? "were both changed, to different prices - change only one of them"
      : "disagree, but they are the same price - make them equal, or Export Excel again and change just one"));
}

/* A sheet without an export snapshot - exported before snapshots existed, or
   made elsewhere - still carries both copies of each price, and an operator
   changes one of them. When the copies disagree, the one still equal to the
   unit's saved price is the untouched copy and the other is the change, so
   that is the one taken. The decision is remembered per unit (`memory`, kept
   in localStorage): importing the same sheet again after saving - when it is
   the CHANGED copy that now equals the saved price - repeats the decision
   instead of flipping back. Only a pair where BOTH copies differ from the
   saved price is refused, since nothing says which was meant. */
const PRICE_MEMORY_KEY = "gcr-import-price-choices";

function resolveUntrackedPairs(sheetRow, existing, memory, memoryKey) {
  const changes = { ...sheetRow };
  const picks = [];
  const ambiguous = [];
  const filled = (key) => key in sheetRow && String(sheetRow[key] ?? "").trim() !== "";
  PRICE_PAIRS.forEach(({ base, stored, pct, label, storedLabel }) => {
    if (!filled(base) || !filled(stored)) return;
    const rate = pct ? Number(pct in sheetRow ? sheetRow[pct] : existing?.[pct]) || 0 : 0;
    const fromBase = offerFrom(sheetRow[base], rate);
    if (sameValue(sheetRow[stored], fromBase)) return;                 // the two copies agree
    const key = memoryKey(label);
    const remembered = memory[key];
    let pick = remembered && sameValue(remembered.base, sheetRow[base]) && sameValue(remembered.stored, sheetRow[stored])
      ? remembered.pick : null;
    if (!pick && existing) {
      const baseIsSaved = sameValue(fromBase, existing[stored]);
      const storedIsSaved = sameValue(sheetRow[stored], existing[stored]);
      if (storedIsSaved && !baseIsSaved) pick = "base";
      else if (baseIsSaved && !storedIsSaved) pick = "stored";
    }
    if (!pick) {
      ambiguous.push(existing
        ? `${label} (${sheetRow[base]}) and ${storedLabel} (${sheetRow[stored]}) are one price and both differ from the saved ${existing[stored] || "value"} - make them equal`
        : `${label} (${sheetRow[base]}) and ${storedLabel} (${sheetRow[stored]}) are one price - make them equal`);
      return;
    }
    memory[key] = { base: sheetRow[base], stored: sheetRow[stored], pick };
    if (pick === "base") {
      delete changes[stored];
      picks.push({ used: label, value: sheetRow[base], ignored: storedLabel, stale: sheetRow[stored] });
    } else {
      delete changes[base];
      picks.push({ used: storedLabel, value: sheetRow[stored], ignored: label, stale: sheetRow[base] });
    }
  });
  return { changes, picks, ambiguous };
}

/* What one imported sheet row does to the grid row it matched - or to a blank
   row when it is new. `changes` is only what the operator changed when the
   sheet carries its export snapshot (`original`), otherwise the whole sheet
   row. Those values are written, then everything the grid holds twice or
   derives is brought back in line, because the save reads the OTHER copy:

     - a changed RSP / Retail Price, WSP / WSP Offer Price or E-COMM / E-COMM
       Offer Price moves both of its pair (the offer % applied), so the stored
       price - the one the save keeps - carries the change;
     - Offer Price, which the label, the till and the GRC total sell at first,
       follows a changed RSP when no offer was running; a running offer is
       kept and reported, never re-priced by a formula of its own;
     - a changed Purchase Rate re-derives Final Price by the Add Item rule
       when the row's discount is known, and is re-encoded for the label;
     - purRate / finalNet / encodedPurRate are the stored names of
       purchaseRate / finalPrice / encodedPurchaseRate. A row loaded from the
       database carries both and the save prefers the stored one, so they are
       set from the grid names;
     - P-M-F falls back to the Attribute Add On, as it does for a saved row. */
function mergeImportedRow(existing, changes, { id, barcodeNo, rateCodeMapping, original = null, onNote = () => {} }) {
  const tracked = Boolean(original);
  const next = {
    ...(existing || emptyRow(id)),
    ...changes,
    id,
    barcodeNo,
    customFields: { ...(existing?.customFields || {}), ...(changes.customFields || {}) },
  };
  // tracked: every key in `changes` was edited; untracked: a filled cell counts
  const given = (key) => key in changes && (tracked || String(changes[key] ?? "").trim() !== "");
  const pctOf = (key) => Number(next[key]) || 0;

  PRICE_PAIRS.forEach(({ base, stored, pct }) => {
    const rate = pct ? pctOf(pct) : 0;
    if (given(stored)) {
      if (!given(base) && !(rate > 0)) next[base] = next[stored];
    } else if (given(base) || (pct && given(pct))) {
      next[stored] = offerFrom(next[base], rate);
    }
  });

  if (given("rsp") || given("retailPrice")) {
    const rate = pctOf("rspOfferPct");
    const offerBefore = tracked ? original.offerPrice : existing?.offerPrice;
    const retailBefore = tracked ? original.retailPrice : existing?.retailPrice;
    if (given("offerPrice")) {
      /* an Offer Price in the sheet is kept as typed - except, in a sheet
         without a snapshot, one still equal to that sheet's own retail price,
         which is the exported "no offer" copy */
      const sheetRetail = ["retailPrice", "rsp"].filter(given).map((key) => changes[key]);
      if (!tracked && sheetRetail.some((value) => sameValue(changes.offerPrice, value))) {
        next.offerPrice = next.retailPrice;
      } else if (existing && String(next.offerPrice ?? "").trim() && !sameValue(next.offerPrice, next.retailPrice)
        && (!String(existing.offerPrice ?? "").trim() || sameValue(existing.offerPrice, existing.retailPrice))) {
        onNote("offerStarted");
      }
    } else if (rate > 0) {
      next.offerPrice = offerFrom(next.retailPrice, rate);
    } else if (!tracked && "offerPrice" in changes) {
      // a blank Offer Price cell: no offer
    } else if (!String(offerBefore ?? "").trim()) {
      // there was no offer, and there still is none
    } else if (sameValue(offerBefore, retailBefore)) {
      next.offerPrice = next.retailPrice;
    } else if (!sameValue(next.retailPrice, retailBefore)) {
      onNote("offerKept");
    }
  }

  const rateEdited = given("purchaseRate") || given("discount") || given("discountType") || given("disc1");
  if (rateEdited && !given("finalPrice")) {
    const before = tracked ? original : existing;
    const discountKnown = !before || sameValue(before.finalPrice, round2(finalRateOf(before)));
    if (discountKnown) next.finalPrice = String(round2(finalRateOf(next)));
    else onNote("finalKept");
  }

  next.purRate = next.purchaseRate;
  next.finalNet = next.finalPrice;
  if (!existing || (given("purchaseRate") && !sameValue(next.purchaseRate, existing.purchaseRate))) {
    next.encodedPurchaseRate = encodeRate(String(next.purchaseRate ?? ""), rateCodeMapping);
  }
  next.encodedPurRate = next.encodedPurchaseRate;

  if (!String(next.p_m_f || "").trim() && next.goodsType === "P-M-F") next.p_m_f = "P-M-F";
  return next;
}

function customFieldNames(rows) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row?.customFields || {}))));
}

function modeFromUom(uom, uniqueBarcode = "No") {
  const value = String(uom || "").trim();
  if (meterRegex.test(value)) return "batch";
  if (pcRegex.test(value)) return "unique";
  return String(uniqueBarcode).toLowerCase() === "yes" ? "unique" : "batch";
}

function usesMeterCuts(row) {
  return meterRegex.test(String(row?.uom || "")) && String(row?.uniqueBarcode || "No").toLowerCase() === "yes";
}

function buildMeterCutPlan({ totalMtr = 0, qtyOrCuts = 1, uniqueBarcode = false }) {
  const cuts = Math.max(1, Number(qtyOrCuts) || 1);
  const total = Math.max(0, Number(totalMtr) || 0);
  const plan = [];
  let remaining = total;

  for (let i = 0; i < cuts; i += 1) {
    const share = i === 0 ? total : remaining;
    if (i < cuts - 1) remaining = Math.max(0, remaining - share);
    plan.push({
      index: i + 1,
      value: Number(share || 0),
      shareBarcode: !uniqueBarcode,
      groupId: uniqueBarcode ? `meter-${i + 1}` : "meter-shared",
    });
  }

  return plan;
}

function makeMeterCutRows(count = 1, totalMtr = 0) {
  const safeCount = Math.max(1, Number(count || 1));
  void totalMtr;

  return Array.from({ length: safeCount }, (_, index) => ({
    id: index + 1,
    value: "",
  }));
}

/* CUTS (MTR) - every box holds only what the operator typed into it.

   The balance (Total MTR less the cuts entered) is shown beside the boxes and
   never written into one: this used to put the remaining metres into the
   first blank cut on blur, so after 60 of 114 the next box already held 54
   and had to be backspaced out before the real cut could be typed. */

/* Metres actually entered - a blank or zero box is not a cut. */
function sumCutRows(rows = []) {
  return round2(rows.reduce((sum, row) => {
    const value = Number(row?.value || 0);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0));
}

/* No. of Cuts changed or + pressed: the rows already there keep their values;
   rows are added EMPTY, or dropped from the end. */
function resizeCutRows(rows = [], count = 1) {
  const safeCount = Math.max(1, Math.floor(Number(count)) || 1);
  const next = rows.slice(0, safeCount);
  let lastId = next.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0);
  while (next.length < safeCount) next.push({ id: ++lastId, value: "" });
  return next;
}

/* An edit that would take the cuts past Total MTR is refused, and the message
   names the metres still free for that box - the value is never trimmed to
   fit. An edit that does not raise the total always stands, so cuts left over
   the limit by a later change to Total MTR can still be worked back down.
   Returns "" when the edit may stand; with no Total MTR there is no limit. */
function cutEditError(rows, index, nextValue, totalMtr) {
  const available = round2(Number(totalMtr || 0));
  if (!Number.isFinite(available) || available <= 0) return "";
  const nextTotal = sumCutRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, value: nextValue } : row)));
  if (nextTotal <= available || nextTotal <= sumCutRows(rows)) return "";
  const balance = Math.max(0, round2(available - sumCutRows(rows.filter((_, rowIndex) => rowIndex !== index))));
  return `Cut quantity cannot exceed the available balance of ${balance} MTR.`;
}

function emptyRow(id) {
  return {
    id,
    /* the barcode physically on the incoming goods - the vendor's own printed
       number. It identifies the item, and is carried through to the saved
       label so the new barcode stays traceable back to the old one. */
    oldBarcode: "",
    itemCode: "",
    itemName: "",
    goodsType: "",
    hsn: "",
    gst: "",
    uom: "",
    qty: "",
    noOfCuts: "",
    totalMtr: "",
    purchaseRate: "",
    discountType: "Percentage",
    discount: "0",
    finalPrice: "",
    retailPrice: "",
    disc1: "",
    uniqueBarcode: "No",
    barcodeNo: "",
    supplierDescription: "",
    printDescription: "",
    mode: "unique",
    groupId: null,
    groupSize: 1,
    billSlNo: "",
    rsp: "",
    wsp: "",
    dp: "",
  };
}

function isDateActive(row, date = new Date()) {
  const effectiveDate = row?.effectiveDate ? new Date(row.effectiveDate) : null;
  const expiryDate = row?.expiryDate ? new Date(row.expiryDate) : null;
  const validEffective = !effectiveDate || (Number.isFinite(effectiveDate.getTime()) && effectiveDate <= date);
  const validExpiry = !expiryDate || (Number.isFinite(expiryDate.getTime()) && expiryDate >= date);
  return validEffective && validExpiry;
}

function buildBarcodePlan({ uom, uniqueBarcode, qtyOrCuts, totalMtr, cutRows = [] }) {
  const meterMode = meterRegex.test(String(uom || ""));
  const targetQty = Math.max(1, Number(qtyOrCuts || 1));

  if (meterMode) {
    const meterValues = cutRows.length > 0
      ? cutRows.map((cut) => Number(cut.value || 0)).filter((value) => Number.isFinite(value) && value > 0)
      : [Math.max(0, Number(totalMtr || 0)) || 1];

    if (uniqueBarcode) {
      return meterValues.map((value, index) => ({
        qty: Number(value || 0),
        groupId: `meter-${index + 1}`,
        groupSize: 1,
        shareBarcode: false,
      }));
    }

    const sharedValue = meterValues.reduce((sum, value) => sum + Number(value || 0), 0) || targetQty;
    return [{
      qty: sharedValue,
      groupId: "meter-shared",
      groupSize: Math.max(1, meterValues.length),
      shareBarcode: true,
    }];
  }

  if (uniqueBarcode) {
    return Array.from({ length: targetQty }, (_, index) => ({
      qty: 1,
      groupId: `pc-${index + 1}`,
      groupSize: 1,
      shareBarcode: false,
    }));
  }

  return [{
    qty: targetQty,
    groupId: "pc-shared",
    groupSize: 1,
    shareBarcode: true,
  }];
}

function calculatePrices(row) {
  const finalValue = finalRateOf(row);

  /* The markups are the row's own - the Add Item form starts them from the
     supplier's Price Calculation Setup. No percentage is assumed for a blank
     one: it used to be 100 / 15 / 15 here, which priced a row by numbers
     nobody had entered. */
  const rsp = finalValue * (1 + Number(row.markupRSP || 0) / 100);
  const wsp = finalValue * (1 + Number(row.markupWSP || 0) / 100);
  const dp = finalValue * (1 + Number(row.markupDP || 0) / 100);

  return {
    ...row,
    finalPrice: round2(finalValue),
    rsp: round2(rsp),
    wsp: round2(wsp),
    dp: round2(dp),
  };
}

/* Searchable combobox used for Item Code and HSN.
   Queries the server as the user types (debounced 300 ms).
   value  = the stored id/code string
   label  = what the user sees in the closed field
   onSearch(q) called as user types
   onSelect(optionObject) called on selection
   onClear() called when × is clicked
   editableSelection - keep the picked value in a real text box (HSN): clicking
     it edits that text character by character instead of opening an empty
     search whose placeholder merely looks like the value. */
function SearchSelect({ placeholder, value, label, onSearch, options, loading, onSelect, onClear, editableClass, editableSelection = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlighted(0); }, [options]);

  const handleKey = (e) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); onSearch(query); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[highlighted]) { onSelect(options[highlighted]); setOpen(false); setQuery(''); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const isSelected = Boolean(value);
  const selectedText = String(label || value || '');
  const openWithSelectedText = () => {
    if (open) return;
    setQuery(selectedText);
    setOpen(true);
    onSearch(selectedText);
  };

  return (
    <div ref={containerRef} className="relative">
      {editableSelection ? (
        /* always an input: closed it shows the picked text, open it edits a
           copy of that text. Focus seeds the copy with the same string, so the
           caret the click placed stays where it landed. */
        <div className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${editableClass}`}>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
            placeholder={placeholder}
            value={open ? query : selectedText}
            onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); setOpen(true); }}
            onFocus={openWithSelectedText}
            /* still focused after a pick or Escape: a click reopens it */
            onClick={openWithSelectedText}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { openWithSelectedText(); return; }
              handleKey(e);
            }}
            autoComplete="off"
          />
          {loading
            ? <span className="shrink-0 text-[11px] text-gray-400">…</span>
            : isSelected
              ? <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onClear(); setQuery(''); setOpen(false); }}
                  className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Clear" tabIndex={-1}>✕</button>
              : <span className="shrink-0 text-gray-400 text-[12px]">🔍</span>}
        </div>
      ) : isSelected && !open ? (
        /* closed + value: show label with clear button */
        <div className={`flex items-center gap-1 rounded-md px-2 py-2 text-sm ${editableClass}`}>
          <span className="flex-1 truncate">{label || value}</span>
          <button type="button" onClick={() => { onClear(); setQuery(''); }}
            className="shrink-0 text-gray-400 hover:text-red-500" aria-label="Clear"
            /* not a tab stop: it wipes the picked value with no confirm, and
               it sat exactly where Tab from the field before it landed */
            tabIndex={-1}>✕</button>
        </div>
      ) : (
        /* open / searching */
        <div className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${editableClass}`}>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
            placeholder={isSelected ? (label || value) : placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); setOpen(true); }}
            onFocus={() => { setOpen(true); onSearch(query); }}
            onKeyDown={handleKey}
            autoComplete="off"
          />
          {loading
            ? <span className="shrink-0 text-[11px] text-gray-400">…</span>
            : <span className="shrink-0 text-gray-400 text-[12px]">🔍</span>}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-md"
          style={{ maxHeight: 280 }}>
          {loading && <div className="px-3 py-2 text-[12px] text-gray-400">Searching…</div>}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-gray-400">No results found</div>
          )}
          {options.map((opt, i) => (
            <div
              key={opt.value}
              className={`cursor-pointer px-3 py-2 text-[13px] ${i === highlighted ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
              onMouseDown={() => { onSelect(opt); setOpen(false); setQuery(''); }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <div className="font-medium leading-tight">{opt.primaryLabel}</div>
              {opt.secondaryLabel && <div className="text-[11px] text-gray-400">{opt.secondaryLabel}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Serial No., rendered TWICE - once in row 2, once in row 3.

   ONE value, two windows. Both call sites pass form.serialNo, so row 3 always
   shows whatever row 2 holds; there is no second serial and no second state.
   The difference between them is only who may write it:

     row 2  editable  - this is where the number is entered
     row 3  locked    - a read-back of the same value, beside HSN

   readOnly rather than disabled for the locked one: a disabled input is left
   out of form submission in plain HTML, and although this form reads from React
   state rather than the DOM, readOnly keeps the two consistent. The handlers
   below close what readOnly leaves open - a caret keystroke in a clicked box, a
   drop, a scroll - while Tab and Ctrl/Cmd still work, so focus can leave and
   the value can still be copied.

   Digits only on the editable one. Stripping the rest on the way in is what
   makes "positive whole number" true by construction: a minus sign, a decimal
   point or a pasted "12abc" never reach state. Empty IS allowed while typing;
   submit() rejects a blank one. */
function SerialNoField({ value, onChange, editableClass, readOnlyClass, locked = false }) {
  const lockedProps = {
    readOnly: true,
    tabIndex: -1,
    "aria-readonly": "true",
    title: "Shows the Bill Sl No. entered above",
    onKeyDown: (event) => { if (event.key !== "Tab" && !event.ctrlKey && !event.metaKey) event.preventDefault(); },
    onPaste: (event) => event.preventDefault(),
    onCut: (event) => event.preventDefault(),
    onDrop: (event) => event.preventDefault(),
  };

  return (
    <div className="max-w-[110px] space-y-1 xl:max-w-none">
      <label className="block text-[11px] font-semibold text-gray-700">Bill Sl No. *</label>
      <div className="relative">
        <input
          value={value ?? ""}
          inputMode="numeric"
          aria-label="Bill Sl No."
          placeholder="1"
          {...(locked ? lockedProps : { onChange: (event) => onChange(event.target.value) })}
          onWheel={(event) => event.currentTarget.blur()}
          className={`w-full rounded-md px-2 py-2 text-sm ${locked ? `cursor-not-allowed pr-7 ${readOnlyClass}` : editableClass}`}
        />
        {locked && (
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        )}
      </div>
    </div>
  );
}

/* The five prices worked out from a form's rate, discount, markups and
   offers - the arithmetic the rate effect below has always done, in one place
   so re-seeding the markups from a supplier recalculates the same way. */
function withFormPrices(current) {
  const purchaseRate = Number(current.purchaseRate || 0);
  const discount = Number(current.discount || 0);
  const finalValue = current.discountType === "Flat"
    ? Math.max(0, purchaseRate - discount)
    : Math.max(0, purchaseRate - (purchaseRate * discount) / 100);
  const rspPrice = finalValue * (1 + Number(current.markupRSP || 0) / 100);
  const wspPrice = finalValue * (1 + Number(current.markupWSP || 0) / 100);
  const dpPrice = finalValue * (1 + Number(current.markupDP || 0) / 100);
  const rspOfferPct = Number(current.rspOfferPct || 0);
  const wspOfferPct = Number(current.wspOfferPct || 0);
  const dpOfferPct = Number(current.dpOfferPct || 0);

  return {
    ...current,
    finalPrice: finalValue.toFixed(2),
    rspPrice: rspPrice.toFixed(2),
    wspPrice: wspPrice.toFixed(2),
    dpPrice: dpPrice.toFixed(2),
    rspOfferPrice: (rspPrice * (1 - rspOfferPct / 100)).toFixed(2),
    wspOfferPrice: (wspPrice * (1 - wspOfferPct / 100)).toFixed(2),
    dpOfferPrice: (dpPrice * (1 - dpOfferPct / 100)).toFixed(2),
  };
}

/* OFFER PRICE / MARK DOWN FROM THE INVENTORY ITEM.

   Inventory > Item stores an item's offers as percentages (RSP / WSP / Ecomm
   Offer %; /api/item/<id>/detail returns them as rspOfferPct, wspOfferPct,
   dpOfferPct). `item` is that detail, or null when the item is cleared. Its
   percentages go into the offer boxes - and OFFER APPLICABLE is ticked, since
   the boxes are disabled otherwise - and withFormPrices turns them into offer
   prices off the row's RSP / WSP / E-COMM, the same arithmetic as a typed %.
   A % the operator typed is never overwritten, and an item with no offer
   clears only what the previous item filled in.

   Pure: what the last item filled in (and whether it ticked the box) is kept
   on the form itself as _autoOffer, which the submitted row never carries -
   so it is safe inside a setForm updater, which React may run twice. */
function withItemOffers(current, item) {
  const previous = current._autoOffer || null;
  const next = { ...current };
  const applied = {};
  OFFER_PCT_KEYS.forEach((key) => {
    const now = Number(current[key] || 0);
    const auto = previous?.[key] != null ? Number(previous[key]) : null;
    if (now !== 0 && now !== auto) return;                 // typed by the operator
    if (item?.[key] != null) {
      /* rounded once, so the box and the record of it always agree */
      const pct = Number(fixed2(item[key]));
      next[key] = fixed2(pct);
      applied[key] = pct;
    } else if (auto !== null) {
      next[key] = 0;
    }
  });
  const any = Object.keys(applied).length > 0;
  if (any) next.offerApplicable = true;
  /* untick only what an item ticked, and never while a % the operator typed
     is still in a box - it would sit disabled and be dropped on Submit */
  else if (previous?.ticked && OFFER_PCT_KEYS.every((key) => Number(next[key] || 0) === 0)) next.offerApplicable = false;
  next._autoOffer = any ? { ...applied, ticked: Boolean(previous?.ticked) || !current.offerApplicable } : null;
  return next;
}

/* SUPPLIER -> PRICE CALCULATION SETUP, as this form shows it.

   The fields that have an input of their own on the form (Discount Type,
   Discount, and Mark Up on Cost RSP / WSP / E-comm) are not repeated here -
   those inputs start from the supplier's values. What is left (the Round Off
   values) is listed read-only, with the supplier it came from. */
function SupplierPriceSetupPanel({ setup }) {
  if (!setup) return null;
  const message = setupStatusMessage(setup);
  const extra = unmappedSetupFields(setup);
  return (
    <div className="mb-4 rounded-md border border-[#dfe4eb] bg-[#f8fafc] px-3 py-2 text-[12px] text-gray-700" data-testid="supplier-price-setup">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">Supplier Price Calculation Setup</span>
        {setup.supplierName && (
          <span className="text-gray-500">{setup.supplierName}{setup.supplierCode ? ` (${setup.supplierCode})` : ""}</span>
        )}
      </div>
      {message ? (
        <div className="mt-1 text-gray-500">{message}</div>
      ) : (
        <>
          {extra.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {extra.map((field) => (
                <span key={field.key}>
                  {field.label}: <span className="font-semibold">{field.value === null ? "-" : formatSetupValue(field.value)}</span>
                </span>
              ))}
            </div>
          )}
          {/* the "... fill the matching inputs below." hint that listed those
              fields is removed (user, 2026-09-17); the inputs themselves still
              start from the supplier's values */}
        </>
      )}
    </div>
  );
}

function AddItemModal({ open, onClose, onSubmit, onSubmitAndPrint, barcodeFormat, business = "", markupDefaults = {}, priceSetup = null, rateCodeMapping = null, grcId = null, initialBillSlNo = 1, initialNextSerialNo = 1 }) {
  /* The form's starting prices: the GRC supplier's Price Calculation Setup
     when the screen has it, otherwise the three markups it has always been
     handed. A value the supplier does not have is left blank - never a
     made-up percentage. */
  const markups = markupDefaults || {};
  const supplierDefaults = priceSetup
    ? formDefaultsFromSetup(priceSetup)
    : {
      ...(markups.rsp != null ? { markupRSP: formatSetupValue(markups.rsp) } : {}),
      ...(markups.wsp != null ? { markupWSP: formatSetupValue(markups.wsp) } : {}),
      ...(markups.dp != null ? { markupDP: formatSetupValue(markups.dp) } : {}),
    };
  const supplierMarkups = {
    markupRSP: supplierDefaults.markupRSP ?? "",
    markupWSP: supplierDefaults.markupWSP ?? "",
    markupDP: supplierDefaults.markupDP ?? "",
  };
  const createBlankForm = (overrides = {}) => ({
    oldBarcode: "",
    itemCode: "",
    itemName: "",
    itemId: "",
    hsnId: "",
    hsn: "",
    hsn2Id: "",
    hsn2: "",
    gst: "0",
    goodsType: "",
    sm: "",
    p_m_f: "",
    /* the vendor's own wording for the goods. Was previously never a form
       field - the generated row just copied itemName into it - so it is
       seeded from the Old Barcode lookup and editable from row 2. */
    supplierDescription: "",
    printDescription: "",
    uniqueBarcode: true,
    isMtr: false,
    qty: "",
    noOfCuts: "",
    totalMtr: "",
    purchaseRate: "",
    discountType: supplierDefaults.discountType || "Percentage",
    discount: supplierDefaults.discount ?? "0",
    finalPrice: "0.00",
    markupRSP: supplierMarkups.markupRSP,
    rspPrice: "0.00",
    markupWSP: supplierMarkups.markupWSP,
    wspPrice: "0.00",
    markupDP: supplierMarkups.markupDP,
    dpPrice: "0.00",
    rspOfferPct: 0,
    rspOfferPrice: "0.00",
    wspOfferPct: 0,
    wspOfferPrice: "0.00",
    dpOfferPct: 0,
    dpOfferPrice: "0.00",
    offerApplicable: false,
    serialNo: initialBillSlNo,
    ...overrides,
  });

  const [form, setForm] = useState(() => createBlankForm());
  /* Required-field problems from the last Submit, { formKey: message }. An
     entry drops as soon as its field is put right (the effect below); none is
     ever added except by Submit, so the form is not red before it is tried. */
  const [fieldErrors, setFieldErrors] = useState({});
  const formRootRef = useRef(null);
  useEffect(() => {
    setFieldErrors((current) => {
      const keys = Object.keys(current);
      if (!keys.length) return current;
      const now = requiredFieldErrors(form);
      const still = Object.fromEntries(keys.filter((key) => now[key]).map((key) => [key, now[key]]));
      /* a field whose problem CHANGED (not a number -> not above 0) shows the new one */
      return keys.every((key) => now[key] === current[key]) ? current : still;
    });
  }, [form]);
  /* the red outline and the message under a required field */
  const invalid = (key) => (fieldErrors[key] ? " !border-red-500 ring-1 ring-red-500" : "");
  const fieldError = (key) => (fieldErrors[key]
    ? <p className="text-[11px] font-medium text-red-600" role="alert">{fieldErrors[key]}</p>
    : null);
  /* State for the next Serial No. (4th part of barcode) - fetched from backend.
     Seeded from Item Summary SL NO (the row's position in the summary table),
     passed in as initialNextSerialNo. The operator can still override it. */
  const [nextSerialNo, setNextSerialNo] = useState(initialNextSerialNo);
  const [serialNoLoading, setSerialNoLoading] = useState(false);
  /* the reservation round trip - the Add buttons are disabled while it runs
     so a double-click cannot burn a second block of numbers */
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState("");
  /* Says why the offer boxes did not fill: the picked item has no RSP / WSP /
     E-COMM Offer % saved in Inventory > Item (most items have none). */
  const [offerNote, setOfferNote] = useState("");
  const noteItemOffers = (item, code) => setOfferNote(
    item && OFFER_PCT_KEYS.some((key) => item[key] != null)
      ? ""
      : item
        ? `No RSP / WSP / E-COMM Offer % is saved for ${code} in Inventory > Item.`
        : `${code} was not found in Inventory > Item, so no Offer % was filled.`
  );
  /* Server-side search state for Item Code and HSN */
  const [itemOptions, setItemOptions] = useState([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemLabel, setItemLabel] = useState('');
  const [hsnOptions, setHsnOptions] = useState([]);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnLabel, setHsnLabel] = useState('');
  /* The selected HSN's tax slabs, rates already resolved. GST% is derived from
     these rather than stored once, because a price-banded HSN answers
     differently as the row's value moves - see the effect below. */
  const [hsnSlabs, setHsnSlabs] = useState([]);
  /* What that effect last wrote into GST%. Anything else in the box is the
     operator's own figure and is left alone; null means the HSN just changed,
     so the next auto-fill overrides whatever is there. */
  const autoGstRef = useRef(null);
  /* picking a second HSN while the first is still loading must not let the
     first one's slabs land on top - same guard the item detail read uses */
  const hsnDetailRef = useRef(0);
  const itemTimerRef = useRef(null);
  const hsnTimerRef = useRef(null);
  const itemDetailRef = useRef(0);

  /* ── Second HSN field (Row 3) — independent state so it can be changed
     without touching the first HSN field (Row 1) and vice-versa. */
  const [hsn2Options, setHsn2Options] = useState([]);
  const [hsn2Loading, setHsn2Loading] = useState(false);
  const [hsn2Label, setHsn2Label] = useState('');
  const [hsn2Slabs, setHsn2Slabs] = useState([]);
  const hsn2DetailRef = useRef(0);
  const hsn2TimerRef = useRef(null);
  const [cutRows, setCutRows] = useState([{ id: 1, value: "" }]);
  const [focusedCutIndex, setFocusedCutIndex] = useState(0);
  const [cutError, setCutError] = useState("");
  /* Refs for each CUTS(MTR) input — used for Tab/Shift+Tab keyboard navigation
     so focus jumps directly to the next/prev input and never lands on the
     +/− buttons between rows. The array is rebuilt on every render; stale
     entries are avoided because React calls each ref callback with null when
     the element unmounts and with the new element when it mounts. */
  const cutsInputRefs = useRef([]);

  /* Debounced server-side item search */
  const searchItems = (q) => {
    clearTimeout(itemTimerRef.current);
    setItemLoading(true);
    itemTimerRef.current = setTimeout(() => {
      const qs = new URLSearchParams({ perPage: '20', search: q || '' });
      if (business) qs.set('business', business);
      fetch('/api/item?' + qs)
        .then((r) => r.json())
        .then((d) => {
          setItemOptions((d.rows || []).map((row) => ({
            value: String(row._id),
            primaryLabel: row.itemCode || row.name || '',
            secondaryLabel: row.name !== row.itemCode ? row.name : '',
            itemCode: row.itemCode || '',
            name: row.name || '',
            subGroupId: row.subGroupId || '',
            description: row.description || '',
          })));
        })
        .catch(() => setItemOptions([]))
        .finally(() => setItemLoading(false));
    }, 300);
  };

  /* Debounced server-side HSN search */
  const searchHsn = (q) => {
    clearTimeout(hsnTimerRef.current);
    setHsnLoading(true);
    hsnTimerRef.current = setTimeout(() => {
      const qs = new URLSearchParams({ perPage: '20', search: q || '' });
      /* this company's HSN Master only - the same code can exist under
         another company with a different (or missing) tax slab */
      if (business) qs.set('business', business);
      fetch('/api/hsn?' + qs)
        .then((r) => r.json())
        .then((d) => {
          setHsnOptions((d.rows || []).map((row) => ({
            value: String(row._id),
            primaryLabel: row.code || '',
            secondaryLabel: row.description || '',
            code: row.code || '',
            description: row.description || '',
            taxSlabs: Array.isArray(row.taxSlabs) ? row.taxSlabs : [],
          })));
        })
        .catch(() => setHsnOptions([]))
        .finally(() => setHsnLoading(false));
    }, 300);
  };

  /* Debounced server-side HSN search — second HSN field (Row 3).
     Identical query to searchHsn but writes into hsn2Options/hsn2Loading so
     the two dropdowns are completely independent. */
  const searchHsn2 = (q) => {
    clearTimeout(hsn2TimerRef.current);
    setHsn2Loading(true);
    hsn2TimerRef.current = setTimeout(() => {
      const qs = new URLSearchParams({ perPage: '20', search: q || '' });
      if (business) qs.set('business', business);
      fetch('/api/hsn?' + qs)
        .then((r) => r.json())
        .then((d) => {
          setHsn2Options((d.rows || []).map((row) => ({
            value: String(row._id),
            primaryLabel: row.code || '',
            secondaryLabel: row.description || '',
            code: row.code || '',
            description: row.description || '',
            taxSlabs: Array.isArray(row.taxSlabs) ? row.taxSlabs : [],
          })));
        })
        .catch(() => setHsn2Options([]))
        .finally(() => setHsn2Loading(false));
    }, 300);
  };

  /* OLD BARCODE LOOKUP.

     status: idle | loading | found | error. `resolvedRef` holds the code that
     is currently loaded into the form, so re-scanning the same label - the
     classic double-trigger of a wedge scanner - neither refetches nor
     rebuilds the form. `inFlightRef` blocks a second request while one is
     already running. */
  const [lookup, setLookup] = useState({ status: "idle", message: "" });
  const resolvedRef = useRef("");
  const inFlightRef = useRef("");

  /* the shared scanner hook every other scanning screen uses (POS, stock
     transfer, receiving, returns), so this screen talks to /api/barcode/scan
     the same way and surfaces the same server messages */
  const { lookup: scanLookup } = useBarcodeLookup({ business, intent: "LOOKUP" });

  const readOnlyClass = "border border-[#dfe4eb] bg-[#f3f5f9] text-gray-700";
  const editableClass = "border border-[#dfe4eb] bg-white text-gray-700";

  useEffect(() => {
    if (!open) return;
    /* NOTHING RESETS THE BILL SL NO. HERE.

       This effect used to open the modal with serialNo = the grid's row count
       plus one - and that count is the number of BARCODE ROWS, so after
       twenty pieces of bill line 1 the modal proposed bill line 21, and that
       number went into the third part of every barcode it made. The Bill Sl
       No. is the supplier's line number, not a count of anything here, so
       what the operator last entered is simply left alone. */
    setCutRows((current) => {
      if (!form.isMtr) return [{ id: 1, value: "" }];
      const count = Math.max(1, Number(form.noOfCuts || current.length || 1));
      return makeMeterCutRows(count, Number(form.totalMtr || 0));
    });
    setCutError("");
    setFieldErrors({});

    /* pre-populate dropdowns with initial results so they are not blank on open */
    searchItems('');
    searchHsn('');
    searchHsn2('');
  }, [open]);

  useEffect(() => {
    setForm((current) => withFormPrices(current));
  }, [form.purchaseRate, form.discount, form.discountType]);

  /* A DIFFERENT SUPPLIER, OR A CHANGED SETUP, RE-SEEDS THE PRICE FIELDS.

     Keyed on the supplier and its setup values rather than on the object the
     page hands down: the page re-reads the GRC after every Submit, and that
     must not throw away markups the operator has typed. The first render is
     already seeded by createBlankForm. */
  const setupKey = setupIdentity(priceSetup);
  const seededSetupRef = useRef(setupKey);
  useEffect(() => {
    if (seededSetupRef.current === setupKey) return;
    seededSetupRef.current = setupKey;
    /* nothing of the previous supplier's survives: a field the new one has
       no value for goes back to the form's own starting value */
    setForm((current) => withFormPrices({
      ...current,
      ...supplierMarkups,
      discountType: supplierDefaults.discountType || "Percentage",
      discount: supplierDefaults.discount ?? "0",
    }));
    // supplierDefaults/supplierMarkups are derived from the setup this key names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupKey]);

  /* The real Purchase Rate written through the active Purchase Rate Code
     Master. Derived, never stored in form state and never written back into
     form.purchaseRate - the typed number has to stay exactly as entered.
     Empty string while the master is unconfigured or still loading, which is
     what hides the read-only echo under the input. */
  const encodedPurchaseRate = useMemo(
    () => encodeRate(form.purchaseRate, rateCodeMapping),
    [form.purchaseRate, rateCodeMapping]
  );

  /* GST% <- the HSN's Tax Slabs.

     A single-slab HSN is one flat rate. A price-banded HSN answers by value,
     so the rate is re-derived whenever the row's value moves rather than being
     frozen at the moment the HSN was picked - edit the purchase rate or the
     discount and a row can cross a slab boundary. Final Price is the value
     matched against the bands, falling back to Purchase Rate before any
     discount has been worked out.

     The field stays editable throughout: once the operator types over the
     auto-filled rate, form.gst no longer matches what this effect last wrote
     and their figure is left standing until a different HSN is chosen. */
  useEffect(() => {
    if (!hsnSlabs.length) return;

    const amount = Number(form.finalPrice) || Number(form.purchaseRate) || 0;
    const next = String(gstPercentForAmount(hsnSlabs, amount) || 0);

    if (autoGstRef.current !== null && form.gst !== autoGstRef.current) return;
    autoGstRef.current = next;
    if (form.gst !== next) setForm((current) => ({ ...current, gst: next }));
  }, [hsnSlabs, form.finalPrice, form.purchaseRate, form.gst]);

  if (!open) return null;

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  /* Both Bill Sl No. boxes come through here, which is why they stay in
     step. See SerialNoField for why the digits are stripped rather than
     validated. */
  const updateSerialNo = (raw) => updateField("serialNo", String(raw ?? "").replace(/\D/g, ""));

  /* Fetch next Serial No. (4th part of barcode) when Bill Sl No. changes */
  const fetchNextSerialNo = useCallback(async (billSlNo) => {
    if (!grcId || !billSlNo || !String(billSlNo).trim()) {
      setNextSerialNo(1);
      return;
    }
    setSerialNoLoading(true);
    try {
      const response = await fetch(`/api/barcode-generation/next-serial?grcId=${grcId}&billSlNo=${encodeURIComponent(String(billSlNo).trim())}`);
      const data = await response.json();
      if (data.ok && data.nextSerialNo) {
        setNextSerialNo(Number(data.nextSerialNo));
      } else {
        setNextSerialNo(1);
      }
    } catch {
      setNextSerialNo(1);
    } finally {
      setSerialNoLoading(false);
    }
  }, [grcId]);

  useEffect(() => {
    const billSlNo = String(form.serialNo ?? "").trim();
    if (billSlNo) {
      fetchNextSerialNo(billSlNo);
    } else {
      setNextSerialNo(1);
    }
  }, [form.serialNo, fetchNextSerialNo]);

  /* HSN appears in row 1 and again in row 3. Both call this, so both read
     the same form.hsnId / hsnLabel and both go through handleHsnSelection -
     picking in either box updates the other and pulls the GST slab with it.
     Fully editable in both places: this is a live search, never locked. */
  const renderHsnField = () => (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-gray-700">HSN *</label>
      <SearchSelect
        placeholder="Search HSN…"
        value={form.hsnId || form.hsn}
        label={hsnLabel}
        onSearch={searchHsn}
        options={hsnOptions}
        loading={hsnLoading}
        onSelect={(opt) => handleHsnSelection(opt)}
        onClear={() => handleHsnSelection(null)}
        editableClass={editableClass}
        editableSelection
      />
    </div>
  );

  /* Second HSN field (Row 3) — bound to its own independent state so the
     operator can set a different HSN here without affecting the first one,
     and vice-versa.  Initialised from the item master alongside the first
     field, but fully editable after that. */
  const renderHsn2Field = () => (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-gray-700">HSN *</label>
      <SearchSelect
        placeholder="Search HSN…"
        value={form.hsn2Id || form.hsn2}
        label={hsn2Label}
        onSearch={searchHsn2}
        options={hsn2Options}
        loading={hsn2Loading}
        onSelect={(opt) => handleHsn2Selection(opt)}
        onClear={() => handleHsn2Selection(null)}
        editableClass={editableClass}
        editableSelection
      />
    </div>
  );

  const resolveProductGroup = async (subGroupId) => {
    if (!subGroupId) {
      setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
      return;
    }

    try {
      const response = await fetch(`/api/product-group/${subGroupId}`);
      const payload = await response.json();
      const subGroup = payload?.doc || null;
      if (!subGroup) {
        setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
        return;
      }

      let groupName = "";
      if (subGroup.parentId) {
        const groupResponse = await fetch(`/api/product-group/${subGroup.parentId}`);
        const groupPayload = await groupResponse.json();
        groupName = groupPayload?.doc?.name || "";
      }

      setForm((current) => ({
        ...current,
        subGroupName: subGroup.name || "",
        groupName,
      }));
    } catch (error) {
      console.error(error);
      setForm((current) => ({ ...current, subGroupName: "", groupName: "" }));
    }
  };

  /* Hands the form a new slab table. A fresh HSN overrides whatever GST% holds
     - including a hand-typed figure, which belonged to the HSN that was there
     before - so the override guard is cleared with it. An HSN with no slabs at
     all leaves GST% at 0 and editable rather than blocking the operator. */
  const applyHsnSlabs = (slabs) => {
    autoGstRef.current = null;
    setHsnSlabs(slabs);
    if (!slabs.length) setForm((current) => ({ ...current, gst: "0" }));
  };

  /* HSN picked -> its Tax Slabs from HSN Master. The search dropdown already
     carries them, so the extra read only runs for an HSN that arrived without
     one (a code typed in, or a stale option). Which slab applies is settled by
     the effect below, not here, because that answer depends on the price. */
  const resolveHsnGst = async (hsnDoc) => {
    const detailRequest = hsnDetailRef.current + 1;
    hsnDetailRef.current = detailRequest;

    const code = hsnDoc?.code || hsnDoc?.label || "";
    let hsnId = hsnDoc?.value || "";
    let taxSlabs = Array.isArray(hsnDoc?.taxSlabs) ? hsnDoc.taxSlabs : [];

    if (!taxSlabs.length && code) {
      try {
        const response = await fetch(`/api/hsn?perPage=20&search=${encodeURIComponent(code)}${business ? `&business=${encodeURIComponent(business)}` : ""}`);
        const payload = await response.json();
        const match = (payload.rows || []).find((row) => String(row.code || '').trim() === String(code).trim());
        taxSlabs = Array.isArray(match?.taxSlabs) ? match.taxSlabs : [];
        /* a code looked up by text still records the master's id */
        if (!hsnId && match?._id) hsnId = String(match._id);
      } catch {
        taxSlabs = [];
      }
    }

    if (hsnDetailRef.current !== detailRequest) return;

    setForm((current) => ({ ...current, hsn: code, hsnId: hsnId || current.hsnId }));

    const slabs = await resolveSlabRates(taxSlabs);
    if (hsnDetailRef.current !== detailRequest) return;
    /* an HSN this company's master has no slab for leaves the GST% already on
       the form (an Old Barcode's own rate) instead of resetting it to 0 */
    if (!slabs.length && hsnDoc?.keepGst) return;
    applyHsnSlabs(slabs);
  };

  /* Clears everything the previous Old Barcode put on the form, so barcode B
     can never inherit barcode A's item, HSN or GST. */
  const clearFetchedItem = () => {
    resolvedRef.current = "";
    hsnDetailRef.current += 1;
    hsn2DetailRef.current += 1;
    applyHsnSlabs([]);
    applyHsn2Slabs([]);
    setItemLabel('');
    setHsnLabel('');
    setHsn2Label('');
    setOfferNote('');
    setForm((current) => withFormPrices(withItemOffers({
      ...current,
      itemId: "", itemCode: "", itemName: "",
      hsnId: "", hsn: "", hsn2Id: "", hsn2: "", gst: "0",
      printDescription: "", supplierDescription: "", subGroupName: "", groupName: "",
    }, null)));
  };

  /* An old barcode's item in Inventory > Item, with its detail (offer %).
     Stored barcode rows carry no itemId, and the Item master keeps most codes
     in `name` (itemCode blank), so the code is matched the way the Item Code
     picker lists items - itemCode first, then name. null when not found. */
  const itemDetailByCode = async (itemId, itemCode) => {
    try {
      let id = itemId ? String(itemId) : "";
      const code = String(itemCode || "").trim();
      if (!id && code) {
        const qs = new URLSearchParams({ perPage: "20", search: code });
        if (business) qs.set("business", business);
        const response = await fetch("/api/item?" + qs);
        if (!response.ok) return null;
        const rows = (await response.json()).rows || [];
        const match = rows.find((row) => String(row.itemCode || "").trim() === code)
          || rows.find((row) => String(row.name || "").trim() === code);
        id = match?._id ? String(match._id) : "";
      }
      if (!id) return null;
      const response = await fetch(`/api/item/${encodeURIComponent(id)}/detail`);
      return response.ok ? (await response.json())?.item || null : null;
    } catch {
      return null;
    }
  };

  /* Old Barcode -> the item it belongs to.

     Reuses POST /api/barcode/scan, the single endpoint every scanner in the
     app already talks to. With intent 'LOOKUP' it is a pure read - it never
     writes, reserves or consumes anything - and it is the only lookup that
     matches on oldBarcode as well as barcodeNo/barcodeGenerated, which is
     exactly what is printed on incoming supplier goods. */
  const lookupOldBarcode = async (rawCode) => {
    const code = String(rawCode || "").trim();

    if (!code) {
      setLookup({ status: "idle", message: "" });
      /* only what an old barcode loaded is cleared with it - Tab through an
         empty Old Barcode box used to wipe an Item Code picked by hand */
      if (resolvedRef.current) clearFetchedItem();
      return;
    }
    /* already loaded, or already being fetched - a repeat scan is a no-op */
    if (code === resolvedRef.current || code === inFlightRef.current) return;

    inFlightRef.current = code;
    setLookup({ status: "loading", message: "Fetching barcode..." });
    /* the previous LOOKUP's item must not linger while the new one is on its
       way - but an Item Code / HSN / description the operator entered is only
       replaced by a barcode that is actually found (see below), never wiped
       by one that is not */
    if (resolvedRef.current) clearFetchedItem();

    try {
      const result = await scanLookup(code);

      /* the user typed on - this answer is for a code that is no longer in
         the box, so dropping it avoids a late response overwriting a newer one */
      if (inFlightRef.current !== code) return;

      if (!result?.ok || !result.unit) {
        /* "belongs to a different business" is worth repeating verbatim - it
           tells the operator to change the company selector, which the
           generic wording would send them hunting for. Anything else reads
           as plain not-found. */
        setLookup({
          status: "error",
          message: result?.code === "BARCODE_WRONG_BUSINESS"
            ? result.error
            : result?.code === "OFFLINE"
              ? "Could not reach the server. Try the scan again."
              : "Barcode not found. Please enter or scan a valid barcode.",
        });
        return;
      }

      const unit = result.unit;
      /* a match replaces whatever item / HSN / GST was on the form */
      clearFetchedItem();

      /* When a barcode is scanned, populate labels so the SearchSelect
         closed state shows the item code and HSN code correctly. */
      /* The SAME fallback the gate and the row use, so the box can never
         read as empty while submit() thinks an item is selected. A stored
         label whose itemCode is blank but which carries a name used to leave
         this label '' - the control then showed its "Search Item Code…"
         placeholder, looking unselected, while Submit quietly went ahead on
         the slugified name. */
      setItemLabel(unit.itemCode || unit.itemName || '');
      if (unit.hsn) setHsnLabel(unit.hsn);
      if (unit.hsn) setHsn2Label(unit.hsn);

      setForm((current) => ({
        ...current,
        oldBarcode: code,
        itemId: unit.itemId ? String(unit.itemId) : "",
        itemCode: unit.itemCode || "",
        itemName: unit.itemName || "",
        hsnId: "",
        hsn: unit.hsn || "",
        hsn2Id: "",
        hsn2: unit.hsn || "",
        gst: unit.gst ? String(unit.gst) : current.gst,
        printDescription: unit.printDescription || unit.description || unit.itemName || "",
        /* the vendor's wording as recorded on the matched label - falls back
           to the merged description so an older row without a separate
           supplier description still fills the field */
        supplierDescription: unit.supplierDescription || unit.description || "",
        purchaseRate: unit.rate ? String(unit.rate) : current.purchaseRate,
        uom: unit.uom || current.uom,
      }));

      resolvedRef.current = code;
      setLookup({
        status: "found",
        message: `${unit.itemCode || unit.itemName || "Item"} loaded.`,
      });

      /* GST% from this company's HSN Master for the record's HSN - the path a
         hand-picked HSN takes, so the rate follows the tax slab rather than
         the old label's stored GST% (keepGst: an HSN missing from the master
         leaves the record's own rate standing) - and the HSN ids the two HSN
         boxes are shown by. */
      if (unit.hsn) {
        resolveHsnGst({ code: unit.hsn, keepGst: true });
        resolveHsn2Gst({ code: unit.hsn });
      }
      /* the scan itself is applied - a code re-entered from here on is a new
         lookup, not a repeat of one still in flight */
      if (inFlightRef.current === code) inFlightRef.current = "";
      /* the item's own offer % from Inventory > Item - the old label's offer
         price belongs to that label, not to the item. Dropped if another code
         was entered, or an item was picked by hand, while it was on its way. */
      const offerTurn = itemDetailRef.current;
      const offerItem = await itemDetailByCode(unit.itemId, unit.itemCode || unit.itemName);
      if (resolvedRef.current !== code || itemDetailRef.current !== offerTurn) return;
      setForm((current) => withFormPrices(withItemOffers(current, offerItem)));
      noteItemOffers(offerItem, unit.itemCode || unit.itemName || code);
    } catch {
      if (inFlightRef.current !== code) return;
      setLookup({ status: "error", message: "Could not reach the server. Try the scan again." });
    } finally {
      if (inFlightRef.current === code) inFlightRef.current = "";
    }
  };

  const handleItemSelection = async (opt) => {
    hsnDetailRef.current += 1;
    hsn2DetailRef.current += 1;
    /* The operator is answering the very complaint the banner makes, so the
       banner goes now rather than surviving until a submit finally passes.
       setReserveError("") used to be reached ONLY at the end of submit(),
       after every gate had cleared - so "Please select an Item Code." stayed
       on screen while the operator picked the item it asked for, and only a
       successful Submit could take it down. */
    setReserveError("");
    if (!opt) {
      itemDetailRef.current += 1;
      setItemLabel('');
      applyHsnSlabs([]);
      applyHsn2Slabs([]);
      setHsn2Label('');
      /* Clearing the item also forgets the Old Barcode it may have come
         from. lookupOldBarcode short-circuits on `code === resolvedRef.current`
         (it will not re-fetch a code it has already resolved), so leaving the
         ref set stranded the screen: the X emptied the Item Code box while a
         green "<code> loaded." note still claimed the item was there, and
         re-visiting the unchanged Old Barcode field would not bring it back.
         Submit then answered "Please select an Item Code." - the reported
         symptom again, from the opposite direction. */
      resolvedRef.current = "";
      inFlightRef.current = "";
      setLookup({ status: "idle", message: "" });
      setForm((current) => withFormPrices(withItemOffers({
        ...current,
        itemId: "", itemName: "", itemCode: "", subGroupName: "", groupName: "", printDescription: "",
        hsnId: "", hsn: "", hsn2Id: "", hsn2: "", gst: "0",
        ...supplierMarkups,
      }, null)));
      setOfferNote("");
      return;
    }
    const detailRequest = itemDetailRef.current + 1;
    itemDetailRef.current = detailRequest;
    const itemCode = opt.itemCode || opt.primaryLabel || "";
    const itemName = opt.name || opt.secondaryLabel || "";
    setItemLabel(itemCode);
    applyHsnSlabs([]);
    applyHsn2Slabs([]);
    setForm((current) => ({
      ...current,
      itemId: opt.value,
      itemCode,
      itemName,
      printDescription: opt.description || "",
      hsnId: "",
      hsn: "",
      hsn2Id: "",
      hsn2: "",
      gst: "0",
      ...supplierMarkups,
    }));
    try {
      const response = await fetch(`/api/item/${encodeURIComponent(opt.value)}/detail`);
      const payload = await response.json();
      if (itemDetailRef.current !== detailRequest) return;
      if (!response.ok) {
        /* no detail - the previous item's offer % must not stay on this one */
        setForm((current) => withFormPrices(withItemOffers(current, null)));
        setOfferNote("");
        return;
      }
      const item = payload?.item || {};
      setHsnLabel(item.hsnCode || '');
      setHsn2Label(item.hsnCode || '');
      /* the detail route resolves the item's HSN slabs for us - bands and
         rates both - so the rate is picked by value here exactly as it is
         when the HSN is chosen by hand */
      applyHsnSlabs(Array.isArray(item.slabs) ? item.slabs : []);
      applyHsn2Slabs(Array.isArray(item.slabs) ? item.slabs : []);
      /* An item's OWN markup, when the item master has a real number for
         it, is more specific than the supplier's; otherwise the supplier's
         Price Calculation Setup value stays. Anything that is not a number
         never replaces it - "No" used to arrive here and blank Markup E-COMM %. */
      const itemMarkup = (value, fallback) => (value == null || fixed2(value) === "" ? fallback : fixed2(value));
      setForm((current) => withFormPrices(withItemOffers({
        ...current,
        hsnId: item.hsnId || "",
        hsn: item.hsnCode || "",
        hsn2Id: item.hsnId || "",
        hsn2: item.hsnCode || "",
        markupRSP: itemMarkup(item.markupRSP, supplierMarkups.markupRSP),
        markupWSP: itemMarkup(item.markupWSP, supplierMarkups.markupWSP),
        markupDP: itemMarkup(item.markupDP, supplierMarkups.markupDP),
      }, item)));
      noteItemOffers(item, itemCode);
    } catch {
      if (itemDetailRef.current === detailRequest) {
        setHsnLabel('');
        setHsn2Label('');
        setForm((current) => withFormPrices(withItemOffers(current, null)));
        setOfferNote("");
      }
    }
    await resolveProductGroup(opt.subGroupId || "");
  };

  const handleHsnSelection = async (opt) => {
    if (!opt) {
      hsnDetailRef.current += 1;
      setHsnLabel('');
      applyHsnSlabs([]);
      setForm((current) => ({ ...current, hsnId: "", hsn: "", gst: "0" }));
      return;
    }
    setHsnLabel(opt.code || opt.primaryLabel || "");
    await resolveHsnGst({
      value: opt.value,
      code: opt.code || opt.primaryLabel || "",
      label: opt.primaryLabel || "",
      taxSlabs: opt.taxSlabs || [],
    });
  };

  /* ── Second HSN field handlers (Row 3) ─────────────────────────────────────
     Mirror of applyHsnSlabs / resolveHsnGst / handleHsnSelection but operating
     on hsn2 form fields and hsn2* state only.  Changing the second HSN never
     touches form.hsnId / form.hsn / hsnSlabs / autoGstRef, and vice-versa. */

  const applyHsn2Slabs = (slabs) => {
    setHsn2Slabs(slabs);
  };

  const resolveHsn2Gst = async (hsnDoc) => {
    const detailRequest = hsn2DetailRef.current + 1;
    hsn2DetailRef.current = detailRequest;

    const code = hsnDoc?.code || hsnDoc?.label || "";
    let hsn2Id = hsnDoc?.value || "";
    let taxSlabs = Array.isArray(hsnDoc?.taxSlabs) ? hsnDoc.taxSlabs : [];

    if (!taxSlabs.length && code) {
      try {
        const response = await fetch(`/api/hsn?perPage=20&search=${encodeURIComponent(code)}${business ? `&business=${encodeURIComponent(business)}` : ""}`);
        const payload = await response.json();
        const match = (payload.rows || []).find((row) => String(row.code || '').trim() === String(code).trim());
        taxSlabs = Array.isArray(match?.taxSlabs) ? match.taxSlabs : [];
        if (!hsn2Id && match?._id) hsn2Id = String(match._id);
      } catch {
        taxSlabs = [];
      }
    }

    if (hsn2DetailRef.current !== detailRequest) return;

    setForm((current) => ({ ...current, hsn2: code, hsn2Id: hsn2Id || current.hsn2Id }));

    const slabs = await resolveSlabRates(taxSlabs);
    if (hsn2DetailRef.current !== detailRequest) return;
    applyHsn2Slabs(slabs);
  };

  const handleHsn2Selection = async (opt) => {
    if (!opt) {
      hsn2DetailRef.current += 1;
      setHsn2Label('');
      applyHsn2Slabs([]);
      setForm((current) => ({ ...current, hsn2Id: "", hsn2: "" }));
      return;
    }
    setHsn2Label(opt.code || opt.primaryLabel || "");
    await resolveHsn2Gst({
      value: opt.value,
      code: opt.code || opt.primaryLabel || "",
      label: opt.primaryLabel || "",
      taxSlabs: opt.taxSlabs || [],
    });
  };

  /* Markup RSP % and RSP Offer % take two digits - 0 to 99 - and nothing else.

     The cap lives here and not on the input maxLength because maxLength only
     limits typing. A paste, an autofill, a drop or an input event raised by an
     extension all bypass it, and every one of those still fires onChange - so
     sanitising on the way into state is what actually holds.

     Stripping non-digits also removes the minus sign and the decimal point, so
     these two fields carry whole positive percentages only. No separate
     "> 99" test is needed: two digits IS 0-99, and the slice enforces it
     before the value is ever parsed.

     Deliberately scoped to these two fields only - Markup WSP %, Markup E-COMM %,
     Discount and GST% are untouched and still accept their existing range. */
  const twoDigitPercent = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 2);
  const updateMarkupValue = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      const netPrice = Number(current.finalPrice || 0);

      if (key === "markupRSP") {
        const pct = Number(value || 0);
        next.rspPrice = (netPrice * (1 + pct / 100)).toFixed(2);
        next.rspOfferPrice = (Number(next.rspPrice) * (1 - Number(current.rspOfferPct || 0) / 100)).toFixed(2);
      }
      if (key === "rspPrice") {
        const price = Number(value || 0);
        next.markupRSP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
        next.rspOfferPrice = (price * (1 - Number(current.rspOfferPct || 0) / 100)).toFixed(2);
      }
      if (key === "markupWSP") {
        const pct = Number(value || 0);
        next.wspPrice = (netPrice * (1 + pct / 100)).toFixed(2);
        next.wspOfferPrice = (Number(next.wspPrice) * (1 - Number(current.wspOfferPct || 0) / 100)).toFixed(2);
      }
      if (key === "wspPrice") {
        const price = Number(value || 0);
        next.markupWSP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
        next.wspOfferPrice = (price * (1 - Number(current.wspOfferPct || 0) / 100)).toFixed(2);
      }
      if (key === "markupDP") {
        const pct = Number(value || 0);
        next.dpPrice = (netPrice * (1 + pct / 100)).toFixed(2);
        next.dpOfferPrice = (Number(next.dpPrice) * (1 - Number(current.dpOfferPct || 0) / 100)).toFixed(2);
      }
      if (key === "dpPrice") {
        const price = Number(value || 0);
        next.markupDP = netPrice > 0 ? fixed2(((price / netPrice) - 1) * 100) : '0.00';
        next.dpOfferPrice = (price * (1 - Number(current.dpOfferPct || 0) / 100)).toFixed(2);
      }

      return next;
    });
  };

  const updateOfferValue = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      const rspBase = Number(current.rspPrice || 0);
      const wspBase = Number(current.wspPrice || 0);
      const dpBase = Number(current.dpPrice || 0);

      if (key === "rspOfferPct") {
        const pct = Number(value || 0);
        next.rspOfferPrice = (rspBase * (1 - pct / 100)).toFixed(2);
      }
      if (key === "rspOfferPrice") {
        const offerPrice = Number(value || 0);
        next.rspOfferPct = rspBase > 0 ? fixed2(((rspBase - offerPrice) / rspBase) * 100) : '0.00';
      }
      if (key === "wspOfferPct") {
        const pct = Number(value || 0);
        next.wspOfferPrice = (wspBase * (1 - pct / 100)).toFixed(2);
      }
      if (key === "wspOfferPrice") {
        const offerPrice = Number(value || 0);
        next.wspOfferPct = wspBase > 0 ? fixed2(((wspBase - offerPrice) / wspBase) * 100) : '0.00';
      }
      if (key === "dpOfferPct") {
        const pct = Number(value || 0);
        next.dpOfferPrice = (dpBase * (1 - pct / 100)).toFixed(2);
      }
      if (key === "dpOfferPrice") {
        const offerPrice = Number(value || 0);
        next.dpOfferPct = dpBase > 0 ? fixed2(((dpBase - offerPrice) / dpBase) * 100) : '0.00';
      }

      return next;
    });
  };

  /* one EMPTY row on the end - the cuts already entered are kept as they are */
  const addCutRow = () => {
    const next = resizeCutRows(cutRows, cutRows.length + 1);
    setCutRows(next);
    updateField("noOfCuts", String(next.length));
  };

  const removeCutRow = (index) => {
    if (cutRows.length <= 1) return;
    const next = cutRows.filter((_, rowIndex) => rowIndex !== index);
    setCutRows(next);
    updateField("noOfCuts", String(next.length));
    setCutError("");
    setFocusedCutIndex((focused) => (focused > index ? focused - 1 : Math.min(focused, next.length - 1)));
  };

  /* Writes this box and nothing else. Total MTR is the available length the
     balance is worked from, so a cut no longer rewrites it either. Returns
     what the box now holds - the previous value when the edit was refused. */
  const updateCutValue = (index, raw) => {
    const value = decimal2(raw);
    const problem = cutEditError(cutRows, index, value, form.totalMtr);
    setCutError(problem);
    if (problem) return cutRows[index]?.value ?? "";
    setCutRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, value } : row)));
    return value;
  };

  /* Barcode numbers are RESERVED FROM THE SERVER, not counted in the browser.

     This used to read a running number out of sequenceRef, which starts from
     whatever the Barcode Setting says and advances locally. Two operators
     generating at the same time therefore both started from the same place
     and printed overlapping numbers - and once two garments carry the same
     label there is no way to tell them apart again.

     The reservation happens here, when the row is created, so the number the
     operator sees in the grid is the number that will be saved and the number
     on the label they may print immediately. */
  const submit = async (printAfterSubmit = false) => {
    /* every required field that is wrong is outlined at once, whichever check
       below stops the Submit first - they are enforced before the price rule */
    const requiredErrors = requiredFieldErrors(form);
    setFieldErrors(requiredErrors);
    /* Old Barcode is OPTIONAL - a blank one generates a label with no link
       back to a previous barcode, which is the normal case for goods that
       arrive unlabelled.

       It is still checked when one IS entered: a code that never resolved
       would otherwise save a label pointing at a record that does not exist.
       So the rule is "if you typed something, it has to be real", not "you
       have to type something". */
    const enteredOldBarcode = form.oldBarcode?.trim() || "";
    if (enteredOldBarcode && resolvedRef.current !== enteredOldBarcode) {
      setReserveError("Barcode not found. Please enter or scan a valid barcode.");
      return;
    }
    /* Only while the Bill Sl No. box is on screen (SHOW_BILL_SL_NO): a
       hidden field cannot be corrected, so it is not checked here - it holds
       the form's own value (1, or the one carried from the previous entry),
       and the save route still refuses a row that reaches it without one. */
    if (SHOW_BILL_SL_NO) {
      /* the field only ever holds digits, so "not a number" cannot get here -
         what is left to check is that it is present and not zero */
      const serialEntered = String(form.serialNo ?? "").trim();
      if (!serialEntered) {
        setReserveError("Bill Sl No. is required - it is the line of the supplier's bill these goods came in on, and the third part of their barcode.");
        return;
      }
      if (Number(serialEntered) < 1) {
        setReserveError("Bill Sl No. must be 1 or more.");
        return;
      }
    }
    /* THE ROW'S OWN ITEM CODE, worked out ONCE - here to check it and below
       to build the row with it, so the thing validated and the thing saved
       cannot be two different values.

       A code picked or typed stands as it is; failing that the item's name is
       slugified into one. That second half is not new - it is the rule the
       generated row has always used, and it is what lets an item carrying a
       name but no code of its own (most of the seeded Item master) be
       labelled at all.

       This used to test form.itemName. That is the item's NAME, not its
       code, and it is EMPTY for an item entered through Inventory -> Item
       with a code but no name. Picking such an item filled the Item Code box
       with, say, "10-PLNBTM", left itemName blank, and Submit then answered
       "Please select an Item Code." about an item that was plainly selected.
       The grid and the save route never had this disagreement: both already
       read `itemCode || itemName` (validRows, and the API's own row checks).
       Only this one gate looked at the name alone. */
    const rowItemCode = String(form.itemCode || "").trim()
      || String(form.itemName || "").trim().replace(/\s+/g, "-").toUpperCase();
    if (!rowItemCode) {
      setReserveError("Please select an Item Code.");
      formRootRef.current?.querySelector('input[placeholder="Search Item Code…"]')?.focus();
      return;
    }
    /* P-M-F is required - for Submit and Submit & Print Label alike, before
       anything is added or saved. No value is assumed for it. */
    if (!pmfOf(form)) {
      setReserveError(PMF_REQUIRED_MESSAGE);
      formRootRef.current?.querySelector('[data-field="p_m_f"]')?.focus();
      return;
    }
    /* Checked HERE, before any barcode number is reserved: a zero-price line
       used to be generated, reserved and appended to the grid, and was only
       refused when the whole GRC was submitted - by which time it had spent
       real numbers from the sequence. Same rule as the grid and the API
       (lib/purchasePrice.js). */
    /* THE REQUIRED FIELDS (requiredFieldErrors) - already outlined in red at
       the top of submit(); here the Submit stops, says which fields, and puts
       the cursor in the first of them. Nothing is added, saved or printed. */
    if (Object.keys(requiredErrors).length) {
      const first = Object.keys(requiredErrors)[0];
      /* one problem: its own message (it may be the price rule's, "must be
         more than 0"); several: the fields, by name */
      const keys = Object.keys(requiredErrors);
      setReserveError(keys.length === 1
        ? requiredErrors[first].replace(/\.?$/, ".")
        : "Please fill the required fields: " + keys.map((key) => REQUIRED_LABELS[key] || key).join(", ") + ".");
      formRootRef.current?.querySelector(`[data-field="${first}"]`)?.focus();
      return;
    }
    const priceProblem = purchasePriceError(form.purchaseRate);
    if (priceProblem) {
      setReserveError(priceProblem);
      return;
    }
    /* MTR without Unique is one barcode for the whole length, so with no cut
       typed it takes Total MTR - as it did when Total MTR was copied into
       Cut 1. Only the plan reads it this way; no cut box is written. */
    const planCutRows = form.isMtr && !form.uniqueBarcode && sumCutRows(cutRows) <= 0 && Number(form.totalMtr || 0) > 0
      ? [{ id: 1, value: String(form.totalMtr) }]
      : cutRows;
    /* No cut is ever filled in for the operator, so an MTR entry with none
       typed would make no barcode (Unique) or one of the wrong length. */
    if (form.isMtr) {
      const cutsTotal = sumCutRows(planCutRows);
      const availableMtr = round2(Number(form.totalMtr || 0));
      if (cutsTotal <= 0) {
        setReserveError("Enter at least one cut length in CUTS (MTR).");
        return;
      }
      if (availableMtr > 0 && cutsTotal > availableMtr) {
        setReserveError(`Total cuts (${cutsTotal.toFixed(2)} MTR) exceed the available ${availableMtr.toFixed(2)} MTR. Reduce a cut or correct Total MTR.`);
        return;
      }
    }
    if (reserving) return;                       // guards the double-click

    const generatedRows = [];
    const baseSerial = String(Number(form.serialNo) >= 1 ? form.serialNo : 1).trim();
    const finalPriceValue = Number(form.finalPrice || 0);
    const purchaseRateValue = Number(form.purchaseRate || 0);
    const barcodePlan = buildBarcodePlan({
      uom: form.isMtr ? "MTR" : "PC",
      uniqueBarcode: Boolean(form.uniqueBarcode),
      qtyOrCuts: form.isMtr ? (cutRows.length || Number(form.noOfCuts || 1)) : Number(form.qty || 1),
      totalMtr: Number(form.totalMtr || 0),
      cutRows: planCutRows,
    });

    /* No number is reserved any more - the save route gives every barcode its
       value - so the plan rule that reservation used to enforce is checked
       here: a unique piece quantity must be whole (lib/barcodeEngine.js
       planBarcodes). */
    if (!form.isMtr && form.uniqueBarcode && !Number.isInteger(Number(form.qty || 1))) {
      setReserveError("A unique piece quantity must be a whole number.");
      return;
    }
    setReserveError("");

    barcodePlan.forEach((planItem, index) => {
      generatedRows.push(calculatePrices({
        ...emptyRow(`${Date.now()}-${index}`),
        /* carried through to the saved label (the save route already persists
           oldBarcode), so the new barcode stays traceable to the old one.
           Empty when none was entered - stored as '' to match the schema
           default, never faked or copied from another barcode. */
        oldBarcode: enteredOldBarcode,
        /* the very value the check above passed on */
        itemCode: rowItemCode,
        itemName: form.itemName,
        goodsType: form.goodsType,
        sm: form.sm,
        p_m_f: form.p_m_f,
        hsn: form.hsn,
        hsn2: form.hsn2,
        gst: form.gst,
        uom: form.isMtr ? "MTR" : "PC",
        qty: String(planItem.qty || 0),
        /* the cuts entered - a box left empty is not a cut and makes no barcode */
        noOfCuts: form.isMtr ? String(planCutRows.filter((cut) => Number(cut.value || 0) > 0).length) : "",
        totalMtr: form.isMtr ? String(form.totalMtr || 0) : "",
        purchaseRate: String(purchaseRateValue),
        /* Encoded from the SAME value on the line above, so the two can never
           disagree. Kept as a separate key - purchaseRate stays the real
           number, and the server copies both across (buildDocs is a
           whitelist). '' when no Purchase Rate Code Master is configured. */
        encodedPurchaseRate: encodeRate(String(purchaseRateValue), rateCodeMapping),
        discountType: form.discountType,
        discount: String(form.discount || 0),
        finalPrice: String(finalPriceValue),
        retailPrice: String(form.rspPrice || 0),
        uniqueBarcode: Boolean(form.uniqueBarcode) ? "Yes" : "No",
        /* No barcode value here. The save route gives every new barcode its
           value - SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SERIAL_NO, the Bill Sl
           No. being this row's own and SERIAL_NO the per-Bill-Sl-No running number
           (lib/barcodeValue.js) - and the grid shows the value it will get by
           the same rule. Built here too, the two could
           differ, and a label printed from this copy would not scan as the
           stored barcode. (grcHeader is not in scope here either.) */
        barcodeNo: "",
        /* what the operator typed in row 2, falling back to the old behaviour
           (itemName) so a blank field still saves what it always did - and
           then to the item code, which only ever comes up for an item that
           has no name to fall back on. That case could not arise before: such
           an item was refused by the Item Code check above, so this reaches
           no label that used to print a description. It is the same
           code-then-name order the grid and the label sheet already use. */
        supplierDescription: form.supplierDescription?.trim() || form.itemName?.trim() || rowItemCode,
        printDescription: form.printDescription,
        mode: Boolean(form.uniqueBarcode) ? "unique" : "batch",
        groupId: planItem.groupId || null,
        groupSize: planItem.groupSize || 1,
        billSlNo: String(baseSerial),
        serialNo: nextSerialNo ? String(nextSerialNo) : "",  // Operator-overridable starting Serial No.
        rsp: String(form.rspPrice || 0),
        wsp: String(form.wspPrice || 0),
        dp: String(form.dpPrice || 0),
        offerPrice: form.offerApplicable ? String(form.rspOfferPrice || form.rspPrice || 0) : '',
        wspPrice: form.offerApplicable ? String(form.wspOfferPrice || form.wspPrice || 0) : '',
        dpPrice: form.offerApplicable ? String(form.dpOfferPrice || form.dpPrice || 0) : '',
        rspOfferPct: form.offerApplicable ? form.rspOfferPct : '',
        wspOfferPct: form.offerApplicable ? form.wspOfferPct : '',
        dpOfferPct: form.offerApplicable ? form.dpOfferPct : '',
        markupRSP: form.markupRSP,
        markupWSP: form.markupWSP,
        markupDP: form.markupDP,
      }));
    });

    if (printAfterSubmit && onSubmitAndPrint) await onSubmitAndPrint(generatedRows);
    else onSubmit(generatedRows);

    /* The Bill Sl No. is not bumped after an Add. It is the supplier's line
       number, not a counter of ours: several items can sit on one bill line,
       and the operator moves it on when the bill does. */
    const nextSerial = baseSerial;
    /* the next row is a different physical piece, so its Old Barcode starts
       empty - createBlankForm already clears it, this just clears the
       matching lookup state so the old "loaded" note does not linger */
    resolvedRef.current = "";
    inFlightRef.current = "";
    setLookup({ status: "idle", message: "" });
    setForm((current) => createBlankForm({
      itemId: current.itemId,
      itemName: current.itemName,
      itemCode: current.itemCode,
      hsnId: current.hsnId,
      hsn: current.hsn,
      hsn2Id: current.hsn2Id,
      hsn2: current.hsn2,
      gst: current.gst,
      goodsType: current.goodsType,
      sm: current.sm,
      p_m_f: current.p_m_f,
      printDescription: current.printDescription,
      /* carried forward alongside printDescription - consecutive pieces off
         the same GRC line share the vendor's wording */
      supplierDescription: current.supplierDescription,
      uniqueBarcode: current.uniqueBarcode,
      isMtr: current.isMtr,
      /* MTR stays ticked with one empty cut row (setCutRows below), so No. of
         Cuts says 1 - left blank, the next MTR entry was refused for it */
      noOfCuts: current.isMtr ? "1" : "",
      discountType: current.discountType,
      discount: current.discount,
      markupRSP: current.markupRSP,
      markupWSP: current.markupWSP,
      markupDP: current.markupDP,
      offerApplicable: current.offerApplicable,
      /* the item stays picked, so the offer % it gave stays with it */
      ...Object.fromEntries(OFFER_PCT_KEYS
        .filter((key) => current._autoOffer?.[key] != null)
        .map((key) => [key, fixed2(current._autoOffer[key])])),
      _autoOffer: current._autoOffer || null,
      serialNo: nextSerial,
    }));
    setCutRows([{ id: 1, value: "" }]);
    setCutError("");
    onClose();
  };

  return (
    <div ref={formRootRef} className="mt-4 w-full rounded-[8px] border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4">
          {/* ROW 1: Old Barcode | Item Code | HSN | GST% | SM | P-M-F.

              Four tracks for five fields: HSN and GST% share the third cell.
              GST% is normally not typed - it is derived from whichever HSN is
              picked and the row's value - so sitting them side by side is how
              the operator checks the pick landed. It stays editable for the
              transaction that needs a different rate. They are two separate
              controls; the grouping is only the cell they share.

              Explicit widths rather than equal quarters: GST% holds two digits
              and the two add-on inputs share the final track. The two-column
              md: stage exists because the sidebar is a
              fixed 280px - at 768px viewport a four-across row leaves each
              field about 90px, which is unreadable. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_270px_230px]">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Old Barcode</label>
              <input
                value={form.oldBarcode}
                autoFocus
                placeholder="Enter / Scan Old Barcode"
                onChange={(event) => {
                  const next = event.target.value;
                  setForm((current) => ({ ...current, oldBarcode: next }));
                  if (lookup.status !== "idle") setLookup({ status: "idle", message: "" });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    lookupOldBarcode(event.currentTarget.value);
                  }
                }}
                onBlur={(event) => lookupOldBarcode(event.currentTarget.value)}
                className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
              />
              {lookup.status !== "idle" && (
                <p className={`text-[11px] ${
                  lookup.status === "error" ? "text-red-600"
                    : lookup.status === "found" ? "text-green-700"
                      : "text-gray-500"
                }`}>
                  {lookup.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Item Code *</label>
              <SearchSelect
                placeholder="Search Item Code…"
                /* the code counts as selected too: an Old Barcode fills the
                   code, but stored barcodes carry no item id */
                value={form.itemId || form.itemCode}
                label={itemLabel}
                onSearch={searchItems}
                options={itemOptions}
                loading={itemLoading}
                onSelect={(opt) => handleItemSelection(opt)}
                onClear={() => handleItemSelection(null)}
                editableClass={editableClass}
              />
            </div>

            {/* HSN + GST% - grouped in one cell, still two separate controls */}
            <div className="grid grid-cols-[minmax(0,1fr)_86px] gap-2">
              {renderHsnField()}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">GST% *</label>
                {/* decimal2 keeps this to a number the rate can actually be -
                    a GST rate is a positive percentage, never a minus sign or
                    a second decimal point */}
                <input
                  value={form.gst}
                  inputMode="decimal"
                  title="Filled from the HSN's tax slab - edit to override for this row"
                  onChange={(event) => updateField("gst", decimal2(event.target.value))}
                  className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">SM(Number)</label>
                <input type="number" step="1" min={0} value={form.sm} onChange={(event) => updateField("sm", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">P-M-F *</label>
                <input data-field="p_m_f" value={form.p_m_f} onChange={(event) => updateField("p_m_f", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
              </div>
            </div>
          </div>

          {/* ROW 2: [Bill Sl No.] | Serial No. | Supplier Description | Print Description.

              Bill Sl No. is the supplier's bill line number (3rd part of barcode),
              hidden while SHOW_BILL_SL_NO is off - its value still travels.
              Serial No. is the auto-incrementing counter per Bill Sl No. (4th part of barcode).
              Row 2 Serial No. is EDITABLE - the operator can override the auto-suggested value. */}
          <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 ${SHOW_BILL_SL_NO ? "xl:grid-cols-[90px_90px_minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)]"}`}>
            {SHOW_BILL_SL_NO && <SerialNoField value={form.serialNo} onChange={updateSerialNo} editableClass={editableClass} />}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Serial No. *</label>
              <div className="relative">
                <input
                  value={nextSerialNo ?? ""}
                  inputMode="numeric"
                  aria-label="Serial No."
                  placeholder="1"
                  onWheel={(event) => event.currentTarget.blur()}
                  onChange={(event) => {
                    const digits = String(event.target.value).replace(/\D/g, "");
                    setNextSerialNo(digits === "" ? "" : Number(digits));
                  }}
                  className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`}
                />
                {serialNoLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-600">Loading...</div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Supplier Description</label>
              <input value={form.supplierDescription} title={form.supplierDescription} onChange={(event) => updateField("supplierDescription", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Print Description</label>
              <input value={form.printDescription} title={form.printDescription} onChange={(event) => updateField("printDescription", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
            </div>
          </div>

          {/* ROW 3: [Bill Sl No.] | Serial No. | HSN (second, independent) | Unique Barcode | MTR.

              Bill Sl No. here is a locked read-back of the value entered in row 2
              — one value, two windows, hidden with it. Serial No. shows the next
              auto-increment value. */}
          <div className={`mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 ${SHOW_BILL_SL_NO ? "xl:grid-cols-[90px_90px_170px_230px_230px]" : "xl:grid-cols-[90px_170px_230px_230px]"}`}>
            {SHOW_BILL_SL_NO && <SerialNoField value={form.serialNo} readOnlyClass={readOnlyClass} locked />}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-700">Serial No. *</label>
              <div className="relative">
                <input
                  value={nextSerialNo ?? ""}
                  inputMode="numeric"
                  aria-label="Serial No."
                  placeholder="1"
                  readOnly
                  tabIndex={-1}
                  onWheel={(event) => event.currentTarget.blur()}
                  className={`w-full rounded-md px-2 py-2 text-sm ${readOnlyClass} cursor-not-allowed pr-7`}
                />
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
            </div>

            {renderHsn2Field()}

            <div className="flex items-end gap-0">
              <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.uniqueBarcode} onChange={(event) => updateField("uniqueBarcode", event.target.checked)} className="h-4 w-4 accent-[#0d5ddc]" /> Unique Barcode
              </label>
              <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isMtr} onChange={(event) => {
                  const checked = event.target.checked;
                  updateField("isMtr", checked);
                  setCutError("");
                  if (checked) {
                    const count = Math.max(1, Number(form.noOfCuts || 1));
                    updateField("noOfCuts", String(count));
                    setCutRows(makeMeterCutRows(count, Number(form.totalMtr || 0)));
                  } else {
                    setFocusedCutIndex(0);
                    setCutRows([{ id: 1, value: "" }]);
                  }
                }} className="h-4 w-4 accent-[#0d5ddc]" /> MTR
              </label>
              <label className="flex w-fit cursor-pointer items-center justify-start gap-3 whitespace-nowrap rounded-md border border-[#dfe4eb] bg-white px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.offerApplicable} onChange={(event) => updateField("offerApplicable", event.target.checked)} className="h-4 w-4 accent-[#0d5ddc]" /> OFFER APPLICABLE
              </label>
            </div>
          </div>

          {/* What the two boxes above resolve to, by the same rule the label
              printer uses (lib/barcodeLabelPrint.js) - so there is one answer
              to "is this Unique, MTR or Batch" and the operator can see it.
              MTR and Unique are not exclusive here: MTR + Unique is one barcode
              per cut, MTR alone one barcode for the whole length, and either
              way it is metres of cloth - MTR, 2 labels. Unique unticked on a
              piece item is a BATCH barcode: one barcode for the whole
              quantity, and Print asks how many labels. */}
          {(() => {
            const type = resolveLabelMode({
              uom: form.isMtr ? "MTR" : "PC",
              uniqueBarcode: form.uniqueBarcode ? "Yes" : "No",
              mode: form.uniqueBarcode ? "unique" : "batch",
            }).mode;
            return (
              <div className="mt-2 text-right text-xs text-gray-600">
                Barcode type: <span className="font-bold text-gray-800">{type}</span>
                {type === LABEL_MODE.METER ? " - 2 labels per barcode"
                  : type === LABEL_MODE.UNIQUE ? " - 1 label per barcode"
                    : " - one barcode for the whole quantity; you choose how many labels when printing"}
              </div>
            );
          })()}

          <div className="mt-5">
            <div className="mb-4 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Price Calculation</div>

            {SHOW_SUPPLIER_PRICE_SETUP && <SupplierPriceSetupPanel setup={priceSetup} />}

            {/* Price Calculation grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">{form.isMtr ? "No. of Cuts *" : "Quantity *"}</label>
                {form.isMtr ? (
                  <input data-field="noOfCuts" type="number" min={1} value={form.noOfCuts} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => {
                    const raw = event.target.value;
                    updateField("noOfCuts", raw);

                    /* blank or not a count yet (mid-edit): the rows and the cuts
                       in them stay exactly as they are */
                    const count = Number(raw);
                    if (raw === "" || !Number.isFinite(count) || count <= 0) return;

                    setCutError("");
                    setCutRows((current) => resizeCutRows(current, count));
                  }} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("noOfCuts")}`} />
                ) : (
                  <input data-field="qty" type="text" inputMode="decimal" value={form.qty} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("qty", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("qty")}`} />
                )}
                {fieldError(form.isMtr ? "noOfCuts" : "qty")}
              </div>

              {form.isMtr && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-700">Total MTR *</label>
                  {/* the available length the CUTS (MTR) balance is worked from -
                      it no longer writes itself into Cut 1, nor clears the cuts */}
                  <input type="number" min={0} step="0.01" value={form.totalMtr} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => {
                    updateField("totalMtr", event.target.value);
                    setCutError("");
                  }} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}`} />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Purchase Rate *</label>
                <input data-field="purchaseRate" type="text" inputMode="decimal" value={form.purchaseRate} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("purchaseRate", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("purchaseRate")}`} />
                {fieldError("purchaseRate")}
                {/* Read-only echo of the SAME value through the Purchase Rate
                    Code Master. The input above keeps the real number - this
                    is only what a label would print. Hidden entirely when no
                    mapping is configured, rather than showing a half-encoded
                    string. */}
                {encodedPurchaseRate && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    Encoded: <span className="font-mono font-semibold text-gray-700">{encodedPurchaseRate}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Discount Type</label>
                <select data-field="discountType" value={form.discountType} onChange={(event) => updateField("discountType", event.target.value)} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("discountType")}`}>
                  {/* a type that is neither (an old record) shows as blank, and
                      Submit asks for one rather than guessing */}
                  {!DISCOUNT_TYPES.includes(form.discountType) && <option value="">Select</option>}
                  <option value="Percentage">Percentage</option>
                  <option value="Flat">Flat</option>
                </select>
                {fieldError("discountType")}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Discount *</label>
                <input data-field="discount" type="text" inputMode="decimal" value={form.discount} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateField("discount", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("discount")}`} />
                {fieldError("discount")}
              </div>

              {!form.isMtr && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-700">Final Price *</label>
                  {/* worked out, never typed - so not a Tab stop: Tab goes from
                      Discount straight on to the next box that takes input */}
                  <input data-field="finalPrice" value={form.finalPrice} readOnly tabIndex={-1} className={`w-full rounded-md px-2 py-2 text-sm font-semibold ${readOnlyClass}${invalid("finalPrice")}`} />
                  {fieldError("finalPrice")}
                </div>
              )}
            </div>

            <div className="mt-5 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Mark up on Net Price</div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Markup RSP % *</label>
                <input data-field="markupRSP" type="text" inputMode="decimal" value={form.markupRSP} onChange={(event) => updateMarkupValue("markupRSP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupRSP")}`} />
                {fieldError("markupRSP")}
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">RSP Price *</label>
                <input data-field="rspPrice" type="text" inputMode="decimal" value={form.rspPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("rspPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("rspPrice")}`} />
                {fieldError("rspPrice")}
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Markup WSP % *</label>
                <input data-field="markupWSP" type="text" inputMode="decimal" value={form.markupWSP} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("markupWSP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupWSP")}`} />
                {fieldError("markupWSP")}
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">WSP Price *</label>
                <input data-field="wspPrice" type="text" inputMode="decimal" value={form.wspPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("wspPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("wspPrice")}`} />
                {fieldError("wspPrice")}
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">Markup E-COMM % *</label>
                <input data-field="markupDP" type="text" inputMode="decimal" value={form.markupDP} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("markupDP", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("markupDP")}`} />
                {fieldError("markupDP")}
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">E-COMM Price *</label>
                <input data-field="dpPrice" type="text" inputMode="decimal" value={form.dpPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateMarkupValue("dpPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${editableClass}${invalid("dpPrice")}`} />
                {fieldError("dpPrice")}
              </div>
            </div>

            <div className="mt-5 text-center text-[15px] font-bold uppercase tracking-wide underline decoration-[1.5px] underline-offset-4">Offer Price /Mark Down</div>
            {offerNote && <div className="mt-2 text-center text-[11px] text-amber-700" data-testid="offer-note">{offerNote}</div>}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">RSP Offer %</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.rspOfferPct} onChange={(event) => updateOfferValue("rspOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">RSP Offer Price</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.rspOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("rspOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">WSP Offer %</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.wspOfferPct} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("wspOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">WSP Offer Price</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.wspOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("wspOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">E-COMM Offer %</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.dpOfferPct} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("dpOfferPct", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-700">E-COMM Offer Price</label>
                <input disabled={!form.offerApplicable} type="text" inputMode="decimal" value={form.dpOfferPrice} onWheel={(e) => e.currentTarget.blur()} onChange={(event) => updateOfferValue("dpOfferPrice", decimal2(event.target.value))} className={`w-full rounded-md px-2 py-2 text-sm ${form.offerApplicable ? editableClass : readOnlyClass}`} />
              </div>
            </div>

            {form.isMtr && (() => {
              /* worked out on every render from the boxes and Total MTR - never
                 stored, and never written into a cut */
              const cutsTotal = sumCutRows(cutRows);
              const availableMtr = round2(Number(form.totalMtr || 0));
              const hasAvailable = availableMtr > 0;
              const balanceMtr = round2(availableMtr - cutsTotal);
              const overAvailable = hasAvailable && balanceMtr < 0;
              /* side by side only from lg: with the 280px sidebar open, a
                 tablet-width content area cannot hold both */
              const cutGrid = "grid grid-cols-[40px_minmax(0,1fr)_32px] items-center gap-2 sm:grid-cols-[40px_minmax(0,220px)_32px]";
              return (
                <div className="mt-5 rounded-md border border-[#dfe4eb] bg-[#f8fafc] p-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
                    <div className="w-full lg:w-auto">
                      <div className={`${cutGrid} px-0.5`}>
                        <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">SL</div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Cut (MTR)</div>
                        <div />
                      </div>

                      {cutRows.map((cut, index) => (
                        <div key={cut.id ?? index} className={`mt-1 rounded-md p-0.5 ${cutGrid} ${index === focusedCutIndex ? "bg-orange-50" : ""}`}>
                          <div className={`flex h-8 items-center justify-center rounded-md border border-gray-300 text-xs font-medium text-gray-700 ${index === focusedCutIndex ? "bg-orange-100" : "bg-[#f3f5f9]"}`}>{index + 1}</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`Cut ${index + 1} (MTR)`}
                            value={cut.value}
                            ref={(el) => { cutsInputRefs.current[index] = el; }}
                            onFocus={() => setFocusedCutIndex(index)}
                            onChange={(event) => {
                              /* a refused or cleaned-up keystroke: put the kept
                                 text back here, caret where it was, so React
                                 finds nothing to rewrite and the caret does not
                                 jump to the end */
                              const input = event.target;
                              const typed = input.value;
                              const caret = input.selectionStart ?? typed.length;
                              const kept = updateCutValue(index, typed);
                              if (kept !== typed) {
                                const at = Math.max(0, Math.min(kept.length, caret - (typed.length - kept.length)));
                                input.value = kept;
                                input.setSelectionRange(at, at);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Tab" && !e.shiftKey && index < cutRows.length - 1) {
                                e.preventDefault();
                                cutsInputRefs.current[index + 1]?.focus();
                              } else if (e.key === "Tab" && e.shiftKey && index > 0) {
                                e.preventDefault();
                                cutsInputRefs.current[index - 1]?.focus();
                              }
                            }}
                            className={`h-8 w-full rounded-md px-2 text-sm tabular-nums ${index === focusedCutIndex ? "border border-orange-300 bg-orange-50" : editableClass} focus:border-[#0d5ddc] focus:outline-none focus:ring-2 focus:ring-[#0d5ddc]/20`}
                          />
                          <div className="flex h-8 items-center justify-center">
                            {index === cutRows.length - 1 ? (
                              <button type="button" tabIndex={-1} onClick={addCutRow} aria-label="Add cut" title="Add cut" className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2fbf6c] text-base font-bold text-white">+</button>
                            ) : (
                              <button type="button" tabIndex={-1} onClick={() => removeCutRow(index)} aria-label={`Remove cut ${index + 1}`} title="Remove cut" className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e34a3a] text-lg font-bold text-white">−</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="w-full lg:w-64">
                      <dl className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm" aria-live="polite">
                        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <dt className="text-gray-600">Total Cuts (MTR)</dt>
                          <dd className="font-semibold tabular-nums text-gray-800">{cutsTotal.toFixed(2)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <dt className="text-gray-600">Available (MTR)</dt>
                          <dd className="font-semibold tabular-nums text-gray-800">{hasAvailable ? availableMtr.toFixed(2) : "-"}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <dt className="text-gray-600">Balance (MTR)</dt>
                          <dd className={`font-semibold tabular-nums ${overAvailable ? "text-red-600" : hasAvailable && balanceMtr === 0 ? "text-green-700" : "text-gray-800"}`}>{hasAvailable ? balanceMtr.toFixed(2) : "-"}</dd>
                        </div>
                      </dl>
                      {!hasAvailable && <p className="mt-1 text-[11px] text-gray-500">Enter Total MTR to see the balance.</p>}
                    </div>
                  </div>

                  {(cutError || overAvailable) && (
                    <div role="alert" className="mt-2 rounded border border-[#f5c2c7] bg-[#f8d7da] px-3 py-1.5 text-[12px] text-[#842029]">
                      {cutError || `Total cuts (${cutsTotal.toFixed(2)} MTR) exceed the available ${availableMtr.toFixed(2)} MTR. Reduce a cut or correct Total MTR.`}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            {reserveError && <div className="mb-2 w-full rounded border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[13px] text-[#842029]">{reserveError}</div>}
            <button type="button" disabled={reserving} onClick={() => submit(false)} className="rounded-md bg-[#0d5ddc] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(13,93,220,0.35)] transition hover:bg-[#0b4bb6] disabled:opacity-60">{reserving ? "Reserving barcodes..." : "Submit"}</button>
            <button type="button" disabled={reserving} onClick={() => submit(true)} className="rounded-md bg-[#198754] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(25,135,84,0.3)] transition hover:bg-[#146c43] disabled:opacity-60">Submit &amp; Print Label</button>
          </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Labels.

   Which barcode type a row is, what goes ON its label and how MANY labels it
   gets are all decided in lib/barcodeLabelPrint.js, not here - the same
   module GET /api/grc/[id] uses to stamp each row's barcodeType/labelCount -
   so this screen's preview, its print run and the GRC Barcode Print page
   cannot drift apart:

     resolveLabelMode     UNIQUE / MTR / BATCH, from the uomType / batchType
                          the save route stores (or, for a row not saved yet,
                          what it WILL store)
     getLabelPrintCount   UNIQUE 1 / MTR 2 / BATCH as the operator enters
     toLabelData          the whitelisted label content, read by
                          BarcodeLabelSheet

   Two helpers that lived here went with that. toLabelRow copied the GRC
   header's supplier name and GRC number, and the bill serial, onto every row
   so the sticker could print "supplier · GRC · Sl n"; a label no longer
   receives any of it. defaultCopies seeded a count the operator could then
   type over - a metre barcode could go out as five stickers, a unique one
   as fifty, and a batch defaulted to its entire quantity. Counts now follow
   the rule, and a batch asks.
   ========================================================================== */

function PrintLabelPicker({ rows, open, onClose }) {
  const scope = useScope();
  const [selected, setSelected] = useState([]);
  /* The operator's answer for each BATCH barcode, keyed by barcode number.
     UNIQUE and MTR barcodes never get an entry: their count is the rule
     (lib/barcodeLabelPrint.js), not something to type. */
  const [batchCounts, setBatchCounts] = useState({});
  /* the open "Print Batch Labels" dialog - { key, continueToPrint } */
  const [batchPrompt, setBatchPrompt] = useState(null);

  /* label geometry - the sticker stock this tenant actually buys */
  const [formats, setFormats] = useState([]);
  const [formatName, setFormatName] = useState('');
  const [paper, setPaper] = useState('a4');

  /* the print run: mounted -> measured -> dialog. See runPrint below. */
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const printRootRef = useRef(null);
  /* how many labels this particular run was asked for - frozen at the click */
  const wantedRef = useRef(0);
  /* Taken synchronously the moment a run is asked for and released when it
     ends, so a double click, a double confirm in the batch dialog or a
     re-render cannot start a second run - and a second print dialog - for
     one action. `printing` alone cannot do it: state set in a click is not
     visible to a second click that lands before the re-render. */
  const printLockRef = useRef(false);

  /* Seeded when the picker OPENS, and not again while it is open.

     `rows` is a fresh array on every parent render, and saving calls
     router.refresh() - so keying this on rows meant a refresh landing behind
     the open picker silently threw away whatever the operator had ticked and
     typed, and put the defaults back.

     Every barcode starts ticked. No batch count is assumed: a batch barcode
     is asked about when it is printed, or when its Set quantity is pressed. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) { wasOpen.current = false; return; }
    if (wasOpen.current) return;
    wasOpen.current = true;

    setSelected(rows.map(labelKey).filter(Boolean));
    setBatchCounts({});
    setBatchPrompt(null);
  }, [open, rows]);

  /* Label formats, loaded the same way the Inventory print screen loads them
     (components/BarcodePrintLabel.jsx): the whole seeded catalog is offered,
     and the format ticked as Default in Settings -> Barcode Label Settings is
     preselected. This screen previously loaded NO geometry at all, so a label
     had no physical size to be printed at. */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const qs = new URLSearchParams({
        business: scope.business || '',
        location: scope.location || '',
        finYear: scope.finYear || '',
      });
      const [chosen, catalog] = await Promise.all([
        fetch('/api/barcode-label-setting?' + qs).then((r) => r.json()).catch(() => ({})),
        fetch('/api/catalog?name=barcodeLabels').then((r) => r.json()).catch(() => ({})),
      ]);
      if (cancelled) return;

      const list = catalog.rows || [];
      setFormats(list);

      const ticked = ((chosen.doc && chosen.doc.rows) || []).filter((r) => r.choice);
      const preferred = ticked.find((t) => t.isDefault)?.name || ticked[0]?.name;
      setFormatName(list.some((c) => c.name === preferred) ? preferred : (list[0]?.name || ''));
    })();

    return () => { cancelled = true; };
  }, [open, scope.business, scope.location, scope.finYear]);

  const format = useMemo(
    () => formats.find((f) => f.name === formatName) || null,
    [formats, formatName]
  );

  /* every row that has a barcode to print, and the ones currently ticked */
  const printable = useMemo(() => rows.filter((row) => labelKey(row)), [rows]);
  const chosen = useMemo(
    () => printable.filter((row) => selected.includes(labelKey(row))),
    [printable, selected]
  );

  /* The ticked barcodes, each carrying its sticker count as `copies` - from
     getLabelPrintCount, through withLabelCounts. The preview AND the print
     surface are both built from this one list, so the screen cannot show a
     different number of labels from the number that is printed. A batch with
     no count yet carries 0 and is simply not on the sheet. */
  const selectedRows = useMemo(() => withLabelCounts(chosen, batchCounts), [chosen, batchCounts]);

  /* the count shown against every barcode in the list, ticked or not */
  const countByKey = useMemo(
    () => Object.fromEntries(withLabelCounts(printable, batchCounts).map((row) => [labelKey(row), row.copies])),
    [printable, batchCounts]
  );

  /* what the printer is being asked for, counted from the same list the sheet
     is built from - this is the number the readiness check has to find drawn */
  const expectedLabels = useMemo(
    () => selectedRows.reduce((total, row) => total + (row.copies || 0), 0),
    [selectedRows]
  );

  /* ticked BATCH barcodes that have not been given a count yet */
  const pendingBatch = useMemo(() => pendingBatchRows(chosen, batchCounts), [chosen, batchCounts]);

  /* Paper. A4 is the default because that is what a desktop printer and
     "Microsoft Print to PDF" are loaded with; the sticker-stock option sets
     the page to one physical sheet from the catalog, which is what a label
     printer feeds.

     On sticker stock the sheet IS the page, so a gutter between labels would
     push the last column off the edge of the paper - hence gap 0 there, and
     a 1mm cut line on a sheet of A4 that somebody has to guillotine. */
  /* ONE call, so this page and the Barcode Generation picker cannot arrive
     at two different sheets from one format. labelRun fits the labels inside
     the page's PRINTABLE width - the sheet less the unprintable edge the
     printer's grippers take - which is what stops the leading sticker's
     barcode number being clipped on stock. */
  const run = labelRun(format, paper);
  const { gap, pageRule, stockSize } = run;

  /* ---------------------------------------------------------------- print --
     window.print() photographs the DOM as it stands at the instant it is
     called. It used to be called straight out of the click handler, before
     React had committed anything and before JsBarcode had drawn a single bar,
     so what went to the printer was whatever happened to be on screen.

     The run is therefore staged. `printing` mounts the sheet; the effect
     below waits for the browser to have actually finished with it, checks
     that every barcode it was asked for is really there, and only then opens
     the dialog. No timers: each await is a real signal from the browser. */
  useEffect(() => {
    if (!printing) return undefined;
    let cancelled = false;

    /* The class is what arms the print rules in globals.css. Gating them on it
       rather than on the mere existence of the sheet means every other print
       screen in the application - and this one at any other moment - keeps
       printing exactly the way it does today. Removed in the cleanup below,
       so there is no state to unwind by hand. */
    document.body.classList.add('printing-labels');

    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);

    (async () => {
      try {
        /* Fonts first. The code, the price and the description are text; print
           before the face has loaded and they are measured with fallback
           metrics and re-flow inside a fixed-size sticker. */
        if (document.fonts && document.fonts.ready) {
          try { await document.fonts.ready; } catch { /* unsupported - the frames below still gate on layout */ }
        }
        if (cancelled) return;

        /* Two frames. The first lets React's commit reach the screen, the
           second lets the browser lay out the SVG children JsBarcode appended
           synchronously during that commit. */
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (cancelled) return;

        const root = printRootRef.current;
        const drawn = root ? Array.from(root.querySelectorAll('svg[data-barcode]')) : [];
        const blank = drawn.filter((svg) => {
          const box = svg.getBoundingClientRect();
          return !svg.firstChild || box.width < 1 || box.height < 1;
        });

        const wanted = wantedRef.current;
        if (!root || drawn.length !== wanted || blank.length) {
          /* Refusing to open the dialog is the point. A run that is short a
             label, or carries an empty box where a barcode should be, produces
             stickers that cannot be scanned and goods that cannot be found -
             and the operator would have no way of knowing until the till. */
          setPrintError(
            'Printing stopped: ' + drawn.length + ' of ' + wanted +
            ' barcodes were drawn' + (blank.length ? ', ' + blank.length + ' of them empty' : '') +
            '. Nothing was sent to the printer.'
          );
          setPrinting(false);
          return;
        }

        setPrintError('');
        window.print();

        /* afterprint is the signal that the dialog is finished with, and in
           every current browser print() has already blocked until then. The
           frame below is the belt to that braces: it hands control back once
           more so a browser whose print() returns EARLY still has its
           afterprint delivered first, and the sheet is never pulled out from
           under a dialog that is still reading it. */
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!cancelled) setPrinting(false);
      } catch (error) {
        /* Without this the run could end with `printing` stuck true - which
           leaves printing-labels welded to <body>, and every LATER print
           anywhere in the application comes out blank. */
        console.error('Barcode label print failed', error);
        setPrintError('Printing stopped: the label sheet could not be prepared. Nothing was sent to the printer.');
        setPrinting(false);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-labels');
    };
    /* expectedLabels is deliberately NOT a dependency. It is read from a ref
       taken when Print was pressed, because the picker stays interactive
       behind the dialog: nudging a copy count mid-run would otherwise re-run
       this effect and open a SECOND print dialog for the same click. */
  }, [printing]);

  /* Closing the picker abandons the run. The component is not unmounted when
     it closes - it just renders null - so a run left in flight would keep the
     body class on and re-run the check against a sheet that is no longer
     there, reporting a failure nobody caused. */
  useEffect(() => {
    if (!open) {
      setPrinting(false);
      setPrintError('');
    }
  }, [open]);

  /* the run is over - printed, refused or abandoned - so the next click may
     start one */
  useEffect(() => {
    if (!printing) printLockRef.current = false;
  }, [printing]);

  /* Starts ONE print run, sized from the counts passed in rather than from
     state: the batch dialog's confirm records a count AND starts the run in
     the same click, and a count set in that click cannot be read back from
     state until the next render. The sheet is rendered from state, which by
     then holds the same counts - so the readiness check still compares the
     number asked for with the number drawn. */
  function startPrint(counts) {
    if (printLockRef.current) return;
    const wanted = withLabelCounts(chosen, counts).reduce((total, row) => total + (row.copies || 0), 0);
    if (!wanted) {
      setPrintError('Nothing is selected to print.');
      return;
    }
    printLockRef.current = true;
    setPrintError('');
    wantedRef.current = wanted;
    setPrinting(true);
  }

  /* Print. A ticked BATCH barcode with no count is asked about first - one
     "Print Batch Labels" dialog per batch barcode, in list order - and the
     last answer starts the run. UNIQUE and MTR are never asked about. */
  function runPrint() {
    if (printLockRef.current) return;
    setPrintError('');
    if (pendingBatch.length) {
      setBatchPrompt({ key: labelKey(pendingBatch[0]), continueToPrint: true });
      return;
    }
    startPrint(batchCounts);
  }

  /* The dialog only ever hands over a count validateBatchLabelCount accepted. */
  function confirmBatchCount(value) {
    if (!batchPrompt) return;
    const next = { ...batchCounts, [batchPrompt.key]: value };
    setBatchCounts(next);
    if (!batchPrompt.continueToPrint) { setBatchPrompt(null); return; }
    const remaining = pendingBatchRows(chosen, next);
    if (remaining.length) {
      setBatchPrompt({ key: labelKey(remaining[0]), continueToPrint: true });
      return;
    }
    setBatchPrompt(null);
    startPrint(next);
  }

  if (!open) return null;

  const promptRow = batchPrompt ? printable.find((row) => labelKey(row) === batchPrompt.key) || null : null;

  /* The box is capped to the viewport and scrolls INTERNALLY.

     It used to be an uncapped panel inside a centred `fixed inset-0` overlay.
     Once enough barcodes were generated the list and the preview cards grew
     taller than the screen, and because the panel was centred it overflowed
     off BOTH the top and the bottom with no scrollbar anywhere to reach it -
     the Print and Close buttons included. The overlay covers the whole
     viewport, so the wheel could not scroll the page behind it either, and
     the screen read as frozen.

     max-h + flex-col + an overflow-y-auto body fixes all of that: the list
     scrolls, the header and footer stay put, and nothing is ever pushed out
     of reach. */
  return (
    /* no-print: the picker itself is never paper. An operator who reaches for
       Ctrl+P instead of the Print button would otherwise send this dialog -
       checkboxes, copy counts and all - to the printer. */
    <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <BatchLabelCountDialog
        open={Boolean(batchPrompt)}
        barcode={promptRow ? promptRow.barcodeNo || '' : ''}
        description={promptRow ? (promptRow.printDescription || promptRow.itemName || promptRow.supplierDescription || '') : ''}
        available={batchAvailableQty(promptRow)}
        initialValue={batchPrompt ? (batchCounts[batchPrompt.key] ?? '') : ''}
        onCancel={() => setBatchPrompt(null)}
        onConfirm={confirmBatchCount}
      />
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[960px] flex-col rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-lg font-semibold">Print Label Picker</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-500">×</button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          <div>
            {printable.length === 0 && <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">No barcode generated yet.</div>}
            {printable.map((row, index) => {
              const key = labelKey(row);
              const { mode, assumed } = resolveLabelMode(row);
              const count = countByKey[key] || 0;
              return (
                <div key={key || index} className="mb-3 flex items-center gap-3 rounded border border-gray-200 p-2">
                  <input type="checkbox" checked={selected.includes(key)} onChange={() => setSelected((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{row.itemCode || row.itemName || row.supplierDescription || "Item"}</div>
                    {/* the unit's own barcodeNo only - the composed value
                        ("G1319*05183*1*1") is hidden here (user, 2026-09-17) */}
                    <div className="font-mono text-xs text-gray-600" style={{ textTransform: "none" }}>
                      {row.barcodeNo}
                    </div>
                  </div>
                  {/* The count is the rule's, not an input: an MTR barcode
                      is always two stickers and a unique one always one. Only
                      a batch is the operator's to decide, through the same
                      dialog Print opens. */}
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold text-gray-700">
                      {mode === LABEL_MODE.METER ? 'Meter' : mode === LABEL_MODE.BATCH ? 'Batch' : 'Unique'}
                    </div>
                    {mode === LABEL_MODE.BATCH && isUnprintableBatch(row) ? (
                      /* No whole quantity recorded, so no count can ever be
                         valid. Print does not ask about it (pendingBatchRows
                         leaves it out) - asking would only block every other
                         label - so it says here why it prints nothing. */
                      <div className="text-red-700">No quantity recorded - cannot print</div>
                    ) : mode === LABEL_MODE.BATCH ? (
                      <>
                        <div className={count ? 'text-gray-600' : 'text-amber-700'}>
                          {count ? count + ' label' + (count === 1 ? '' : 's') : 'Quantity not set'}
                        </div>
                        <button
                          type="button"
                          disabled={printing}
                          onClick={() => setBatchPrompt({ key, continueToPrint: false })}
                          className="mt-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {count ? 'Change' : 'Set quantity'}
                        </button>
                      </>
                    ) : (
                      <div className="text-gray-600">{count} label{count === 1 ? '' : 's'}</div>
                    )}
                    {assumed && (
                      <div className="text-amber-700" title="No Unique / Batch type is recorded for this barcode, so it prints as one label.">
                        Type not recorded
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The preview is the SAME component, with the SAME rows and the
              SAME geometry that the print sheet below is built from, so what
              is on screen and what comes out of the printer cannot drift
              apart. It used to be a hand-drawn card whose "barcode" was a
              striped CSS background - it encoded nothing, and being a
              background image Chrome would have dropped it from the paper
              even if the rest had worked. */}
          <div className="rounded border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-baseline justify-between text-sm font-semibold">
              <span>Preview</span>
              <span className="text-[11px] font-normal text-gray-500">
                {expectedLabels} label{expectedLabels === 1 ? '' : 's'}
                {format?.labelSize ? ' · ' + format.labelSize : ''}
              </span>
            </div>
            {chosen.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Select a barcode to preview.</div>
            ) : expectedLabels === 0 ? (
              <div className="rounded border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
                {pendingBatch.length
                  ? 'Set the number of labels for the batch barcode' + (pendingBatch.length === 1 ? '' : 's')
                    + ' to preview ' + (pendingBatch.length === 1 ? 'it' : 'them') + ' - Print will ask.'
                  : 'Nothing to print.'}
              </div>
            ) : (
              <>
                {/* A batch is never previewed at a quantity nobody chose, so
                    say what is missing rather than show a short sheet
                    silently. */}
                {pendingBatch.length > 0 && (
                  <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    {pendingBatch.length} batch barcode{pendingBatch.length === 1 ? ' is' : 's are'} not in the preview yet - Print will ask how many labels.
                  </div>
                )}
                <div className="overflow-auto rounded border border-gray-300 bg-white p-2">
                  {/* GrcBarcodeLabelSheet is the same component the
                      barcode-print page renders, so Preview = Print exactly. */}
                  <GrcBarcodeLabelSheet rows={selectedRows} format={format} gap={gap} page={run.page} />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          {printError && (
            <span className="mr-auto text-sm font-medium text-red-700">{printError}</span>
          )}

          <label className="flex items-center gap-1 text-xs text-gray-600">
            Label
            <select
              value={formatName}
              onChange={(event) => setFormatName(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {formats.length === 0 && <option value="">Default 50 x 40 mm</option>}
              {formats.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-1 text-xs text-gray-600">
            Paper
            <select
              value={paper}
              onChange={(event) => setPaper(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="a4">A4 sheet</option>
              <option value="stock" disabled={!stockSize}>
                {stockSize ? 'Label stock ' + format.pageSize : 'Label stock (no size set)'}
              </option>
            </select>
          </label>

          {/* event.detail > 1 is the second click of a double click. The lock
              cannot stop it on its own: the real window.print() blocks while
              the print dialog is open, the lock is released when it returns,
              and a second click queued behind the dialog would then open it
              again. A single click is detail 1 and the keyboard detail 0. */}
          <button type="button" disabled={printing} onClick={(event) => { if (event.detail > 1) return; runPrint(); }} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">{printing ? 'Preparing...' : 'Print'}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700">Close</button>
        </div>
      </div>

      {/* THE PRINT SURFACE.

          Portaled to <body> so it is a sibling of the application rather than
          a descendant of this modal. That matters: the modal is
          `fixed inset-0` with a `max-h` scrolling body, and Chrome prints a
          fixed box on the first page only and clips an overflow box instead
          of paginating it - a sheet of labels left inside it would have come
          out as one truncated page however the CSS was written.

          At <body> level the sheet is ordinary in-flow content that fragments
          across as many pages as it needs, and the @media print rules in
          globals.css take the rest of the application out of the box tree so
          not one sheet of paper is spent on it. */}
      {printing && typeof document !== 'undefined' && createPortal(
        <div id="barcode-print-root" ref={printRootRef}>
          <style>{pageRule}</style>
          {/* GrcBarcodeLabelSheet matches the print page exactly — same
              component, same 2-column grid, same Label, same data contract. */}
          <GrcBarcodeLabelSheet rows={selectedRows} format={format} gap={gap} page={run.page} />
        </div>,
        document.body
      )}
    </div>
  );
}

export default function GCRBarcodeGeneration({ grcId = null, initialRows = NO_ROWS, supplierMarkup = {}, supplierPriceSetup = null, grcHeader = {}, onSaved = null }) {
  const router = useRouter();
  const scope = useScope();

  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState("items");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [printRows, setPrintRows] = useState([]);
  const [showAddItem, setShowAddItem] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  /* why the last save was refused, in the server's own words */
  const [saveError, setSaveError] = useState("");
  /* Set the moment a save starts - `saving` only lands on the next render, so
     a second click before then would send the same rows again. */
  const savingRef = useRef(false);
  /* The GRC the rows were saved to. On the standalone screen (no grcId) the
     first Submit creates it; every later Submit must update that GRC rather
     than raise another one carrying the same barcode numbers. */
  const [savedGrcId, setSavedGrcId] = useState(null);
  /* Saved rows the operator removed from the grid, as { row, index }. They
     leave the database only when Submit is pressed - sent as explicit ids,
     never inferred from what the save leaves out - and Undo puts them back
     until then. */
  const [pendingDeletes, setPendingDeletes] = useState([]);
  /* asks the ITEMS sheet to put its cursor on a cell: a refused Submit
     points at the first cell to fix */
  const [sheetFocus, setSheetFocus] = useState(null);
  const sheetRowSeq = useRef(0);
  /* the rows as last rendered, for the next serial of a new sheet row */
  const sheetRowsRef = useRef([]);
  sheetRowsRef.current = rows;
  const importInputRef = useRef(null);
  const [barcodeFormat, setBarcodeFormat] = useState({ prefix: "", suffix: "", startNumber: 1, numberLenght: 4 });
  /* sequenceRef was the browser-held running number. It is kept only so the
     Barcode Setting's Start From can still be shown as a preview on the
     settings card; NOTHING is numbered from it any more - the save route
     gives every barcode its value (lib/barcodeValue.js). */
  const sequenceRef = useRef(1);

  useEffect(() => {
    /* a fresh read from the database: any deletion that was pending has
       been saved, or the page was reopened and it no longer applies */
    setPendingDeletes([]);
    if (!Array.isArray(initialRows) || initialRows.length === 0) {
      setRows([]);
      return;
    }

    /* toGridRow (lib/barcodeRowSync.js) is shared with the save route, which
       uses it to tell a row the operator edited from one left untouched. Each
       row keeps its database _id - that is how the save finds it again. */
    setRows(initialRows.map(toGridRow));
  }, [initialRows]);

  /* GST% FOR SAVED ROWS THAT CARRY NONE.

     Some rows were saved with GST% "0" although their HSN has a tax slab in
     HSN Master, so every total showed GST 0.00 and Net equal to Taxable. When
     the GRC loads, each such row is given the rate of its own HSN - this
     company's HSN Master, the band picked by the row's final rate, exactly as
     the Add Item form picks it. NOTHING IS WRITTEN: the rows show the rate,
     the totals follow, and the notice asks the operator to Submit to store
     it. A row that already has a rate, or has been sold / moved, is left
     alone, and an HSN with no rate changes nothing. */
  useEffect(() => {
    /* the company is not known yet - an unscoped HSN search could take
       another company's slab for the same code */
    if (!scope.businessReady) return undefined;
    const loaded = Array.isArray(initialRows) ? initialRows : [];
    const pending = loaded.filter((row) => row._id && !isLockedRow(row)
      && String(row.hsn || "").trim() && !(Number(row.gst) > 0));
    if (!pending.length) return undefined;
    let cancelled = false;
    const rateOf = (row) => Number(row.finalPrice || row.finalNet) || Number(row.purchaseRate || row.purRate) || 0;
    /* each row's HSN is looked up in its OWN company's HSN Master */
    const businessOf = (row) => String(row.businessId || scope.business || "");
    const keyOf = (row) => businessOf(row) + "|" + String(row.hsn || "").trim();
    (async () => {
      const slabsByKey = new Map();
      await Promise.all([...new Map(pending.map((row) => [keyOf(row), row])).values()].map(async (row) => {
        const code = String(row.hsn).trim();
        const business = businessOf(row);
        if (!business) return;
        try {
          const qs = new URLSearchParams({ perPage: "20", search: code, business });
          const response = await fetch("/api/hsn?" + qs);
          if (!response.ok) return;
          const payload = await response.json();
          const match = (payload.rows || []).find((hsn) => String(hsn.code || "").trim() === code);
          if (match) slabsByKey.set(keyOf(row), await resolveSlabRates(match.taxSlabs || []));
        } catch { /* no rate found - the row keeps its own */ }
      }));
      if (cancelled) return;
      const rateFor = (row) => {
        const slabs = slabsByKey.get(keyOf(row));
        return slabs && slabs.length ? Number(gstPercentForAmount(slabs, rateOf(row))) || 0 : 0;
      };
      const ids = new Set(pending.filter((row) => rateFor(row) > 0).map((row) => String(row._id)));
      if (!ids.size) return;
      setRows((current) => current.map((row) => (
        ids.has(String(row._id)) && !(Number(row.gst) > 0) && !isLockedRow(row)
          ? { ...row, gst: String(rateFor(row)) }
          : row
      )));
      setImportMessage(`${GST_FILL_NOTICE} on ${ids.size} saved row${ids.size === 1 ? "" : "s"} and has been filled from HSN Master - check the totals and press Submit to save it.`);
    })();
    return () => { cancelled = true; };
  }, [initialRows, scope.business, scope.businessReady]);

  /* The active Purchase Rate Code Master for this scope. Loaded once here and
     handed down, so the Add Item form never has to fetch it itself and every
     row generated in one session encodes against the same table. An absent or
     inactive record leaves the mapping empty, and encodeRate() then returns
     '' rather than inventing an alphabet. */
  const [rateCodeMapping, setRateCodeMapping] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({
      business: scope.business || "",
      location: scope.location || "",
    });
    fetch("/api/purchase-rate-code?" + params)
      .then((response) => response.json())
      .then((result) => {
        const doc = result.doc;
        setRateCodeMapping(doc && doc.isActive !== false ? doc.digitMappings || {} : {});
      })
      .catch(() => setRateCodeMapping({}));
  }, [scope.business, scope.location]);

  useEffect(() => {
    const params = new URLSearchParams({
      business: scope.business || "",
      finYear: scope.finYear || "",
      page: "1",
      perPage: "50",
    });

    fetch("/api/barcode-setting?" + params)
      .then((response) => response.json())
      .then((result) => {
        const rows = Array.isArray(result.rows) ? result.rows : [];
        const active = rows
          .filter((row) => isDateActive(row))
          .sort((a, b) => new Date(b.effectiveDate || 0) - new Date(a.effectiveDate || 0))[0]
          || rows[0]
          || null;

        if (active) {
          const format = {
            prefix: active.prefix || "",
            suffix: active.suffix || "",
            startNumber: Number(active.startNumber) || 1,
            numberLenght: Number(active.numberLenght) || 4,
          };
          setBarcodeFormat(format);
          sequenceRef.current = format.startNumber;
        }
      })
      .catch(() => {});
  }, [scope.business, scope.finYear]);

  const validRows = useMemo(() => rows.filter((row) => String(row.itemCode || row.itemName || "").trim()), [rows]);
  const additionalFields = useMemo(() => customFieldNames(validRows), [validRows]);

  /* ---- the money on this screen, from lib/grcMoney.js --------------------

     One module for every figure here, the save route, the GRC list and the
     print sheet, worked out in the order the business rule states:

       1. net amount = line taxable + line GST, summed
       2. GST amount = line taxable x the row's OWN GST% / 100, summed
       3. taxable    = net amount - GST amount

     so TAXABLE + GST = NET AMOUNT on the totals bar, in the Item Summary and
     in what the save stores, to the paisa. The GST rate is each row's own -
     filled from the item / HSN master, never fixed here.

     This used to set the taxable value to the line's net amount and then add
     GST on top of it, which put the tax in twice. It is derived from `rows`,
     so a changed rate, quantity, discount, offer or GST% recalculates all
     three together: none of them can be left showing the value before the
     edit. */
  const totals = useMemo(() => {
    const money = grcTotals(validRows);
    return validRows.reduce((acc, row) => {
      const qty = rowQty(row);
      acc.pcs += pcRegex.test(String(row.uom || "")) ? qty : 0;
      acc.mtr += meterRegex.test(String(row.uom || "")) ? qty : 0;
      return acc;
    }, { taxable: money.taxable, gst: money.gst, net: money.netAmount, pcs: 0, mtr: 0 });
  }, [validRows]);

  /* ITEM SUMMARY - one line per BILL LINE of the supplier's bill.

     The Bill Sl No. is part of the key, not a number worked out from the
     position of the line in this table. It used to be neither: the table
     rendered {index + 1} in that column and this object carried no billSlNo
     at all, so the screen the barcode rule cites as the place to check the
     third segment was showing a row counter instead - and one item received
     on two different bill lines was folded into a single line that could not
     name either of them. */
  const summaryRows = useMemo(() => {
    const map = new Map();
    validRows.forEach((row) => {
      const billSlNo = String(row.billSlNo ?? "").trim();
      const key = `${billSlNo}-${row.itemCode || row.itemName || "item"}-${row.hsn || ""}-${row.gst || ""}-${row.uom || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          billSlNo,
          itemName: row.itemName || row.supplierDescription || row.itemCode,
          qty: 0,
          beforeTax: 0,
          gst: 0,
          net: 0,
          customFields: {},
        });
      }
      const entry = map.get(key);
      /* the same three figures as the totals bar, for this bill line */
      entry.qty += rowQty(row);
      entry.beforeTax = r2(entry.beforeTax + rowTaxable(row));
      entry.gst = r2(entry.gst + rowGst(row));
      entry.net = r2(entry.beforeTax + entry.gst);
      Object.entries(row.customFields || {}).forEach(([key, value]) => {
        const current = entry.customFields[key];
        entry.customFields[key] = current && current !== value ? `${current}, ${value}` : value;
      });
    });
    return Array.from(map.values());
  }, [validRows]);

  function appendRows(items) {
    setRows((current) => [...current, ...items]);
  }

  function exportRowsToExcel() {
    const headers = [...Object.values(exportFieldLabels), ...additionalFields];
    const fields = Object.keys(exportFieldLabels);
    const sheetRows = [headers, ...validRows.map((row) => [
      ...fields.map((field) => row[field] ?? ""),
      ...additionalFields.map((field) => row.customFields?.[field] ?? ""),
    ])];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), "Barcode Items");
    /* the same rows again, very hidden, so Import can tell which cells were
       changed - see EXPORT_SNAPSHOT_SHEET */
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), EXPORT_SNAPSHOT_SHEET);
    workbook.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 2 }] };
    XLSX.writeFile(workbook, "barcode-items-template.xlsx");
  }

  async function importRowsFromExcel(event) {
    const file = event.target.files?.[0];
    /* cleared at once, so picking the same file again after editing it still
       fires onChange - a browser does not re-report an unchanged selection */
    event.target.value = "";
    if (!file) return;

    try {
      const { rows: importedRows, snapshot } = await readExcelFile(file);
      if (importedRows.length === 0) throw new Error("No item rows were found in the Excel file.");

      /* ---- match every sheet row to the grid row it edits --------------
         A row with a Barcode No matches the grid row carrying that barcode
         and nothing else; a row without one matches on Item Code + Serial No.
         A match is UPDATED in place and anything else is added, so importing
         the same sheet again edits rows instead of duplicating them. When the
         sheet carries its export snapshot, only the cells that were changed
         are taken from it. Matching comes before validation so each row is
         checked as it will end up. */
      const currentByKey = new Map();
      rows.forEach((row) => {
        [rowMatchKey(row), rowItemKey(row)].filter(Boolean).forEach((key) => currentByKey.set(key, row));
      });

      const problems = [];
      const lineByKey = new Map();
      const planned = [];
      importedRows.forEach((importedRow, index) => {
        const line = index + 2;                   // +1 for the header, +1 for 1-based
        const matchKey = rowMatchKey(importedRow) || `new:${index}`;
        if (lineByKey.has(matchKey)) {
          /* the second copy used to be skipped without a word, so an edit on
             the lower row silently did nothing */
          if (matchKey.startsWith("barcode:")) {
            problems.push(`Row ${line}: Barcode No ${importedRow.barcodeNo} is also on row ${lineByKey.get(matchKey)}`);
          }
          return;
        }
        lineByKey.set(matchKey, line);
        const existing = currentByKey.get(matchKey);
        const original = existing && snapshot ? snapshot.get(String(importedRow.barcodeNo || "").trim()) || null : null;
        const changes = original ? changedCells(importedRow, original) : importedRow;
        planned.push({ importedRow, changes, original, index, line, existing });
      });

      /* ---- validate BEFORE anything is written -------------------------
         An import that is half applied leaves the grid in a state nobody can
         reason about, and if it is then saved it puts wrong stock into the
         system. Every row is checked first and the whole file is rejected
         with the offending row numbers if any of them fail. A price that is
         not a number is refused, never read as 0. */
      const numericKeys = ["purchaseRate", "finalPrice", "retailPrice", "rsp", "offerPrice", "wsp", "wspPrice", "dp", "dpPrice",
        "rspOfferPct", "wspOfferPct", "dpOfferPct", "discount", "gst"];
      planned.forEach(({ changes, original, line, existing }) => {
        const where = `Row ${line}${changes.barcodeNo ? ` (${changes.barcodeNo})` : ""}`;
        const row = { ...(existing || {}), ...changes };
        const name = String(row.itemName || row.itemCode || "").trim();
        if (!name) problems.push(`${where}: item code or name is required`);

        const qty = Number(row.qty ?? row.totalMtr ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) problems.push(`${where}: quantity must be a positive number`);

        const isMtr = meterRegex.test(String(row.uom || ""));
        const unique = String(row.uniqueBarcode || "").trim().toLowerCase() === "yes";
        if (!isMtr && unique && !Number.isInteger(qty)) {
          problems.push(`${where}: a unique piece quantity must be a whole number (got ${qty})`);
        }

        /* Purchase price, checked here - BEFORE the new rows are numbered
           below. The save refuses a price that is not greater than 0 anyway
           (lib/purchasePrice.js), so a file carrying one used to reserve real
           barcode numbers that the save then threw away. */
        const priceProblem = purchasePriceError(
          String(row.purchaseRate ?? "").trim() !== "" ? row.purchaseRate : row.purRate
        );
        if (priceProblem) problems.push(`${where}: ${priceProblem}`);
        /* a new row needs a P-M-F; a saved one may not lose the one it has */
        if (!pmfOf(row) && (!existing || pmfOf(existing))) problems.push(`${where}: ${PMF_REQUIRED_MESSAGE}`);

        numericKeys.forEach((key) => {
          const value = changes[key];
          if (value !== undefined && String(value).trim() !== "" && !Number.isFinite(Number(value))) {
            problems.push(`${where}: invalid ${exportFieldLabels[key] || key} value "${value}"`);
          }
        });
        priceConflicts(changes, existing, Boolean(original)).forEach((message) => problems.push(`${where}: ${message}`));
      });

      if (problems.length) {
        const shown = problems.slice(0, 12).join(" · ");
        throw new Error(
          `The file was not imported - ${problems.length} problem${problems.length === 1 ? "" : "s"} found. ` +
          shown +
          (problems.length > 12 ? ` ...and ${problems.length - 12} more` : "")
        );
      }

      /* ---- NEW rows get no number here: the save route gives each its
         barcode value (SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SEQ) on
         Submit. */
      const updatedById = new Map();
      const addedRows = [];
      const notes = { offerKept: [], offerStarted: [], finalKept: [] };
      planned.forEach(({ changes, original, index, existing }) => {
        if (original && Object.keys(changes).length === 1) return;   // exported and left untouched
        const id = existing?.id || `import-${Date.now()}-${index}`;
        const barcodeNo = existing?.barcodeNo || changes.barcodeNo || "";
        const rowNotes = [];
        const merged = mergeImportedRow(existing, changes, {
          id, barcodeNo, rateCodeMapping, original, onNote: (kind) => rowNotes.push(kind),
        });
        /* a sheet imported again after its changes were applied changes
           nothing more - not counted as an update, not reported twice */
        if (existing && !rowDiffers(merged, existing)) return;
        rowNotes.forEach((kind) => notes[kind].push(barcodeNo || merged.itemCode || `row ${index + 2}`));
        if (existing) updatedById.set(existing.id, { ...merged, _importStatus: 'CHANGED' });
        else addedRows.push({ ...merged, _importStatus: 'NEW' });
      });

      /* an updated row is swapped in by id, so it keeps its place in the grid.
         Existing rows that were not touched have their _importStatus cleared so
         they do not stay highlighted from a previous import. */
      setRows((list) =>
        list.map((row) => updatedById.get(row.id) || { ...row, _importStatus: undefined })
            .concat(addedRows)
      );

      const list = (codes) => codes.slice(0, 8).join(", ") + (codes.length > 8 ? ` and ${codes.length - 8} more` : "");
      const unchanged = planned.length - updatedById.size - addedRows.length;
      setImportMessage(
        `${planned.length} row${planned.length === 1 ? "" : "s"} read: ${updatedById.size} updated, ${addedRows.length} added` +
        (unchanged ? `, ${unchanged} unchanged` : "") +
        `.${updatedById.size || addedRows.length ? " Click Submit to save them." : ""}` +
        (!snapshot && updatedById.size
          ? " This sheet has no export snapshot (it was exported before this update, or made elsewhere), so every filled cell was applied - use Export Excel for a sheet where only the cells you change are applied."
          : "") +
        (notes.offerKept.length
          ? ` ${list(notes.offerKept)}: RSP changed but the running offer was kept, so the label and till still sell at the Offer Price - change Offer Price in the sheet if it should move.`
          : "") +
        (notes.offerStarted.length
          ? ` Check Offer Price on ${list(notes.offerStarted)}: it now differs from the RSP, so the label and till will sell at the Offer Price. If no offer is intended, set it equal to the RSP or leave it empty, and import again.`
          : "") +
        (notes.finalKept.length
          ? ` ${list(notes.finalKept)}: Final Price was not recalculated from the new Purchase Rate because the unit's discount is not known - set Final Price in the sheet if it should change.`
          : "")
      );
    } catch (error) {
      setImportMessage(error.message || "Unable to import the Excel file.");
    }
  }

  async function saveRows(rowsToSave = validRows, printAfterSave = false, { printIds = null } = {}) {
    /* one save at a time - see savingRef */
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    /* Strip the UI-only fields before sending to the API, and leave out the
       empty rows the ITEMS sheet keeps for typing into */
    rowsToSave = rowsToSave.filter((row) => !isBlankRow(row)).map(({ _importStatus, _edited, ...rest }) => rest);
    /* saved rows removed on the grid - deleted by this Submit, by id */
    const deleteIds = pendingDeletes.map((entry) => entry.row._id).filter(Boolean);
    try {
      /* The ITEMS sheet's own rules (lib/itemsSheet.js), over every row that
         is new or was edited, before anything is sent. A refusal names the
         cells and puts the sheet's cursor on the first of them. */
      const problems = sheetProblems(rows, sheetColumns(additionalFields));
      if (problems.length > 0) {
        setShowSaveConfirm(false);
        setActiveTab("items");
        setSheetFocus({ rowId: problems[0].rowId, key: problems[0].key, at: Date.now() });
        setSaveError(
          `Fix ${problems.length} cell${problems.length === 1 ? "" : "s"} in the ITEMS table before submitting: ` +
          problems.slice(0, 3).map((p) => `Row ${p.index + 1} ${p.label}: ${p.message}`).join(" · ") +
          (problems.length > 3 ? ` · and ${problems.length - 3} more` : "")
        );
        return false;
      }
      if (rowsToSave.length === 0 && deleteIds.length === 0) {
        setShowSaveConfirm(false);
        setSaveError("There is nothing to save.");
        return false;
      }

      /* Purchase price, before anything is sent - the same rule the Add Item
         form, the Excel import and the API apply (lib/purchasePrice.js). The
         offending lines are named so they can be found in the grid. */
      const priceErrors = [];
      rowsToSave.forEach((row, index) => {
        const problem = purchasePriceError(
          String(row.purchaseRate ?? '').trim() !== '' ? row.purchaseRate : row.purRate
        );
        if (problem) priceErrors.push({ ref: row.itemCode || row.itemName || `Row ${index + 1}`, problem });
      });

      if (priceErrors.length > 0) {
        const shown = priceErrors.slice(0, 3).map((p) => p.ref).join(', ');
        const more = priceErrors.length > 3 ? ` and ${priceErrors.length - 3} more` : '';
        /* the confirm dialog sits over the banner - as on the API-error path
           below, it has to go or the operator never sees why */
        setShowSaveConfirm(false);
        setSaveError(`${priceErrors[0].problem} Check: ${shown}${more}`);
        return false;
      }

      /* P-M-F on every barcode this Submit CREATES (no _id yet) - rows added
         on the sheet, imported or from the Add Item form. A saved barcode keeps
         the P-M-F it was stored with (the ITEMS sheet's P-M-F column can
         correct it): requiring one there would stop every edit of a GRC saved
         before the rule. */
      const pmfErrors = [];
      rowsToSave.forEach((row, index) => {
        if (!row._id && !pmfOf(row)) pmfErrors.push(row.itemCode || row.itemName || `Row ${index + 1}`);
      });
      if (pmfErrors.length > 0) {
        const shown = pmfErrors.slice(0, 3).join(', ');
        const more = pmfErrors.length > 3 ? ` and ${pmfErrors.length - 3} more` : '';
        setShowSaveConfirm(false);
        setSaveError(`${PMF_REQUIRED_MESSAGE} Check: ${shown}${more}`);
        return false;
      }

      /* Rows added on the sheet need no number from the browser: the save
         route composes each barcode number, and every row carries its own id,
         so a Submit pressed twice is matched by that id (clientRowId) rather
         than inserted again. */
      /* the same arithmetic as the totals bar (lib/grcMoney.js), so what the
         save is told agrees to the paisa with what the operator confirmed */
      const sending = grcTotals(rowsToSave);
      const saveTotals = { count: sending.totalQuantity, value: sending.netAmount };
      const response = await fetch("/api/barcode-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToSave,
          grcId: grcId || savedGrcId || null,
          deleteIds,
          business: scope.business,
          location: scope.location,
          finYear: scope.finYear,
          supplierId: scope.supplierId || null,
          totals: {
            count: saveTotals.count,
            value: saveTotals.value,
          },
        }),
      });
      /* The API answers a failure as { error, code } (lib/apiError.js) - the
         message is written for the operator and says WHICH rule was broken:
         a missing Goods Type, an Old Barcode that matches nothing, a barcode
         that has already moved, a permission the user does not hold. Throwing
         a flat "Save failed" here discarded all of it, so a rejected save was
         indistinguishable from a server being down and left nothing on screen
         to act on. */
      if (!response.ok) {
        /* a refusal is an answer, not a crash: shown in the banner rather
           than thrown into console.error, which Next's dev overlay reports
           as a runtime error */
        const data = await response.json().catch(() => ({}));
        setShowSaveConfirm(false);
        setSaveError(data.error || `Save failed (HTTP ${response.status})`);
        return false;
      }
      setShowSaveConfirm(false);
      const saved = await response.json().catch(() => ({}));
      /* The barcode values are the server's - SEQ is given there - so every
         row takes back what was stored: its _id, value and SEQ. A print
         straight after the save prints exactly those, and never a row the
         save did not store. */
      const storedById = new Map((saved.rows || []).map((s) => [String(s._id), s]));
      const storedByClientId = new Map((saved.createdRows || []).map((s) => [String(s.id), s]));
      /* Both barcode fields as the server stored them, taken together off the
         one record it answered with. barcodeGenerated used to be filled in
         here from barcodeNo, which printed the number twice on any barcode
         whose composed value is a different string - a label taken straight
         after Submit then disagreed with the same label printed from the
         Barcode Print page, which reads the record back from the database. */
      const asStored = (row) => {
        const s = (row._id && storedById.get(String(row._id))) || storedByClientId.get(String(row.id));
        return s
          ? {
            ...row, _id: s._id, barcodeNo: s.barcodeNo, barcodeGenerated: s.barcodeGenerated ?? '', seq: s.seq,
            /* the parts the stored value was made from, so the grid and a
               print straight after Submit agree with the value */
            ...(s.billSlNo !== undefined ? { billSlNo: s.billSlNo } : {}),
            ...(s.serialNo !== undefined ? { serialNo: s.serialNo } : {}),
          }
          : row;
      };
      if (printAfterSave) {
        const wanted = printIds ? new Set(printIds.map(String)) : null;
        setPrintRows(rowsToSave
          .filter((row) => !wanted || wanted.has(String(row.id)))
          .map(asStored)
          .filter((row) => row._id && labelKey(row)));
        setShowPrint(true);
      }
      router.refresh?.();
      /* re-read from the database, so the grid shows what was saved.
         Also clear _importStatus on saved rows so highlights disappear. */
      setRows((list) => list.map((r) => {
        const next = asStored(r);
        return (next._importStatus || next._edited) ? { ...next, _importStatus: undefined, _edited: undefined } : next;
      }));
      setPendingDeletes([]);
      if (onSaved) {
        onSaved();
      } else if (saved.grcId) {
        /* The standalone screen has no page to re-read for it: remember the
           GRC the first Submit created, and take the rows back with their
           database ids, so the next Submit updates what is already saved. */
        setSavedGrcId(saved.grcId);
        fetch(`/api/grc/${saved.grcId}`, { cache: "no-store" })
          .then((result) => result.json())
          .then((result) => { if (Array.isArray(result.rows)) setRows(result.rows.map(toGridRow)); })
          .catch(() => {});
      }
      return true;
    } catch (error) {
      console.error(error);
      /* the confirm dialog sits over the banner, so it has to go or the
         operator never sees why the save was refused */
      setShowSaveConfirm(false);
      setSaveError(error.message || "Save failed");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /* Removing a row - from the ITEMS sheet or the Item With Barcode tab. A row
     that was never saved lives only in this screen and simply goes. A saved
     one leaves the grid now but the database only when Submit is pressed:
     its id is sent as an explicit deletion (a save never infers one from a
     missing row), the server refuses a unit that has already moved, and
     until then Undo puts it back where it was. */
  function removeRow(row) {
    if (isLockedRow(row)) return;
    const index = rows.findIndex((item) => item.id === row.id);
    if (index < 0) return;
    setRows((list) => list.filter((item) => item.id !== row.id));
    if (row._id) setPendingDeletes((list) => [...list, { row, index }]);
  }

  function undoDeletes() {
    const restore = [...pendingDeletes].sort((a, b) => a.index - b.index);
    setRows((list) => {
      const next = list.slice();
      restore.forEach(({ row, index }) => next.splice(Math.min(index, next.length), 0, row));
      return next;
    });
    setPendingDeletes([]);
  }

  /* A new row on the ITEMS sheet. How the unit is counted and discounted, and
     its markups, follow the row above (SHEET_INHERITED_FIELDS) - each is a
     column, so it can be changed; everything else starts empty.

     THE BILL SL NO. IS CARRIED DOWN FROM THE ROW ABOVE, NOT COUNTED UP.
     It is the line of the supplier's bill these goods came in on, and it is
     the third part of every barcode of that line - so several rows of one
     bill line share it, and it changes only when the bill line does. This
     used to be `highest on the grid + 1`, which made the number a running
     row counter: twenty pieces of bill line 1 produced bill lines 1 to 20,
     and the barcode carried the row's position where the bill line belongs.
     A row with nothing above it starts blank, and the save route refuses a
     blank one by name rather than inventing a number for it.

     No barcode number here either: the save route composes it. */
  const createSheetRow = useCallback((template) => {
    const row = emptyRow(`sheet-${Date.now()}-${sheetRowSeq.current++}`);
    if (template) {
      SHEET_INHERITED_FIELDS.forEach((key) => {
        if (template[key] !== undefined && template[key] !== null) row[key] = template[key];
      });
    }
    const carried = String(template?.billSlNo ?? "").trim()
      || String([...sheetRowsRef.current].reverse().find((item) => String(item?.billSlNo ?? "").trim())?.billSlNo ?? "").trim();
    row.billSlNo = carried;
    return row;
  }, []);

  /* THE barcode value of every row, for the ITEMS sheet's Barcode Identifier
     column when that column is shown (the Item With Barcode tab's Barcode No
     shows the saved barcodeNo instead) - in the canonical spelling
     the label encodes and prints (lib/barcodeValue.js):

        SUPPLIER_CODE*GRC_NUMBER*BILL_SL_NO*SERIAL_NO

      - a saved row: its STORED value, never one rebuilt from its fields - or,
        when its Bill Sl No. has been changed on the grid, that value with the
        new Bill Sl No., which is what the save restates it to
      - a row not saved yet: the value the save route will give it - the next
        SERIAL_NO on its Bill Sl No. after every serial the saved values carry
        and after the GRC's floor for that line, in grid order
      - a row saved before values were composed: its own number as printed
      Printing reads only stored values, so the text and the bars cannot
      disagree. */
  const provisionalSerialNo = useMemo(() => {
    const saved = rows.filter((row) => row._id).concat(pendingDeletes.map((entry) => entry.row));
    const nextByBill = new Map();
    const byRow = new Map();
    rows.forEach((row) => {
      if (row._id || !String(row.itemCode || row.itemName || "").trim()) return;
      const billSlNo = billSlNoForBarcode(row.billSlNo);
      if (!billSlNo) return;
      const previous = nextByBill.has(billSlNo)
        ? nextByBill.get(billSlNo)
        : Math.max(highestSerialNo(saved, billSlNo), serialFloorOf(grcHeader, billSlNo, saved));
      /* a typed starting Serial No. moves the line on, never back - as the
         save route applies it */
      const requested = /^\d+$/.test(String(row.serialNo ?? "").trim()) ? Number(row.serialNo) : 0;
      const serial = Math.max(previous + 1, requested);
      nextByBill.set(billSlNo, serial);
      byRow.set(row.id, serial);
    });
    return byRow;
  }, [rows, pendingDeletes, grcHeader]);

  const barcodeValueOf = useCallback((row) => {
    const parts = { supplierCode: grcHeader.supplierCode, referenceCode: grcHeader.grcNumber };
    if (row._id) {
      const stored = composedValueOf(row);
      if (!stored) return unitNumberOf(row);
      const storedParts = parseBarcodeValue(stored);
      const billSlNo = billSlNoForBarcode(row.billSlNo);
      if (!billSlNo || storedParts.billSlNo === billSlNo) return stored;
      return generateBarcodeValue({ ...parts, billSlNo, serialNo: storedParts.serialNo }) || stored;
    }
    const serialNo = provisionalSerialNo.get(row.id);
    return serialNo ? generateBarcodeValue({ ...parts, billSlNo: row.billSlNo, serialNo }) : "";
  }, [provisionalSerialNo, grcHeader.grcNumber, grcHeader.supplierCode]);

  /* The final Submit bar is position:fixed - on a desktop that alone keeps it
     at the window's bottom-right through any scroll. On a phone or tablet this
     page is wider than the screen (fixed-width top bar and sidebar), and the
     browser then pins fixed elements to that wider layout instead of to what
     is on screen, so the bar sat off to the right and far below. This moves it
     back by exactly the gap between where it landed and the visible
     bottom-right - zero on a desktop, where nothing changes. */
  const submitBarRef = useRef(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const bar = submitBarRef.current;
    if (!viewport || !bar) return undefined;
    const place = () => {
      bar.style.transform = "";
      const box = bar.getBoundingClientRect();
      const css = getComputedStyle(bar);
      const dx = viewport.offsetLeft + viewport.width - parseFloat(css.right) - box.right;
      const dy = viewport.offsetTop + viewport.height - parseFloat(css.bottom) - box.bottom;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) bar.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    place();
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    /* the page widening later (rows loaded) can widen that layout too */
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    observer?.observe(document.body);
    return () => {
      viewport.removeEventListener("resize", place);
      viewport.removeEventListener("scroll", place);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 px-2 pb-24 pt-4 md:pt-6">
      <div className="flex items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">GRC Barcode Generation</h1>
        </div>
        <div className="text-sm text-gray-500">Barcode labels are ready after submit</div>
      </div>

      <AddItemModal
        open={showAddItem}
        barcodeFormat={barcodeFormat}
        /* scopes the Old Barcode lookup to the selected company, so a code
           belonging to another business reports that rather than "not found" */
        business={scope.business}
        markupDefaults={supplierMarkup}
        /* the GRC supplier's Price Calculation Setup (GET /api/grc/[id]) */
        priceSetup={supplierPriceSetup}
        rateCodeMapping={rateCodeMapping}
        grcId={grcHeader.grcId || grcId}
        /* The next Bill Sl No. to suggest in the form, derived from the Item
           Summary: the highest billSlNo already present in the saved rows + 1.
           When the GRC has no rows yet, this is 1. This mirrors exactly what
           the Item Summary table shows - it is built from the same rows array
           - so the Serial No. field is always in step with that table. */
        initialBillSlNo={
          validRows.length === 0
            ? 1
            : Math.max(...validRows.map((r) => Number(r.billSlNo) || 0)) + 1
        }
        /* The Serial No.* field initial value — the SL NO from the Item Summary
           for the next new entry. Item Summary SL NO is simply the row counter
           of that table (1, 2, 3...), so the next one is summaryRows.length + 1. */
        initialNextSerialNo={summaryRows.length + 1}
        onClose={() => setShowAddItem(true)}
        onSubmit={(items) => appendRows(items)}
        onSubmitAndPrint={(items) => {
          const nextRows = [...rows, ...items];
          setRows(nextRows);
          /* the whole grid is saved, but only the barcodes this entry made
             go to the picker - Submit & Print used to offer, pre-ticked,
             every label of the GRC again */
          return saveRows(nextRows, true, { printIds: items.map((item) => item.id) });
        }}
      />

      <div className="mt-4 rounded-lg border border-gray-300 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
          <div className="flex gap-6 text-sm font-semibold">
            {[
              { key: "items", label: "ITEMS" },
              { key: "summary", label: "ITEM SUMMARY" },
              { key: "withBarcode", label: "ITEM WITH BARCODE" },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={activeTab === tab.key ? "border-b-2 border-blue-600 pb-1 text-blue-700" : "pb-1 text-gray-600"}>{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,.html" onChange={importRowsFromExcel} className="hidden" />
            <button type="button" onClick={() => importInputRef.current?.click()} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50" title="Import edited Excel template">
              <Icon name="file" size={14} /> Import Excel
            </button>
            <button type="button" onClick={exportRowsToExcel} disabled={validRows.length === 0} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50" title="Export all item fields to Excel">
              <Icon name="file" size={14} /> Export Excel
            </button>
            {/* The picker could only ever be reached by adding another item
                and pressing Submit & Print Label. Re-opening a GRC to reprint
                a damaged sticker - the ordinary reason to come back to this
                screen - meant generating a barcode nobody wanted. */}
            <button type="button" onClick={() => { setPrintRows([]); setShowPrint(true); }} disabled={validRows.filter((row) => row._id && row.barcodeNo).length === 0} className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50" title="Print labels for the barcodes on this GRC">
              <Icon name="printer" size={14} /> Print Labels
            </button>
            <span className="rounded border border-gray-300 bg-gray-50 px-2 py-1">Pc(s) {totals.pcs}</span>
          </div>
        </div>

        {importMessage && (() => {
          /* Colour the banner based on what happened:
             - any error (no rows updated/added) → red
             - changes or new rows present         → amber (action needed)
             - all unchanged                        → green (nothing to do) */
          const changedCount = validRows.filter((r) => r._importStatus === 'CHANGED').length;
          const newCount     = validRows.filter((r) => r._importStatus === 'NEW').length;
          const hasAction    = changedCount > 0 || newCount > 0 || importMessage.startsWith(GST_FILL_NOTICE);
          const isError      = importMessage.startsWith("The file was not imported") || importMessage.startsWith("Unable to");
          const banner = isError
            ? "border-red-200 bg-red-50 text-red-800"
            : hasAction
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-green-200 bg-green-50 text-green-800";
          const dismiss = isError ? "text-red-600" : hasAction ? "text-amber-700" : "text-green-700";
          return (
            <div className={`flex items-start justify-between gap-4 border-b px-4 py-2 text-sm ${banner}`}>
              <div className="flex flex-col gap-1">
                {/* Counts line when we have statuses to show */}
                {!isError && (changedCount > 0 || newCount > 0) && (
                  <div className="flex items-center gap-3 font-semibold">
                    {changedCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                        {changedCount} changed
                      </span>
                    )}
                    {newCount > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
                        {newCount} new
                      </span>
                    )}
                    {validRows.filter((r) => !r._importStatus).length > 0 && (
                      <span className="flex items-center gap-1 font-normal text-gray-500">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
                        {validRows.filter((r) => !r._importStatus).length} unchanged
                      </span>
                    )}
                  </div>
                )}
                <span>{importMessage}</span>
              </div>
              <button type="button" onClick={() => setImportMessage("")} className={`mt-0.5 shrink-0 ${dismiss}`} aria-label="Dismiss import message">×</button>
            </div>
          );
        })()}

        {saveError && (
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">
            <span>{saveError}</span>
            <button type="button" onClick={() => setSaveError("")} className="text-red-700" aria-label="Dismiss save error">×</button>
          </div>
        )}

        <div className="overflow-auto">
          {activeTab === "items" && (
            <ItemsSheet
              rows={rows}
              customFields={additionalFields}
              rateCodeMapping={rateCodeMapping}
              createRow={createSheetRow}
              onChangeRows={setRows}
              onRemoveRow={removeRow}
              pendingDeleteCount={pendingDeletes.length}
              onUndoDeletes={undoDeletes}
              focusRequest={sheetFocus}
            />
          )}

          {activeTab === "summary" && (
            <table className="min-w-[1000px] w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="border border-gray-300 px-2 py-2">Sl No</th>
                  <th className="border border-gray-300 px-2 py-2">Bill Sl No.</th>
                  <th className="border border-gray-300 px-2 py-2">Item Name</th>
                  <th className="border border-gray-300 px-2 py-2">QTY</th>
                  <th className="border border-gray-300 px-2 py-2">Before GST Amount</th>
                  <th className="border border-gray-300 px-2 py-2">GST Amount</th>
                  <th className="border border-gray-300 px-2 py-2">Net Amount</th>
                  {additionalFields.map((field) => <th key={field} className="border border-gray-300 px-2 py-2">{field}</th>)}
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr><td colSpan={7 + additionalFields.length} className="px-3 py-8 text-center text-gray-500">No data found</td></tr>
                ) : summaryRows.map((row, index) => (
                  <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                    {/* Sl No is this table's own counter; Bill Sl No is the
                        bill line the goods came in on, and the third part of
                        every barcode of that line. They are different numbers
                        and are no longer both the row's position. */}
                    <td className="border border-gray-300 px-2 py-2">{index + 1}</td>
                    <td className="border border-gray-300 px-2 py-2">{row.billSlNo || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2">{row.itemName}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.qty)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.beforeTax)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.gst)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.net)}</td>
                    {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2">{row.customFields?.[field] || "-"}</td>)}
                  </tr>
                ))}
                {summaryRows.length > 0 && (
                  <tr className="bg-gray-100 font-semibold">
                    <td className="border border-gray-300 px-2 py-2" colSpan={3}>Total</td>
                    <td className="border border-gray-300 px-2 py-2">{money(totals.pcs + totals.mtr)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(totals.taxable)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(totals.gst)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(totals.net)}</td>
                    {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2" />)}
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "withBarcode" && (
            <table className="min-w-[1400px] w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="border border-gray-300 px-2 py-2">Sl No</th>
                  <th className="border border-gray-300 px-2 py-2">Item</th>
                  <th className="border border-gray-300 px-2 py-2">QTY/MTR</th>
                  <th className="border border-gray-300 px-2 py-2">No. of Cuts</th>
                  <th className="border border-gray-300 px-2 py-2">Purchase Rate</th>
                  <th className="border border-gray-300 px-2 py-2">Discount</th>
                  <th className="border border-gray-300 px-2 py-2">Final Rate</th>
                  <th className="border border-gray-300 px-2 py-2">Before Tax</th>
                  <th className="border border-gray-300 px-2 py-2">GST Amount</th>
                  <th className="border border-gray-300 px-2 py-2">Net Amount</th>
                  <th className="border border-gray-300 px-2 py-2">RSP</th>
                  <th className="border border-gray-300 px-2 py-2">WSP</th>
                  <th className="border border-gray-300 px-2 py-2">E-COMM</th>
                  <th className="border border-gray-300 px-2 py-2">Variant</th>
                  <th className="border border-gray-300 px-2 py-2">Barcode No</th>
                  {additionalFields.map((field) => <th key={field} className="border border-gray-300 px-2 py-2">{field}</th>)}
                  <th className="border border-gray-300 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {validRows.length === 0 ? (
                  <tr><td colSpan={16 + additionalFields.length} className="px-3 py-8 text-center text-gray-500">No data found</td></tr>
                ) : validRows.map((row, index) => (
                  <tr key={row.id || index} className={
                    row._importStatus === 'CHANGED' ? "bg-red-50 border-l-4 border-l-red-500" :
                    row._importStatus === 'NEW'     ? "bg-green-50 border-l-4 border-l-green-500" :
                    "odd:bg-white even:bg-gray-50"
                  }>
                    <td className="border border-gray-300 px-2 py-2">{index + 1}</td>
                    <td className="border border-gray-300 px-2 py-2">
                      {row.itemCode || "-"}
                      {row._importStatus === 'CHANGED' && <span className="ml-1 rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white">CHANGED</span>}
                      {row._importStatus === 'NEW'     && <span className="ml-1 rounded bg-green-600 px-1 py-0.5 text-[10px] font-semibold text-white">NEW</span>}
                    </td>
                    <td className="border border-gray-300 px-2 py-2">{row.qty || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2">{row.noOfCuts || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.purchaseRate || 0)}</td>
                    <td className="border border-gray-300 px-2 py-2">{row.discount || 0}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.finalPrice || 0)}</td>
                    {/* taxable, GST and net through lib/grcMoney.js - the same
                        three figures the totals bar and the save add up, so a
                        line and the total below it can never disagree */}
                    <td className="border border-gray-300 px-2 py-2">{money(rowTaxable(row))}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(rowGst(row))}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(rowNet(row))}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.rsp || row.retailPrice || 0)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.wsp || 0)}</td>
                    <td className="border border-gray-300 px-2 py-2">{money(row.dp || 0)}</td>
                    <td className="border border-gray-300 px-2 py-2">{row.uniqueBarcode || "No"}</td>
                    {/* Barcode No is the saved record's own barcodeNo, as stored
                        ("9A1163") - never barcodeGenerated ("G1319 * 05183 *
                        1 * 1"), and never a value worked out here. A row not
                        saved yet has none until Submit gives it one. */}
                    <td className="border border-gray-300 px-2 py-2"><input value={(row._id && row.barcodeNo) || ""} disabled className="w-52 rounded border border-gray-200 bg-gray-100 px-2 py-1 font-mono text-gray-500" aria-label="System generated barcode" /></td>
                    {additionalFields.map((field) => <td key={field} className="border border-gray-300 px-2 py-2">{row.customFields?.[field] || "-"}</td>)}
                    {/* Not Tab stops: this table has no inputs, so Tab out of
                        the Add Item form ran through the toolbar straight onto
                        row 1's Delete - which removes an unsaved row with no
                        confirm. Deleting stays a deliberate click. */}
                    <td className="border border-gray-300 px-2 py-2"><div className="flex gap-2"><button type="button" tabIndex={-1} className="text-blue-600 hover:underline">Edit</button><button type="button" tabIndex={-1} onClick={() => { if (!row._id || window.confirm(`Remove barcode ${row.barcodeNo || ""}? It will be deleted from this GRC when you click Submit.`)) removeRow(row); }} disabled={isLockedRow(row)} title={lockReason(row) || undefined} className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm">
        <div className="flex items-center gap-2"><span className="text-gray-500">Total Taxable</span><span className="font-mono font-semibold text-gray-800">₹ {money(totals.taxable)}</span></div>
        <div className="flex items-center gap-2"><span className="text-gray-500">Total GST</span><span className="font-mono font-semibold text-gray-800">₹ {money(totals.gst)}</span></div>
        <div className="flex items-center gap-2"><span className="text-gray-500">Grand Total</span><span className="font-mono font-bold text-indigo-700">₹ {money(totals.net)}</span></div>
      </div>

      {/* The picker deliberately receives the rows and nothing else. What a
          label may carry is decided by toLabelData (lib/barcodeLabelPrint.js),
          which whitelists it: the supplier's name and code, the GRC number and
          the bill serial never reach a label. They used to be handed down here
          for a "provenance line" on the sticker; that line is gone. */}
      {/* Only saved barcodes, as saved, are printable: a label carries the
          stored value (SUPPLIER_CODE * GRC_NUMBER * BILL_SL_NO * SEQ) and nothing
          else. A row not saved yet, or with an edit not saved yet, prints
          after Submit - see saveRows. */}
      <PrintLabelPicker rows={printRows.length ? printRows : validRows.filter((row) => row._id && !row._edited)} open={showPrint} onClose={() => { setShowPrint(false); setPrintRows([]); }} />

      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[520px] rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">Confirm submit</h3>
            <p className="mt-2 text-sm text-gray-600">Do you want to save all generated barcode rows?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowSaveConfirm(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={() => saveRows(validRows, false)} disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Submit"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pinned to the viewport's bottom-right, which is the content area's
          bottom-right too - the sidebar is on the left. z-40 keeps it above
          the Items table's sticky/relative layers (without it they painted
          over the bar mid-scroll) and below the z-50 dialogs; the root's pb-24
          lets the last rows and totals scroll clear of it. Portal ensures the
          button is rendered at document body level, preventing it from moving
          with any parent scroll containers. */}
      {typeof document !== 'undefined' && createPortal(
        <div ref={submitBarRef} className="no-print fixed bottom-4 right-4 z-40 flex items-center gap-2">
          {validRows.some((r) => r._importStatus === 'CHANGED') && (
            <button
              type="button"
              onClick={() => {
                const changedRows = validRows.filter((r) => r._importStatus === 'CHANGED');
                if (window.confirm(`Generate barcodes for ${changedRows.length} changed row${changedRows.length === 1 ? '' : 's'} only?`)) {
                  saveRows(changedRows, false);
                }
              }}
              disabled={saving}
              className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-red-700 disabled:opacity-60"
              title="Save only the rows that were changed during the last import"
            >
              {saving ? "Saving..." : `Generate For Changes (${validRows.filter((r) => r._importStatus === 'CHANGED').length})`}
            </button>
          )}
          <button type="button" onClick={() => setShowSaveConfirm(true)} disabled={saving} className="rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60">Submit</button>
        </div>,
        document.body
      )}
    </div>
  );
}

export { modeFromUom, usesMeterCuts, buildMeterCutPlan };