# Straßenreinigung Steglitz-Zehlendorf

Interactive map of street-cleaning classes (Reinigungsklassen) in the Berlin
district of Steglitz-Zehlendorf, built with [Leaflet](https://leafletjs.com/).

## Files

- `index.html` — page shell, loads Leaflet + this repo's CSS/JS
- `style.css` — all styling
- `app.js` — map logic (loads the two data files, draws streets + district outline, builds the legend)
- `data/streets.geojson` — 9,529 street segments with cleaning class, from BSR (Berliner Stadtreinigungsbetriebe), clipped to Steglitz-Zehlendorf
- `data/bezirk_boundary.geojson` — official Steglitz-Zehlendorf district outline, from ALKIS Berlin (gdi.berlin.de)

## Data sources

- Street cleaning data: [BSR via GovData](https://www.govdata.de/suche/daten/bsr-strassenreinigung-verzeichnisse-und-reinigungsklassen)
- District boundary: [ALKIS Berlin Bezirke (WFS)](https://daten.berlin.de/datensaetze/alkis-berlin-bezirke-wfs-ced31d7d), Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin
- Both under Datenlizenz Deutschland – Zero – Version 2.0

## Publishing on GitHub Pages

See the setup steps provided alongside this repo. In short: push these files
to a public repo, enable Pages (Settings → Pages → Deploy from branch → main
→ / (root)), then embed the resulting `https://<username>.github.io/<repo>/`
URL via an `<iframe>` wherever you like.
