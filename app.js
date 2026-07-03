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
  var STORAGE_KEY = 'visa-map-selected-passport';

  var CODE_TO_NAME = {};
  COUNTRIES.forEach(function (c) { CODE_TO_NAME[c.code] = c.name; });

  var selectedCode = null;

  // ── Sidebar: country list ──────────────────────────────────
  var listEl = document.getElementById('countryList');
  var searchEl = document.getElementById('countrySearch');
  var badgeEl = document.getElementById('selectedPassportBadge');
  var badgeFlag = document.getElementById('selectedFlag');
  var badgeName = document.getElementById('selectedName');
  var clearBtn = document.getElementById('clearPassport');
  var clearSearchBtn = document.getElementById('clearSearch');
  var emptyStateEl = document.getElementById('mapEmptyState');

  function renderCountryList(filter) {
    var q = (filter || '').trim().toLowerCase();
    var frag = document.createDocumentFragment();
    var shown = 0;

    COUNTRIES.forEach(function (c) {
      if (q && c.name.toLowerCase().indexOf(q) === -1) return;
      shown++;
      var li = document.createElement('li');
      li.dataset.code = c.code;
      if (c.code === selectedCode) li.classList.add('selected');

      var flag = document.createElement('span');
      flag.className = 'fi fi-' + c.code.toLowerCase();
      li.appendChild(flag);

      var label = document.createElement('span');
      label.textContent = c.name;
      li.appendChild(label);

      frag.appendChild(li);
    });

    if (shown === 0) {
      var none = document.createElement('li');
      none.className = 'no-results';
      none.textContent = 'No countries match "' + filter + '"';
      frag.appendChild(none);
    }

    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  listEl.addEventListener('click', function (e) {
    var li = e.target.closest('li[data-code]');
    if (!li) return;
    selectPassport(li.dataset.code);
  });

  searchEl.addEventListener('input', function () {
    clearSearchBtn.hidden = searchEl.value.length === 0;
    renderCountryList(searchEl.value);
  });

  clearSearchBtn.addEventListener('click', function () {
    searchEl.value = '';
    clearSearchBtn.hidden = true;
    renderCountryList('');
    searchEl.focus();
  });

  clearBtn.addEventListener('click', function () {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    searchEl.value = '';
    clearSearchBtn.hidden = true;
    renderCountryList('');
    selectPassport(null);
  });

  function selectPassport(code) {
    selectedCode = code;

    if (code) {
      localStorage.setItem(STORAGE_KEY, code);
      history.replaceState(null, '', '#' + code);
      badgeFlag.className = 'fi fi-' + code.toLowerCase();
      badgeName.textContent = CODE_TO_NAME[code] || code;
      badgeEl.hidden = false;
      emptyStateEl.style.display = 'none';
    } else {
      localStorage.removeItem(STORAGE_KEY);
      history.replaceState(null, '', location.pathname + location.search);
      badgeEl.hidden = true;
      emptyStateEl.style.display = 'flex';
    }

    renderCountryList(searchEl.value);
    recolorMap();
    renderLegend();
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

  function resolveEntry(feature) {
    if (!selectedCode) return null;
    var meta = featureMeta(feature);
    if (!meta || !meta.a2) return { cat: 'no_data' };

    var row = VISA_MATRIX[selectedCode];
    if (!row) return { cat: 'no_data' };

    if (row[meta.a2]) {
      return row[meta.a2];
    }

    var sovereign = TERRITORY_SOVEREIGN[meta.a2];
    if (sovereign && row[sovereign]) {
      var entry = Object.assign({}, row[sovereign]);
      entry.viaTerritory = true;
      entry.sovereignName = CODE_TO_NAME[sovereign] || sovereign;
      return entry;
    }

    return { cat: 'no_data' };
  }

  function fillFor(feature) {
    if (!selectedCode) return NEUTRAL_FILL;
    var entry = resolveEntry(feature);
    return CATEGORY_COLOR[entry.cat] || CATEGORY_COLOR.no_data;
  }

  // Guard against corrupt/degenerate geometries (e.g. a bad topology arc) that would
  // otherwise render as a giant shape covering the whole map. Legitimate countries that
  // straddle the antimeridian (Fiji, Kiribati) are wide but not tall, so this only
  // catches genuinely broken paths.
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
    });

  function recolorMap() {
    paths.attr('fill', fillFor);
  }

  function resolveEntryForCode(code) {
    if (!selectedCode) return null;
    var row = VISA_MATRIX[selectedCode];
    if (!row || !row[code]) return { cat: 'no_data' };
    return row[code];
  }

  function tooltipHTML(name, entry, extraHTML) {
    var html = '<strong>' + name + '</strong>';

    if (selectedCode) {
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

    if (extraHTML) html += extraHTML;
    return html;
  }

  function positionTooltip(event) {
    var rect = mapArea.getBoundingClientRect();
    var x = event.clientX - rect.left + 14;
    var y = event.clientY - rect.top + 14;

    // Keep tooltip inside the visible area
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
      tooltip.innerHTML = tooltipHTML(d.capital, resolveEntryForCode(d.code), '<div class="tip-days">Capital of ' + d.name + '</div>');
      tooltip.hidden = false;
      positionTooltip(event);
    })
    .on('mouseleave', function () {
      tooltip.hidden = true;
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
  document.getElementById('fullReset').addEventListener('click', function () {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    searchEl.value = '';
    clearSearchBtn.hidden = true;
    selectPassport(null);
  });

  // ── Legend ──────────────────────────────────────────────────
  var legendEl = document.getElementById('legend');

  // Counts destinations (the 199 recognized passport-index countries/territories,
  // not the ~241 map shapes) so dependent territories don't inflate their sovereign's total.
  function computeCounts(code) {
    var counts = {};
    CATEGORY_ORDER.forEach(function (c) { counts[c] = 0; });
    var row = VISA_MATRIX[code];
    if (!row) return counts;
    Object.keys(row).forEach(function (dest) {
      var cat = row[dest].cat;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }

  function renderLegend() {
    legendEl.innerHTML = '';

    if (!selectedCode) {
      legendEl.style.display = 'none';
      return;
    }
    legendEl.style.display = 'flex';

    var counts = computeCounts(selectedCode);

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
  renderCountryList('');
  renderLegend();

  var fromHash = (location.hash || '').replace('#', '').toUpperCase();
  var fromStorage = localStorage.getItem(STORAGE_KEY);
  var initialCode = CODE_TO_NAME[fromHash] ? fromHash : (CODE_TO_NAME[fromStorage] ? fromStorage : null);
  if (initialCode) {
    selectPassport(initialCode);
  }
})();
