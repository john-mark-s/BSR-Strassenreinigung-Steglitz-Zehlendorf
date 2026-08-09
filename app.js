// Straßenreinigung Steglitz-Zehlendorf
// Loads street + district-boundary data from separate GeoJSON files (data/)
// and renders an interactive Leaflet map.

const CLASS_INFO = {
  "A1a": { label: "A1a — 10×/Woche",       color: "#b91c1c", weight: 3, group: "A" },
  "A1b": { label: "A1b — 7×/Woche",        color: "#e0522a", weight: 3,   group: "A" },
  "A2a": { label: "A2a — 6×/Woche",        color: "#f0932b", weight: 3, group: "A" },
  "A2b": { label: "A2b — 5×/Woche",        color: "#eec643", weight: 3,   group: "A" },
  "A3":  { label: "A3 — 3×/Woche",         color: "#9cb84e", weight: 3, group: "A" },
  "A4":  { label: "A4 — 1×/Woche",         color: "#3f9142", weight: 3, group: "A" },
  "B":   { label: "B — i.d.R. 1×/Woche",   color: "#2f8fa3", weight: 3, group: "BCP" },
  "C":   { label: "C — i.d.R. 1×/Woche",   color: "#6a63c9", weight: 3, group: "BCP" },
  "P":   { label: "P — Sonderfläche/Platz",color: "#8a8478", weight: 3, group: "BCP" }
};
const DEFAULT_STYLE = { color: "#999", weight: 3, opacity: 0.9 };

// Default view on load: Sundgauer Straße (Zehlendorf), rather than the
// whole district. Change this to re-center the initial view elsewhere.
const DEFAULT_VIEW = { center: [52.4378, 13.2729], zoom: 16 };

// Berlin's own citywide extent (from the BSR dataset itself) — used to cap
// how far out the map can be zoomed/panned, without cutting off basemap tiles.
const BERLIN_MAX_BOUNDS = L.latLngBounds([52.320, 13.045], [52.685, 13.786]);

function styleFor(feature) {
  const info = CLASS_INFO[feature.properties.klasse];
  return info ? { color: info.color, weight: info.weight, opacity: 0.9 } : DEFAULT_STYLE;
}

function popupFor(feature) {
  const p = feature.properties;
  const info = CLASS_INFO[p.klasse] || { label: p.klasse, color: "#999" };
  const von = p.von || "";
  const bis = p.bis || "";
  const spanTxt = (von || bis) ? `${von}${von && bis ? " → " : ""}${bis}` : "";
  return `<b>${p.strasse || "Unbenannt"}</b>${spanTxt ? spanTxt + "<br>" : ""}
    <span class="pill" style="background:${info.color}">${info.label}</span>`;
}

function buildLegend(map, streetLayer) {
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    let html = "<h4>Reinigungsklasse</h4>";
    const aKeys = Object.keys(CLASS_INFO).filter(k => CLASS_INFO[k].group === "A");
    const oKeys = Object.keys(CLASS_INFO).filter(k => CLASS_INFO[k].group === "BCP");
    aKeys.forEach(k => {
      const c = CLASS_INFO[k];
      html += `<div class="row" data-k="${k}"><span class="swatch" style="background:${c.color}"></span>${c.label}</div>`;
    });
    html += '<div class="grp"></div>';
    oKeys.forEach(k => {
      const c = CLASS_INFO[k];
      html += `<div class="row" data-k="${k}"><span class="swatch" style="background:${c.color}"></span>${c.label}</div>`;
    });
    div.innerHTML = html;
    L.DomEvent.disableClickPropagation(div);

    const active = new Set(Object.keys(CLASS_INFO));
    div.querySelectorAll(".row").forEach(row => {
      row.addEventListener("click", () => {
        const k = row.getAttribute("data-k");
        if (active.has(k)) { active.delete(k); row.classList.add("dim"); }
        else { active.add(k); row.classList.remove("dim"); }
        streetLayer.eachLayer(lyr => {
          const show = active.has(lyr.feature.properties.klasse);
          lyr.setStyle({ opacity: show ? 0.9 : 0 });
        });
      });
    });
    return div;
  };
  legend.addTo(map);
}

// Groups the already-loaded street layers by name (many segments share one
// street name), so a search only needs to filter data already in memory —
// no external geocoding, no new data file.
function buildStreetIndex(streetLayer) {
  const index = new Map();
  streetLayer.eachLayer(lyr => {
    const name = (lyr.feature.properties.strasse || "").trim();
    if (!name) return;
    if (!index.has(name)) index.set(name, []);
    index.get(name).push(lyr);
  });
  return index;
}

function buildSearch(map, streetLayer) {
  const index = buildStreetIndex(streetLayer);
  const allNames = Array.from(index.keys()).sort((a, b) => a.localeCompare(b, "de"));

  const control = L.control({ position: "topleft" });
  control.onAdd = function () {
    const div = L.DomUtil.create("div", "search-control");
    div.innerHTML = `
      <input type="text" class="search-input" placeholder="Straße suchen …" autocomplete="off">
      <ul class="search-results"></ul>
    `;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    const input = div.querySelector(".search-input");
    const resultsEl = div.querySelector(".search-results");
    let currentMatches = [];
    let activeIndex = -1;
    let highlightTimer = null;

    function render(matches) {
      currentMatches = matches;
      activeIndex = -1;
      resultsEl.innerHTML = matches.map((name, i) => `<li data-i="${i}">${name}</li>`).join("");
      resultsEl.style.display = matches.length ? "block" : "none";
    }

    function updateActive() {
      Array.from(resultsEl.children).forEach((li, i) => li.classList.toggle("active", i === activeIndex));
    }

    function selectStreet(name) {
      const layers = index.get(name);
      if (!layers || !layers.length) return;

      map.flyToBounds(L.featureGroup(layers).getBounds(), { padding: [40, 40], maxZoom: 17, duration: 0.6 });

      if (highlightTimer) clearTimeout(highlightTimer);
      layers.forEach(lyr => lyr.setStyle({ color: "#ffd23f", weight: (lyr.options.weight || 2) + 3, opacity: 1 }));
      highlightTimer = setTimeout(() => layers.forEach(lyr => streetLayer.resetStyle(lyr)), 1800);

      input.value = name;
      render([]);
      input.blur();
    }

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { render([]); return; }
      const starts = [], contains = [];
      for (const name of allNames) {
        const ln = name.toLowerCase();
        if (ln.startsWith(q)) starts.push(name);
        else if (ln.includes(q)) contains.push(name);
      }
      render([...starts, ...contains].slice(0, 8));
    });

    input.addEventListener("keydown", (e) => {
      if (!currentMatches.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, currentMatches.length - 1); updateActive(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); updateActive(); }
      else if (e.key === "Enter") { e.preventDefault(); selectStreet(currentMatches[activeIndex >= 0 ? activeIndex : 0]); }
      else if (e.key === "Escape") { render([]); input.blur(); }
    });

    resultsEl.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      selectStreet(currentMatches[parseInt(li.getAttribute("data-i"), 10)]);
    });

    document.addEventListener("click", (e) => { if (!div.contains(e.target)) render([]); });

    return div;
  };
  control.addTo(map);
}

async function init() {
  const loadingEl = document.getElementById("loading");
  const countEl = document.getElementById("count");

  const map = L.map("map", {
    zoomControl: true,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: BERLIN_MAX_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

  // No "bounds" restriction here on purpose — tiles render everywhere,
  // only panning/zooming is capped (via maxBounds above). This is what
  // avoids the grey void when zooming out.
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 10,
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  try {
    const [streetData, boundaryData, maskData] = await Promise.all([
      fetch("data/streets.geojson").then(r => r.json()),
      fetch("data/bezirk_boundary.geojson").then(r => r.json()),
      fetch("data/mask.geojson").then(r => r.json())
    ]);

    // Dim everything outside Steglitz-Zehlendorf so the district reads as
    // the clear subject of the map, without tinting the district itself
    // (which would dull the colored street data sitting on top of it).
    // Tweak fillOpacity (0–1) to make this lighter/darker.
    L.geoJSON(maskData, {
      style: { fillColor: "#1c2622", fillOpacity: 0.18, stroke: false },
      interactive: false
    }).addTo(map);

    const streetLayer = L.geoJSON(streetData, {
      style: styleFor,
      onEachFeature: (feature, lyr) => {
        lyr.bindPopup(popupFor(feature));
        lyr.on("mouseover", function () { this.setStyle({ weight: (this.options.weight || 2) + 2 }); });
        lyr.on("mouseout", function () { streetLayer.resetStyle(this); });
      }
    }).addTo(map);

    // District outline: a light halo underneath + solid black line on top,
    // so the boundary reads clearly regardless of what's beneath it.
    L.geoJSON(boundaryData, {
      style: { color: "#ffffff", weight: 6, fill: false, opacity: 0.9 },
      interactive: false
    }).addTo(map);
    L.geoJSON(boundaryData, {
      style: { color: "#111111", weight: 3, fill: false, opacity: 1 },
      interactive: false
    }).addTo(map);

    // NOTE: no map.fitBounds() here on purpose — the initial view is fixed
    // to DEFAULT_VIEW above (Sundgauer Straße), not "zoom to fit all streets".
    buildLegend(map, streetLayer);
    buildSearch(map, streetLayer);

    countEl.textContent = `${streetData.features.length} Straßenabschnitte`;
  } catch (err) {
    countEl.textContent = "Fehler beim Laden der Daten";
    console.error(err);
  } finally {
    loadingEl.classList.add("hidden");
  }
}

init();
