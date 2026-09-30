/* Inline stroke icons - no icon library, matching the outline style of the app. */
const P = {
  gauge: 'M12 14a2 2 0 100-4 2 2 0 000 4zm0-9a9 9 0 109 9M12 5v0M13.5 12.5l4-4',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a7.6 7.6 0 00.1-1.2 7.6 7.6 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.7 7.7 0 00-2-1.2l-.4-2.5H10.9l-.4 2.5a7.7 7.7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 002 1.2l.4 2.5h2.2l.4-2.5a7.7 7.7 0 002-1.2l2.4 1 2-3.4-2-1.6z',
  grid: 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
  users: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM17 5h4M17 8h4M17 11h4',
  truck: 'M3 6h11v9H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  bag: 'M4 8h16l-1 12H5L4 8zM9 8V6a3 3 0 016 0v2',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9',
  staff: 'M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20v-1a4 4 0 014-4h4a4 4 0 014 4v1M15 15h3a4 4 0 014 4v1',
  shuffle: 'M4 5h4l8 14h4M20 5h-4L4 19',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  tools: 'M6 4l6 6M4 6l6 6M14 14l6 6M20 14l-6 6',
  register: 'M4 9h16v11H4zM7 9V5h10v4M9 14h6',
  voucher: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  ledger: 'M5 4h14v16H5zM5 8h14M9 4v16',
  cart: 'M3 5h2l2 11h11l2-8H6M9 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z',
  accounts: 'M12 11a3 3 0 100-6 3 3 0 000 6zM5 20v-1a5 5 0 015-5h4a5 5 0 015 5v1M17 8h5',
  logout: 'M14 4H6v16h8M10 12h11M18 9l3 3-3 3',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  bell: 'M18 15V10a6 6 0 10-12 0v5l-2 3h16l-2-3zM10 21h4',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  burger: 'M4 7h16M4 12h16M4 17h16',
  refresh: 'M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M18 4v4h-4M6 20v-4h4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  /* upload: a tray with an arrow rising out of it - the Action column's
     Upload button. Deliberately NOT a camera or a barcode: it stands for
     "attach a document or a photo to this record". */
  upload: 'M12 16V4M8 8l4-4 4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3',
  /* the two choices inside that dialog */
  image: 'M4 5h16v14H4zM8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 16l4.5-4.5L13 16l3-3 4 4',
  /* share: three nodes joined by two links - the Action column's Share
     button, which offers WhatsApp / Email / Download / Print */
  share: 'M18 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8.2 10.8l7.6-3.9M8.2 13.2l7.6 3.9',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  /* speech bubble with a handset - the WhatsApp route */
  whatsapp: 'M3.5 20.5l1.3-4A8.5 8.5 0 1112 20.5a8.5 8.5 0 01-4-1zM9 8.5c0 3 3.5 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z',
  /* camera outline - the Instagram route on the share dialog */
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 16a4 4 0 100-8 4 4 0 000 8zM17.5 6.5h.01',
  cols: 'M4 5h16v14H4zM10 5v14M16 5v14',
  /* keypad: body, display strip, then two rows of keys */
  calculator: 'M5 3h14v18H5zM8 6h8v3H8zM8 13h1M12 13h1M16 13h1M8 17h1M12 17h1M16 17h1',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 14h8',
  eye: 'M12 5c5 0 8 7 8 7s-3 7-8 7-8-7-8-7 3-7 8-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  pencil: 'M4 20h4L20 8l-4-4L4 16z',
  /* Action menu on the GRC list */
  barcode: 'M3 5v14M6 5v14M9 5v10M12 5v14M15 5v10M18 5v14M21 5v14',
  back: 'M19 12H5M12 19l-7-7 7-7',
  printer: 'M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 15h10v6H7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  chevL: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l4 4L19 6',
  /* stock going back the way it came - returns, on the transfer screens */
  undo: 'M4 9h11a5 5 0 010 10h-6M4 9l4-4M4 9l4 4',
  /* a tick INSIDE a ring - "settled", against a figure. The bare `check`
     above is an action ("approve this"); this one is a state, and the ring is
     what makes it read as a stamp on the amount rather than a button next to
     it. Two subpaths in one string: the circle, drawn as two arcs, then the
     tick. The renderer below emits a single <path>, which takes both. */
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.25 12.25l2.5 2.5 5-5.5',
};

export default function Icon({ name, size = 18, className = '', stroke = 1.7 }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
