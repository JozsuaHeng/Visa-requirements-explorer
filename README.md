# Visa Requirement Explorer

**Live site:** https://jozsuaheng.github.io/Visa-requirements-explorer/

Pick your passport from the list, and watch a zoomable world map color every
country by what you'd need to visit — visa-free, visa on arrival, eTA/ESTA,
e-visa, visa required, and so on. Zoom in far enough and capital-city markers
appear too.

## Features

- Searchable list of 199 countries/territories to pick your passport
- A world map that recolors instantly based on your selection
- Zoom and pan, with capital-city markers that fade in as you zoom closer
- A legend with live counts (e.g. "Visa-free: 130") for whichever passport is selected
- Hover any country for the exact requirement, including day limits where they apply
- Works fully offline / opened directly as a file — no server or build step needed

## Data sources

- Visa rules: the open-source [passport-index-dataset](https://github.com/ilyankou/passport-index-dataset)
  (community-maintained — **not** an official government source; always double-check
  with an embassy or official government source before you actually travel)
- Map shapes: the [world-atlas](https://github.com/topojson/world-atlas) package,
  derived from Natural Earth
- Capital city coordinates: cross-checked from public GPS datasets

## Disclaimer

Visa requirements change frequently and this project relies on a
community-maintained dataset, not an official government source. Always verify
with an embassy or official government website before making travel plans.
