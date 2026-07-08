(function () {
  'use strict';

  var CATEGORY_ORDER = [
    'visa_free', 'visa_on_arrival', 'eta', 'e_visa',
    'visa_required', 'no_admission', 'home', 'no_data'
  ];

  var CATEGORY_LABEL = {
    visa_free: 'Visa-free',
    visa_on_arrival: 'Visa on arrival',
    eta: 'eTA / ESTA required',
    e_visa: 'e-Visa required',
    visa_required: 'Visa required',
    no_admission: 'Entry not permitted',
    home: 'Home country / territory',
    no_data: 'No data available'
  };

  var rootStyle = getComputedStyle(document.documentElement);
  function cssVar(name) { return rootStyle.getPropertyValue(name).trim(); }

  var CATEGORY_COLOR = {
    visa_free: cssVar('--c-visa-free'),
    visa_on_arrival: cssVar('--c-visa-on-arrival'),
    eta: cssVar('--c-eta'),
    e_visa: cssVar('--c-e-visa'),
    visa_required: cssVar('--c-visa-required'),
    no_admission: cssVar('--c-no-admission'),
    home: cssVar('--c-home'),
    no_data: cssVar('--c-no-data')
  };

  var NEUTRAL_FILL = '#cbd5e1';

  var CODE_TO_NAME = {};
  COUNTRIES.forEach(function (c) { CODE_TO_NAME[c.code] = c.name; });

  // ── State ───────────────────────────────────────────────────
  var passportCode = null;
  var locationCode = null;
  var locationManuallySet = false;
  var destinationCode = null;

  // ── Controls: three selects ─────────────────────────────────
  var passportSelect = document.getElementById('passportSelect');
  var locationSelect = document.getElementById('locationSelect');
  var destinationSelect = document.getElementById('destinationSelect');
  var emptyStateEl = document.getElementById('mapEmptyState');

  // Appends a country <option> per entry in COUNTRIES. destinationSelect
  // already has its placeholder option first in the HTML, so this just adds
  // after it; passport/location selects start empty and get the same list.
  function populateSelect(select) {
    var frag = document.createDocumentFragment();
    COUNTRIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = c.name;
      frag.appendChild(opt);
    });
    select.appendChild(frag);
  }

  populateSelect(passportSelect);
  populateSelect(locationSelect);
  populateSelect(destinationSelect);

  passportSelect.addEventListener('change', function () {
    passportCode = passportSelect.value || null;
    if (!locationManuallySet) {
      locationSelect.value = passportCode || '';
      locationCode = passportCode;
    }
    recolorMap();
    renderLegend();
    if (destinationCode) showDetailFor(destinationCode);
    updateEmptyState();
  });

  locationSelect.addEventListener('change', function () {
    locationManuallySet = true;
    locationCode = locationSelect.value || null;
    // Display-only for now: our data has no location-based rules, so this
    // doesn't change anything else. See the footer note on the page.
  });

  destinationSelect.addEventListener('change', function () {
    var code = destinationSelect.value || null;
    if (code) selectDestination(code); else clearDestination();
  });

  function updateEmptyState() {
    emptyStateEl.style.display = passportCode ? 'none' : 'flex';
  }

  // ── Map ─────────────────────────────────────────────────────
  var svg = d3.select('#map');
  var mapArea = document.querySelector('.map-area');
  var tooltip = document.getElementById('tooltip');

  var VIEW_W = 960, VIEW_H = 520;
  var geojson = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries);
  var projection = d3.geoNaturalEarth1().fitSize([VIEW_W, VIEW_H], geojson);
  var pathGen = d3.geoPath(projection);

  var defs = svg.append('defs');
  var oceanGradient = defs.append('radialGradient')
    .attr('id', 'oceanGradient')
    .attr('cx', '50%').attr('cy', '38%').attr('r', '75%');
  oceanGradient.append('stop').attr('offset', '0%').attr('stop-color', '#bfe0f0');
  oceanGradient.append('stop').attr('offset', '60%').attr('stop-color', '#8fc4e0');
  oceanGradient.append('stop').attr('offset', '100%').attr('stop-color', '#5fa0c8');

  var g = svg.append('g');

  g.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'ocean')
    .attr('d', pathGen)
    .attr('fill', 'url(#oceanGradient)');

  g.append('path')
    .datum(d3.geoGraticule10())
    .attr('class', 'graticule')
    .attr('d', pathGen);

  g.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'globe-outline')
    .attr('d', pathGen);

  function featureMeta(feature) {
    var key = (feature.id !== undefined && feature.id !== null)
      ? feature.id
      : 'name:' + (feature.properties && feature.properties.name);
    return TOPO_ID_MAP[key] || null;
  }

  // Same compact-format lookup as the main site's app.js (see that file for
  // the format rationale): row.f = {destCode: days}, row.a/t/e/r/n = arrays.
  function lookupVisa(passport, destCode) {
    if (destCode === passport) return { cat: 'home' };
    var row = VISA_MATRIX[passport];
    if (!row) return null;
    if (row.f && Object.prototype.hasOwnProperty.call(row.f, destCode)) {
      var days = row.f[destCode];
      return days ? { cat: 'visa_free', days: days } : { cat: 'visa_free' };
    }
    if (row.a && row.a.indexOf(destCode) !== -1) return { cat: 'visa_on_arrival' };
    if (row.t && row.t.indexOf(destCode) !== -1) return { cat: 'eta' };
    if (row.e && row.e.indexOf(destCode) !== -1) return { cat: 'e_visa' };
    if (row.r && row.r.indexOf(destCode) !== -1) return { cat: 'visa_required' };
    if (row.n && row.n.indexOf(destCode) !== -1) return { cat: 'no_admission' };
    return null;
  }

  // Resolves a map feature to a destination code that's actually one of our
  // 199 passport/destination countries — following the territory-to-sovereign
  // fallback (e.g. clicking Puerto Rico resolves to "US") since the selects
  // and VISA_MATRIX only know about sovereign countries.
  function destCodeForFeature(feature) {
    var meta = featureMeta(feature);
    if (!meta || !meta.a2) return null;
    if (CODE_TO_NAME[meta.a2]) return meta.a2;
    var sovereign = TERRITORY_SOVEREIGN[meta.a2];
    if (sovereign && CODE_TO_NAME[sovereign]) return sovereign;
    return null;
  }

  function resolveEntry(feature) {
    if (!passportCode) return null;
    var meta = featureMeta(feature);
    if (!meta || !meta.a2) return { cat: 'no_data' };

    var entry = lookupVisa(passportCode, meta.a2);
    if (entry) return entry;

    var sovereign = TERRITORY_SOVEREIGN[meta.a2];
    if (sovereign) {
      var sEntry = lookupVisa(passportCode, sovereign);
      if (sEntry) {
        sEntry = Object.assign({}, sEntry);
        sEntry.viaTerritory = true;
        sEntry.sovereignName = CODE_TO_NAME[sovereign] || sovereign;
        return sEntry;
      }
    }
    return { cat: 'no_data' };
  }

  function fillFor(feature) {
    if (!passportCode) return NEUTRAL_FILL;
    var entry = resolveEntry(feature);
    return CATEGORY_COLOR[entry.cat] || CATEGORY_COLOR.no_data;
  }

  // Guard against corrupt/degenerate geometries (see app.js for the full story
  // — a bad topology arc can render as a giant shape covering the whole map).
  var renderableFeatures = geojson.features.filter(function (f) {
    var b = pathGen.bounds(f);
    var w = b[1][0] - b[0][0];
    var h = b[1][1] - b[0][1];
    return !(w > VIEW_W * 0.9 && h > VIEW_H * 0.9);
  });

  var paths = g.selectAll('path.country')
    .data(renderableFeatures)
    .join('path')
    .attr('class', 'country')
    .attr('d', pathGen)
    .attr('fill', fillFor)
    .on('mousemove', function (event, d) {
      showTooltip(event, d);
    })
    .on('mouseleave', function () {
      tooltip.hidden = true;
    })
    .on('click', function (event, d) {
      var code = destCodeForFeature(d);
      if (code) selectDestination(code);
    });

  function recolorMap() {
    paths.attr('fill', fillFor);
  }

  function updateHighlight() {
    paths.classed('highlighted', function (d) {
      return destinationCode && destCodeForFeature(d) === destinationCode;
    });
  }

  function tooltipHTML(name, entry) {
    var html = '<strong>' + name + '</strong>';
    if (passportCode) {
      var label = CATEGORY_LABEL[entry.cat] || CATEGORY_LABEL.no_data;
      html += '<div>' + label + '</div>';
      if (entry.cat === 'visa_free' && entry.days) {
        html += '<div class="tip-days">Up to ' + entry.days + ' days</div>';
      }
      if (entry.viaTerritory) {
        html += '<div class="tip-days">Follows ' + entry.sovereignName + ' visa policy</div>';
      }
    } else {
      html += '<div class="tip-days">Select a passport to see requirements</div>';
    }
    return html;
  }

  function positionTooltip(event) {
    var rect = mapArea.getBoundingClientRect();
    var x = event.clientX - rect.left + 14;
    var y = event.clientY - rect.top + 14;
    var maxX = rect.width - 230;
    var maxY = rect.height - 90;
    tooltip.style.left = Math.min(x, Math.max(maxX, 0)) + 'px';
    tooltip.style.top = Math.min(y, Math.max(maxY, 0)) + 'px';
  }

  function showTooltip(event, feature) {
    var meta = featureMeta(feature);
    var name = (meta && meta.name) || (feature.properties && feature.properties.name) || 'Unknown';
    tooltip.innerHTML = tooltipHTML(name, resolveEntry(feature));
    tooltip.hidden = false;
    positionTooltip(event);
  }

  // ── Detail card ─────────────────────────────────────────────
  var detailCard = document.getElementById('detailCard');
  var detailCardTitle = document.getElementById('detailCardTitle');
  var detailCardBody = document.getElementById('detailCardBody');
  var detailCardClose = document.getElementById('detailCardClose');

  function selectDestination(code) {
    destinationCode = code;
    destinationSelect.value = code;
    updateHighlight();
    showDetailFor(code);
  }

  function clearDestination() {
    destinationCode = null;
    updateHighlight();
    detailCard.hidden = true;
  }

  detailCardClose.addEventListener('click', function () {
    detailCard.hidden = true;
    destinationSelect.value = '';
    destinationCode = null;
    updateHighlight();
  });

  function showDetailFor(destCode) {
    if (!passportCode) return;
    var destName = CODE_TO_NAME[destCode] || destCode;
    var passportName = CODE_TO_NAME[passportCode] || passportCode;
    var entry = lookupVisa(passportCode, destCode) || { cat: 'no_data' };

    detailCardTitle.textContent = passportName + ' → ' + destName;

    var label = CATEGORY_LABEL[entry.cat] || CATEGORY_LABEL.no_data;
    var html = '<div class="detail-category">' + label + '</div>';

    if (entry.cat === 'home') {
      html = '<div class="detail-category">This is your passport\'s home country</div>';
    } else if (entry.cat === 'visa_free') {
      html += entry.days
        ? '<div class="detail-days">Up to ' + entry.days + ' days without a visa.</div>'
        : '<div class="detail-days">No visa needed, no specific day limit given.</div>';
    } else if (entry.cat === 'visa_on_arrival') {
      html += '<div class="detail-days">Get your visa when you arrive — no need to apply in advance.</div>';
    } else if (entry.cat === 'eta') {
      html += '<div class="detail-days">Apply online for an electronic travel authorization before you fly.</div>';
    } else if (entry.cat === 'e_visa') {
      html += '<div class="detail-days">Apply for an e-visa online before you travel.</div>';
    } else if (entry.cat === 'visa_required') {
      html += '<div class="detail-days">You\'ll need to apply for a visa (often through an embassy/consulate) before you travel.</div>';
    } else if (entry.cat === 'no_admission') {
      html += '<div class="detail-days">Holders of this passport are not admitted.</div>';
    } else {
      html += '<div class="detail-days">No data available for this destination.</div>';
    }

    if (entry.cat !== 'home' && entry.cat !== 'no_data') {
      var query = encodeURIComponent(destName + ' visa requirements for ' + passportName + ' passport holders');
      html += '<div class="detail-note">Not an official source — always confirm with an embassy or government site.</div>';
      html += '<a href="https://www.google.com/search?q=' + query + '" target="_blank" rel="noopener">Search official visa information →</a>';
    }

    detailCardBody.innerHTML = html;
    detailCard.hidden = false;
  }

  // ── Capitals ────────────────────────────────────────────────
  var CAPITAL_DOT_R = 3;
  var CAPITAL_HALO_R = 7.5;
  var ZOOM_SHOW_DOTS = 1.8;
  var ZOOM_SHOW_LABELS = 4;

  var capitalsLayer = g.append('g').attr('class', 'capitals-layer');

  var capitalNodes = CAPITALS.map(function (c) {
    var p = projection([c.lng, c.lat]);
    return { code: c.code, name: c.name, capital: c.capital, x: p[0], y: p[1] };
  });

  var capitalG = capitalsLayer.selectAll('g.capital')
    .data(capitalNodes)
    .join('g')
    .attr('class', 'capital')
    .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; })
    .on('mousemove', function (event, d) {
      var entry = passportCode ? (lookupVisa(passportCode, d.code) || { cat: 'no_data' }) : null;
      tooltip.innerHTML = passportCode
        ? tooltipHTML(d.capital, entry) + '<div class="tip-days">Capital of ' + d.name + '</div>'
        : tooltipHTML(d.capital, null);
      tooltip.hidden = false;
      positionTooltip(event);
    })
    .on('mouseleave', function () {
      tooltip.hidden = true;
    })
    .on('click', function (event, d) {
      selectDestination(d.code);
    });

  var capitalInner = capitalG.append('g').attr('class', 'capital-inner');
  capitalInner.append('circle').attr('class', 'capital-halo').attr('r', CAPITAL_HALO_R);
  capitalInner.append('circle').attr('class', 'capital-dot').attr('r', CAPITAL_DOT_R);
  capitalInner.append('text')
    .attr('class', 'capital-label')
    .attr('x', CAPITAL_DOT_R + 5)
    .attr('y', 3)
    .text(function (d) { return d.capital; });

  function updateCapitalsForZoom(k) {
    capitalInner.attr('transform', 'scale(' + (1 / k) + ')');
    capitalsLayer.classed('show-dots', k >= ZOOM_SHOW_DOTS);
    capitalsLayer.classed('show-labels', k >= ZOOM_SHOW_LABELS);
  }

  // ── Zoom ────────────────────────────────────────────────────
  var zoom = d3.zoom()
    .scaleExtent([1, 10])
    .on('zoom', function (event) {
      g.attr('transform', event.transform);
      updateCapitalsForZoom(event.transform.k);
    });

  svg.call(zoom);
  updateCapitalsForZoom(1);

  document.getElementById('zoomIn').addEventListener('click', function () {
    svg.transition().duration(200).call(zoom.scaleBy, 1.5);
  });
  document.getElementById('zoomOut').addEventListener('click', function () {
    svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.5);
  });
  document.getElementById('zoomReset').addEventListener('click', function () {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  });

  // ── Legend ──────────────────────────────────────────────────
  var legendEl = document.getElementById('legend');

  function computeCounts(code) {
    var counts = {};
    CATEGORY_ORDER.forEach(function (c) { counts[c] = 0; });
    var row = VISA_MATRIX[code];
    if (!row) return counts;
    counts.visa_free = Object.keys(row.f || {}).length;
    counts.visa_on_arrival = (row.a || []).length;
    counts.eta = (row.t || []).length;
    counts.e_visa = (row.e || []).length;
    counts.visa_required = (row.r || []).length;
    counts.no_admission = (row.n || []).length;
    counts.home = 1;
    return counts;
  }

  function renderLegend() {
    legendEl.innerHTML = '';
    if (!passportCode) {
      legendEl.style.display = 'none';
      return;
    }
    legendEl.style.display = 'flex';

    var counts = computeCounts(passportCode);

    CATEGORY_ORDER.forEach(function (cat) {
      var item = document.createElement('div');
      item.className = 'legend-item';

      var swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.background = CATEGORY_COLOR[cat];
      item.appendChild(swatch);

      var text = document.createElement('span');
      text.textContent = CATEGORY_LABEL[cat] + ' (' + counts[cat] + ')';
      item.appendChild(text);

      legendEl.appendChild(item);
    });
  }

  // ── Init ────────────────────────────────────────────────────
  updateEmptyState();
  renderLegend();
})();
