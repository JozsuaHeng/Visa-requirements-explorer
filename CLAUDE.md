# CLAUDE.md

This file gives Claude Code context about this project and how to work with me.

## About me

I'm a beginner with coding, so please:
- Explain things simply, and explain any technical term before using it.
- Always check with me before running commands that could be risky — installing software, deleting or overwriting files, pushing to GitHub, changing git history, etc. — even if they seem routine to you.

## What this project is

This is **visa-map**, a single-page website that shows visa requirements around the world. A visitor picks their passport country from a searchable list on the left, and a zoomable world map on the right colors every country by what's needed to visit as a holder of that passport (visa-free, visa on arrival, eTA/ESTA, e-visa, visa required, etc.), plus small capital-city markers that appear as you zoom in.

It's a plain HTML/CSS/JavaScript site — no build step, no framework, no server required to develop. It can be opened directly in a browser or hosted anywhere that serves static files.

## Main files (all inside `visa-map/`)

- `index.html` — the page structure: sidebar with the country search box, the map area, the legend, and the tooltip.
- `styles.css` — all the visual styling (colors, layout, capital marker look, responsive behavior for smaller screens).
- `app.js` — all the logic: draws the world map with the D3.js library, colors countries based on the selected passport, handles zoom/pan, capital markers, tooltips, and the searchable country list.
- `data/` — pre-generated data, loaded as plain `<script>` tags (not fetched over the network, so the page still works even opened directly as a file, no server needed):
  - `countries.js` — country codes/names for the passport picker list.
  - `visa-matrix.js` — the actual visa rules: for every passport, what's needed to enter every other country.
  - `world-topo.js` — the world map shapes (country borders).
  - `topo-map.js` — links the map shapes to country codes.
  - `territory-map.js` — a handful of dependent territories (e.g. Puerto Rico, Greenland) that follow their parent country's visa rules instead of having their own.
  - `capitals.js` — capital city names and coordinates, used for the map markers.

## Where the data comes from

- Visa rules: the open-source [passport-index-dataset](https://github.com/ilyankou/passport-index-dataset) (community-maintained, **not** an official government source — this caveat is shown on the site itself).
- Map shapes: the `world-atlas` package (derived from Natural Earth map data).
- Capital city coordinates: cross-checked from public GPS datasets.

## Deployment

This project is meant to be deployed on **GitHub Pages**, pushed to the `origin` remote (`https://github.com/JozsuaHeng/JozsuaHeng.git`). It's a static site with no build step, so deploying is just a matter of pushing the files and pointing GitHub Pages at the right branch/folder in the repo settings.

## Notes for Claude

- Ask before: installing new tools/packages, pushing or force-pushing to GitHub, deleting or overwriting files, or running anything that touches the live GitHub Pages deployment.
- Keep explanations simple and avoid unexplained jargon.
