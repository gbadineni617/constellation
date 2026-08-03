export const C = {
  bg: "#0E0B1A", panel: "#171327", panel2: "#1D1830", line: "#2A2440",
  violet: "#8B6DFF", violetSoft: "#7C5CFC", brand: "#6A4DFF", sidebar: "#0A0713",
  teal: "#2DD4BF", amber: "#F5B544",
  pink: "#F471B5", text: "#EDEBF5", muted: "#9B93B5", faint: "#5B5473",
};

export const STATUS = {
  done:   { color: C.teal,  label: "Done" },
  active: { color: C.amber, label: "In progress" },
  open:   { color: C.faint, label: "Open" },
  na:     { color: C.faint, label: "N/A" },
};

export const PEOPLE = {
  kat:    { name: "Kat (Dir.)",        initials: "KW", color: C.violet },
  phil:   { name: "Phillip",           initials: "PV", color: C.pink },
  paul:   { name: "Paul (FDE)",        initials: "PS", color: C.teal },
  james:  { name: "James (AM)",        initials: "JW", color: C.amber },
  ryan:   { name: "Ryan (CA rev.)",    initials: "RM", color: C.pink },
  sc:     { name: "Smartcat",          initials: "SC", color: C.brand },
  nicki:  { name: "Nicki (Champion)",  initials: "NR", color: C.violet },
  sam:    { name: "Samantha (Owner)",  initials: "SF", color: C.pink },
  kelli:  { name: "Kelli (Champion)",  initials: "KH", color: C.amber },
  jackie: { name: "Jackie (CS)",       initials: "JS", color: C.teal },
};

/* ────────────────────────────────────────────────────────────
   The two axes the path re-assembles from
   ──────────────────────────────────────────────────────────── */

export const RISK = {
  complete: { label: "Complete",  color: C.teal,  tone: "This one's done." },
  on_track: { label: "On track",  color: C.teal,  tone: "Pace is fine — no nudge needed." },
  at_risk:  { label: "At risk",   color: C.amber, tone: "Behind where it should be with the date closing in." },
  overdue:  { label: "Past date", color: C.pink,  tone: "The go-live date has passed and the path isn't finished." },
};

/* ────────────────────────────────────────────────────────────
   Small shared pieces
   ──────────────────────────────────────────────────────────── */

// Ids and labels only. Icons are attached in Sidebar.jsx so this module stays
// free of React — lib/journey.js imports from here and must remain testable
// with plain node, no bundler and no UI dependencies.
export const NAV = [
  { id: "projects",     label: "Projects" },
  { id: "translations", label: "Translations" },
  { id: "marketplace",  label: "Marketplace" },
  { id: "team",         label: "Team" },
  { id: "reporting",    label: "Reporting" },
];

export const STARS = [
  [4, 18], [12, 62], [19, 30], [27, 74], [34, 12], [41, 52], [48, 84], [55, 22],
  [62, 66], [69, 38], [76, 78], [83, 16], [90, 58], [96, 44], [8, 88], [58, 8],
];

export const SKY = [-30, 8, -16, 24, -22, 12, -4, -26, 16];

export const NODE_GAP = 112;

export const NEXT = { open: "active", active: "done", done: "open", na: "open" };

/** Generated journeys carry their own people; template journeys use the map above. */
export const peopleOf = (rec) => ({ ...PEOPLE, ...((rec && rec.people) || {}) });
