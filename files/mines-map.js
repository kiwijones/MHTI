(function () {
  'use strict';

  const IRELAND_BOUNDS = [[51.2, -11.2], [55.5, -5.2]];
  const searchInput = document.getElementById('mine-search');
  const countySelect = document.getElementById('county-filter');
  const includeUnmapped = document.getElementById('include-unmapped');
  const resetButton = document.getElementById('reset-map');
  const status = document.getElementById('map-status');
  const resultCount = document.getElementById('result-count');
  const results = document.getElementById('mine-results');

  const map = L.map('mines-map', {
    minZoom: 6,
    maxZoom: 18,
    maxBounds: [[49.5, -13], [57.2, -3.5]],
    maxBoundsViscosity: 0.6
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.fitBounds(IRELAND_BOUNDS);

  const markerLayer = L.layerGroup().addTo(map);
  let records = [];
  let visibleRecords = [];

  function cleanText(value) {
    return String(value || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanCounty(value) {
    const county = cleanText(value);
    return county === 'Offlay' ? 'Offaly' : county;
  }

  function validPosition(position) {
    if (!position) return false;
    const lat = Number(position.Latitude);
    const lng = Number(position.Longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 50 && lat <= 56.5 && lng >= -11.5 && lng <= -5;
  }

  function safeLocalUrl(value) {
    const url = cleanText(value);
    return /^[a-z0-9][a-z0-9._/-]*\.html(?:[?#].*)?$/i.test(url) ? url : '';
  }

  function flattenData(data) {
    const flattened = [];
    data.forEach(function (countyEntry) {
      const county = cleanCounty(countyEntry.county);
      (countyEntry.location || []).forEach(function (mine, index) {
        const name = cleanText(mine.Mine) || 'Unnamed mine';
        const sites = mine.sites || [];
        const siteNames = sites.map(function (site) {
          return cleanText(site.minesite || site.Mine || site.name);
        }).filter(Boolean);
        flattened.push({
          id: county + '-' + index + '-' + name,
          name: name,
          county: county,
          url: safeLocalUrl(mine.url),
          sites: siteNames,
          mapped: validPosition(mine.Position),
          lat: Number(mine.Position && mine.Position.Latitude),
          lng: Number(mine.Position && mine.Position.Longitude),
          marker: null,
          searchText: cleanText([name, county].concat(siteNames).join(' ')).toLocaleLowerCase()
        });
        sites.forEach(function (site, siteIndex) {
          if (!Object.prototype.hasOwnProperty.call(site, 'Position')) return;
          const siteName = cleanText(site.minesite || site.Mine || site.name) || 'Unnamed working';
          flattened.push({
            id: county + '-' + index + '-site-' + siteIndex + '-' + siteName,
            name: siteName,
            parentName: name,
            associated: true,
            county: county,
            url: safeLocalUrl(site.url),
            sites: [],
            mapped: validPosition(site.Position),
            lat: Number(site.Position && site.Position.Latitude),
            lng: Number(site.Position && site.Position.Longitude),
            marker: null,
            searchText: cleanText([siteName, name, county].join(' ')).toLocaleLowerCase()
          });
        });
      });
    });
    return flattened.sort(function (a, b) {
      return a.county.localeCompare(b.county) || a.name.localeCompare(b.name);
    });
  }

  function buildPopup(record) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mine-popup';
    const heading = document.createElement('h3');
    heading.textContent = record.name;
    wrapper.appendChild(heading);
    if (record.associated) {
      const parent = document.createElement('p');
      parent.textContent = 'Associated working of ' + record.parentName;
      wrapper.appendChild(parent);
    }
    const county = document.createElement('p');
    county.textContent = 'County ' + record.county;
    wrapper.appendChild(county);
    if (record.sites.length) {
      const label = document.createElement('p');
      label.textContent = 'Associated sites:';
      wrapper.appendChild(label);
      const list = document.createElement('ul');
      record.sites.forEach(function (name) {
        const item = document.createElement('li');
        item.textContent = name;
        list.appendChild(item);
      });
      wrapper.appendChild(list);
    }
    if (record.url) {
      const link = document.createElement('a');
      link.href = record.url;
      link.textContent = 'View mine details';
      wrapper.appendChild(link);
    }
    return wrapper;
  }

  function makeMarker(record) {
    const marker = L.circleMarker([record.lat, record.lng], {
      radius: 7,
      weight: 2,
      color: '#ffffff',
      fillColor: record.associated ? '#b56a2d' : '#508d24',
      fillOpacity: 0.9
    });
    marker.bindPopup(buildPopup(record), { maxWidth: 290 });
    marker.bindTooltip(record.name, { direction: 'top', offset: [0, -5] });
    record.marker = marker;
    return marker;
  }

  function renderResult(record) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mine-result';
    const name = document.createElement('span');
    name.className = 'mine-name';
    name.textContent = record.name;
    const meta = document.createElement('span');
    meta.className = 'mine-meta';
    const county = document.createElement('span');
    county.textContent = record.associated ? record.county + ' · associated working' : record.county;
    const mapState = document.createElement('span');
    mapState.textContent = record.mapped ? 'View on map' : 'Not yet mapped';
    if (!record.mapped) mapState.className = 'unmapped';
    meta.appendChild(county);
    meta.appendChild(mapState);
    button.appendChild(name);
    button.appendChild(meta);
    button.addEventListener('click', function () {
      if (record.mapped && record.marker) {
        const parent = record.associated && records.find(function (candidate) {
          return !candidate.associated && candidate.county === record.county && candidate.name === record.parentName;
        });
        if (parent && parent.mapped) {
          map.fitBounds([[record.lat, record.lng], [parent.lat, parent.lng]], { padding: [55, 55], maxZoom: 14 });
        } else {
          map.setView([record.lat, record.lng], 13);
        }
        record.marker.openPopup();
        document.getElementById('mines-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return button;
  }

  function applyFilters(fitMap) {
    const query = cleanText(searchInput.value).toLocaleLowerCase();
    const county = countySelect.value;
    const showUnmapped = includeUnmapped.checked;
    visibleRecords = records.filter(function (record) {
      return (!county || record.county === county) && (!query || record.searchText.includes(query)) && (showUnmapped || record.mapped);
    });

    markerLayer.clearLayers();
    const mappedVisible = visibleRecords.filter(function (record) { return record.mapped; });
    mappedVisible.filter(function (record) { return record.associated; }).forEach(function (record) {
      const parent = mappedVisible.find(function (candidate) {
        return !candidate.associated && candidate.county === record.county && candidate.name === record.parentName;
      });
      if (parent) {
        markerLayer.addLayer(L.polyline([[parent.lat, parent.lng], [record.lat, record.lng]], {
          color: '#8a715d',
          weight: 2,
          opacity: 0.7,
          dashArray: '5 6',
          interactive: false
        }));
      }
    });
    mappedVisible.forEach(function (record) { markerLayer.addLayer(record.marker || makeMarker(record)); });

    results.replaceChildren();
    if (!visibleRecords.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-results';
      empty.textContent = 'No mine records match these filters.';
      results.appendChild(empty);
    } else {
      const fragment = document.createDocumentFragment();
      visibleRecords.forEach(function (record) { fragment.appendChild(renderResult(record)); });
      results.appendChild(fragment);
    }

    resultCount.textContent = visibleRecords.length + (visibleRecords.length === 1 ? ' record' : ' records');
    status.textContent = mappedVisible.length + ' mapped location' + (mappedVisible.length === 1 ? '' : 's') + ' shown' + (showUnmapped ? ' · ' + (visibleRecords.length - mappedVisible.length) + ' awaiting coordinates' : '');

    if (fitMap) {
      if (mappedVisible.length === 1) map.setView([mappedVisible[0].lat, mappedVisible[0].lng], 12);
      else if (mappedVisible.length > 1) map.fitBounds(L.latLngBounds(mappedVisible.map(function (record) { return [record.lat, record.lng]; })), { padding: [28, 28], maxZoom: 11 });
      else map.fitBounds(IRELAND_BOUNDS);
    }
  }

  function populateCounties() {
    const counties = Array.from(new Set(records.map(function (record) { return record.county; }))).sort();
    counties.forEach(function (county) {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countySelect.appendChild(option);
    });
  }

  function reset() {
    searchInput.value = '';
    countySelect.value = '';
    includeUnmapped.checked = false;
    applyFilters(false);
    map.fitBounds(IRELAND_BOUNDS);
    searchInput.focus();
  }

  searchInput.addEventListener('input', function () { applyFilters(true); });
  countySelect.addEventListener('change', function () { applyFilters(true); });
  includeUnmapped.addEventListener('change', function () { applyFilters(false); });
  resetButton.addEventListener('click', reset);

  fetch('MineSites_20230622.json')
    .then(function (response) {
      if (!response.ok) throw new Error('The mine dataset could not be loaded.');
      return response.json();
    })
    .then(function (data) {
      records = flattenData(data);
      populateCounties();
      records.filter(function (record) { return record.mapped; }).forEach(makeMarker);
      applyFilters(false);
      map.fitBounds(IRELAND_BOUNDS);
    })
    .catch(function (error) {
      status.textContent = error.message + ' Please reload the page or return to the Irish Mines directory.';
      status.classList.add('map-error');
      results.innerHTML = '<p class="empty-results">Map data is unavailable.</p>';
    });
}());
