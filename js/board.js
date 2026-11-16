/* Lab 9 (SR) — Crew Board
 * Loads data/crew-roster.xml with XMLHttpRequest using responseType "document",
 * then reads it with CSS selectors (querySelector / querySelectorAll) —
 * attributes on <member>, a repeated <type> list, and an optional <duty> element. */

(function () {
  "use strict";

  var RANKS = ["Captain", "First Officer", "Purser", "Cabin Crew"];
  var STATUSES = ["On Duty", "Standby", "Rest", "Leave"];
  var STRIPES = { "Captain": 4, "First Officer": 3, "Purser": 2, "Cabin Crew": 1 };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $("rows"), footEl = $("foot"), input = $("q"), basesEl = $("bases");
  var sortButtons = document.querySelectorAll("th button[data-sort]");

  var crew = [];
  var state = { base: "ALL", query: "", key: "statusOrder", dir: 1 };

  /* ---------- clock ---------- */
  function tick() {
    var now = new Date();
    var opts = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
    $("clock").innerHTML = now.toLocaleTimeString("en-GB", opts).replace(":", '<span class="p">:</span>');
    $("date").textContent = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short" }).toUpperCase() + " · IST";
  }
  tick(); setInterval(tick, 10000);

  /* ---------- 1. request the XML as a Document ---------- */
  function loadRoster(url) {
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
    xhr.addEventListener("error", function () {
      fail("Request blocked. Serve this folder over http (python -m http.server) instead of opening it from disk.");
    });
    try { xhr.send(); } catch (e) { fail("Request blocked: " + e.message); }
  }

  /* ---------- 2. read it with selectors ---------- */
  function parse(doc) {
    var root = doc.querySelector("roster");
    var list = Array.prototype.map.call(doc.querySelectorAll("roster > member"), function (m) {
      var duty = m.querySelector("duty");                       // optional
      var types = Array.prototype.map.call(m.querySelectorAll("ratings > type"), function (t) {
        return t.textContent.trim();
      });
      var rank = m.getAttribute("rank");
      var status = m.getAttribute("status");
      return {
        id: m.getAttribute("id"),
        rank: rank,
        rankOrder: RANKS.indexOf(rank),
        base: m.getAttribute("base"),
        status: status,
        statusOrder: STATUSES.indexOf(status),
        name: m.querySelector("name").textContent.trim(),
        types: types,
        hours: Number(m.querySelector("hours").textContent) || 0,
        joined: m.querySelector("joined").textContent.trim(),
        flight: duty ? duty.getAttribute("flight") : "",
        from: duty ? duty.getAttribute("from") : "",
        to: duty ? duty.getAttribute("to") : "",
        report: duty ? duty.getAttribute("report") : ""
      };
    });
    return {
      airline: root.getAttribute("airline"),
      code: root.getAttribute("code"),
      date: root.getAttribute("date"),
      hub: root.getAttribute("hub"),
      crew: list
    };
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slug(s) { return s.toLowerCase().replace(/\s+/g, "-"); }
  /* monospace commas/colons take a full cell — pull them in so 1,39,250 reads as one number */
  function tight(s) { return esc(s).replace(/([,:])/g, '<span class="p">$1</span>'); }
  function indian(n) { return tight(n.toLocaleString("en-IN")); }

  /* split-flap: text cells scramble briefly, then settle */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  function flap(root) {
    if (reduceMotion) return;
    var cells = root.querySelectorAll("[data-flap]");
    cells.forEach(function (el, i) {
      var final = el.textContent;
      var frames = 6 + (i % 5);
      var n = 0;
      var timer = setInterval(function () {
        n++;
        if (n >= frames) { el.textContent = final; clearInterval(timer); return; }
        var settled = Math.floor(final.length * n / frames);
        var out = final.slice(0, settled);
        for (var k = settled; k < final.length; k++) {
          out += final[k] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
      }, 45);
    });
  }

  /* ---------- 3. render ---------- */
  function render(animate) {
    var q = state.query.toLowerCase();
    var list = crew.filter(function (c) {
      if (state.base !== "ALL" && c.base !== state.base) return false;
      if (!q) return true;
      return [c.id, c.name, c.rank, c.base, c.status, c.flight, c.to, c.types.join(" ")].join(" ").toLowerCase().indexOf(q) !== -1;
    });

    list.sort(function (a, b) {
      var x = a[state.key], y = b[state.key];
      var r = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      if (r === 0) r = a.id.localeCompare(b.id);
      return r * state.dir;
    });

    if (!list.length) {
      rowsEl.innerHTML = '<tr class="msg"><td colspan="9">NO CREW MATCH “' + esc(state.query.toUpperCase()) + '”</td></tr>';
    } else {
      rowsEl.innerHTML = list.map(function (c) {
        var bars = "";
        for (var i = 0; i < 4; i++) bars += '<i class="' + (i < STRIPES[c.rank] ? "on" : "") + '"></i>';
        return '<tr class="st-' + slug(c.status) + '">' +
          '<td data-label="Crew ID" class="id"><span data-flap>' + esc(c.id) + "</span></td>" +
          '<td data-label="Name" class="name"><span data-flap>' + esc(c.name.toUpperCase()) + "</span></td>" +
          '<td data-label="Rank"><span class="rank"><span class="stripes" aria-hidden="true">' + bars + "</span>" + esc(c.rank) + "</span></td>" +
          '<td data-label="Base" class="base"><span data-flap>' + esc(c.base) + "</span></td>" +
          '<td data-label="Type ratings"><span class="types">' + c.types.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</span></td>" +
          '<td data-label="Hours" class="num"><span>' + indian(c.hours) + "</span></td>" +
          '<td data-label="Flight" class="flight">' + (c.flight
            ? '<span data-flap>' + esc(c.flight) + '</span><small>' + esc(c.from) + " → " + esc(c.to) + "</small>"
            : '<span class="none">—</span>') + "</td>" +
          '<td data-label="Report" class="report">' + (c.report ? '<span data-flap>' + esc(c.report) + "</span>" : '<span class="none">—</span>') + "</td>" +
          '<td data-label="Status"><span class="status">' + esc(c.status.toUpperCase()) + "</span></td>" +
        "</tr>";
      }).join("");
      if (animate) flap(rowsEl);
    }

    footEl.textContent = "SHOWING " + list.length + " / " + crew.length + " CREW" +
      (state.base !== "ALL" ? " · BASE " + state.base : "") +
      (state.query ? " · FILTER “" + state.query.toUpperCase() + "”" : "");

    sortButtons.forEach(function (b) {
      var th = b.parentNode;
      if (b.dataset.sort === state.key) th.setAttribute("aria-sort", state.dir === 1 ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
  }

  /* ---------- 4. wire up ---------- */
  function ready(data) {
    crew = data.crew;

    $("airline").textContent = data.airline;
    $("code").textContent = data.code;

    var onDuty = crew.filter(function (c) { return c.status === "On Duty"; });
    var flights = {};
    onDuty.forEach(function (c) { flights[c.flight] = 1; });
    $("k-crew").textContent = crew.length;
    $("k-duty").textContent = onDuty.length;
    $("k-stby").textContent = crew.filter(function (c) { return c.status === "Standby"; }).length;
    $("k-flights").textContent = Object.keys(flights).length;
    $("k-hours").innerHTML = indian(crew.reduce(function (s, c) { return s + c.hours; }, 0));

    var counts = {};
    crew.forEach(function (c) { counts[c.base] = (counts[c.base] || 0) + 1; });
    var bases = Object.keys(counts).sort(function (a, b) {
      return a === data.hub ? -1 : b === data.hub ? 1 : a.localeCompare(b);
    });
    basesEl.innerHTML = ["ALL"].concat(bases).map(function (b) {
      return '<button type="button" aria-pressed="' + (b === "ALL") + '" data-base="' + b + '">' + b +
        "<sup>" + (b === "ALL" ? crew.length : counts[b]) + "</sup></button>";
    }).join("");
    basesEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      state.base = btn.dataset.base;
      basesEl.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === btn); });
      render(true);
    });

    input.disabled = false;
    input.addEventListener("input", function () { state.query = input.value.trim(); render(false); });
    sortButtons.forEach(function (b) {
      b.addEventListener("click", function () {
        if (state.key === b.dataset.sort) state.dir = -state.dir;
        else { state.key = b.dataset.sort; state.dir = 1; }
        render(false);
      });
    });

    render(true);
  }

  function fail(msg) {
    $("airline").textContent = "Roster unavailable";
    rowsEl.innerHTML = '<tr class="msg msg--err"><td colspan="9">' + esc(msg.toUpperCase()) + "</td></tr>";
  }

  loadRoster("data/crew-roster.xml");
})();
