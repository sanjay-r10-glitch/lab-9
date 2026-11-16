# Lab 9 (SR) — Crew Board (XML to departures-board table)

Aim: Design a web page that reads employee data from an XML file and displays it in tabular format.
The interface looks like an airport departures board — B612 / B612 Mono (the typeface designed for Airbus cockpits), near-black panels, amber split-flap tiles that scramble then settle, status lights, and a live IST clock.

## Data

The roster dataset models the fictional airline **Deccan Skyways** (`airline="Deccan Skyways"`, `code="DK"`, `date="2026-11-16"`, `hub="BLR"`) and contains 26 crew members. Deccan Skyways and all crew members are fictional.

The first `<member>` block that contains a `<duty>` element, copied directly from `data/crew-roster.xml`:

```xml
  <member id="DK0104" rank="Captain" base="BLR" status="On Duty">
    <name>Vikram Rao</name>
    <ratings>
      <type>A320</type>
      <type>A321</type>
    </ratings>
    <hours>14250</hours>
    <joined>2007-03-15</joined>
    <duty flight="DK 114" from="BLR" to="DEL" report="05:15"/>
  </member>
```

**Schema structure:**
- `id`, `rank`, `base`, and `status` are attributes on `<member>`.
- `<ratings>` contains a repeated list of `<type>` elements.
- `<duty flight from to report/>` is an optional empty element present only for On Duty crew.

## How the XML is Loaded

`js/board.js` loads and processes the XML using the following steps:

1. **Request**: Issues an `XMLHttpRequest` with `responseType = "document"` and `overrideMimeType("text/xml")`, so the browser parses the XML directly and `xhr.response` is already an XML `Document`.
2. **Event handling**: Attaches `load` and `error` event listeners to process the response or handle transport failures.
3. **Parser validation**: Checks for non-200 HTTP status and evaluates `doc.querySelector("parsererror")` to catch malformed XML syntax errors.
4. **Selector parsing**: Queries the XML document using standard CSS selectors — `querySelectorAll("roster > member")` for crew nodes, `querySelectorAll("ratings > type")` for rating tags, and `querySelector("duty")` (which is `null` when off-duty) — reading metadata with `getAttribute()` and element content with `textContent`.

**Request snippet (`js/board.js`):**
```javascript
var xhr = new XMLHttpRequest();
xhr.open("GET", url);
xhr.responseType = "document";       // browser parses the XML for us
xhr.overrideMimeType("text/xml");    // …even if the server sends a vague type

xhr.addEventListener("load", function () {
  var doc = xhr.response;
  if (xhr.status !== 200 && xhr.status !== 0) return fail("HTTP " + xhr.status + " while fetching " + url);
  if (!doc || doc.querySelector("parsererror")) return fail("crew-roster.xml is not well-formed XML");
  ready(parse(doc));
});
```

**Parse snippet (`js/board.js`, abridged — the full version also reads `joined`, `from`, `to` and the status order):**
```javascript
var list = Array.prototype.map.call(doc.querySelectorAll("roster > member"), function (m) {
  var duty = m.querySelector("duty");                       // optional
  var types = Array.prototype.map.call(m.querySelectorAll("ratings > type"), function (t) {
    return t.textContent.trim();
  });
  return {
    id: m.getAttribute("id"),
    rank: m.getAttribute("rank"),
    rankOrder: RANKS.indexOf(m.getAttribute("rank")),
    base: m.getAttribute("base"),
    status: m.getAttribute("status"),
    name: m.querySelector("name").textContent.trim(),
    types: types,
    hours: Number(m.querySelector("hours").textContent) || 0,
    flight: duty ? duty.getAttribute("flight") : "",
    report: duty ? duty.getAttribute("report") : ""
  };
});
```

## Features

- **Base filter tabs**: Filter tabs with crew counts per base, ordering the hub (`BLR`) first.
- **Unified search**: Instant search filtering across id, name, rank, base, status, flight, destination (`to`), and type rating.
- **Operational column sorting**: Sortable table columns where rank and status sort by operational order (seniority and duty priority) rather than alphabetical order.
- **Summary ticker**: Displays total crew, on duty, standby, distinct flights crewed, and fleet hours.
- **Rank stripes**: Visual epaulette stripes matching aviation rank (4 Captain, 3 First Officer, 2 Purser, 1 Cabin Crew).
- **Split-flap animation**: Character cycling split-flap effect on cells, automatically skipped when `prefers-reduced-motion` is enabled.
- **Responsive card layout**: Switches from tabular format to stacked boarding-pass cards on viewport widths below 700px.
- **Friendly error message**: Clean error feedback displayed in departures-board format if the roster cannot be loaded.

## Files

```
.
├── .nojekyll           # Disables Jekyll processing on GitHub Pages
├── README.md           # Lab documentation and schema overview
├── css/
│   └── board.css       # Airport board theme, split-flap animations, responsive rules
├── data/
│   └── crew-roster.xml # XML crew roster containing members, ratings, and duties
├── index.html          # Semantic HTML markup, board table, and summary ticker
└── js/
    └── board.js        # XML fetching, CSS selector querying, sorting, and UI logic
```

## Running It

Because modern browsers (Chrome and Edge) block `XMLHttpRequest` on `file://` URLs due to CORS and local security policies, run a local HTTP server inside this folder:

```bash
python -m http.server 8169
```

Then open `http://localhost:8169/` in your browser. The project also works on GitHub Pages as-is (`.nojekyll` included).
