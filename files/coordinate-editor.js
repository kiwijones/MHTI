(function () {
  'use strict';

  const IRELAND_BOUNDS = [[50, -11.5], [56.5, -5]];
  const DEFAULT_VIEW = [53.35, -8.1];
  const countySelect = document.getElementById('editor-county');
  const mineSelect = document.getElementById('editor-mine');
  const latitudeInput = document.getElementById('editor-latitude');
  const longitudeInput = document.getElementById('editor-longitude');
  const selectedName = document.getElementById('selected-name');
  const selectedCounty = document.getElementById('selected-county');
  const coordinateState = document.getElementById('coordinate-state');
  const sitesList = document.getElementById('associated-sites-list');
  const applyButton = document.getElementById('apply-coordinates');
  const revertButton = document.getElementById('revert-record');
  const clearButton = document.getElementById('clear-coordinates');
  const nextButton = document.getElementById('next-unmapped');
  const downloadButton = document.getElementById('download-json');
  const changeCount = document.getElementById('change-count');
  const status = document.getElementById('editor-status');

  const map = L.map('coordinate-map', { minZoom: 6, maxZoom: 19, maxBounds: [[49.5, -13], [57.2, -3.5]] }).setView(DEFAULT_VIEW, 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  let dataset = [];
  let originalDataset = [];
  let marker = null;
  const changes = new Set();

  function cleanText(value) {
    return String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
  }

  function selectedCountyRecord() {
    return dataset[Number(countySelect.value)];
  }

  function selectedMineRecord() {
    const county = selectedCountyRecord();
    return county && county.location ? county.location[Number(mineSelect.value)] : null;
  }

  function recordKey() {
    return countySelect.value + ':' + mineSelect.value;
  }

  function validCoordinates(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= IRELAND_BOUNDS[0][0] && lat <= IRELAND_BOUNDS[1][0] && lng >= IRELAND_BOUNDS[0][1] && lng <= IRELAND_BOUNDS[1][1];
  }

  function hasMappedPosition(record) {
    const position = record && record.Position;
    return position && validCoordinates(Number(position.Latitude), Number(position.Longitude));
  }

  function setDraftPosition(lat, lng, pan) {
    latitudeInput.value = Number(lat).toFixed(7);
    longitudeInput.value = Number(lng).toFixed(7);
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', function () {
        const point = marker.getLatLng();
        setDraftPosition(point.lat, point.lng, false);
        status.textContent = 'Marker moved. Apply the coordinates to keep this change.';
      });
    } else {
      marker.setLatLng([lat, lng]);
    }
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }

  function updateChangeSummary() {
    const count = changes.size;
    changeCount.textContent = count ? count + (count === 1 ? ' record changed' : ' records changed') : 'No changes applied';
    downloadButton.disabled = count === 0;
  }

  function updateRecordPanel() {
    const county = selectedCountyRecord();
    const record = selectedMineRecord();
    if (!county || !record) return;
    selectedName.textContent = cleanText(record.Mine) || 'Unnamed mine';
    selectedCounty.textContent = 'County ' + cleanText(county.county);
    sitesList.replaceChildren();
    const sites = record.sites || [];
    if (sites.length) {
      sites.forEach(function (site) {
        const item = document.createElement('li');
        item.textContent = cleanText(site.minesite || site.Mine || site.name);
        sitesList.appendChild(item);
      });
    } else {
      const item = document.createElement('li');
      item.textContent = 'None recorded';
      sitesList.appendChild(item);
    }

    if (marker) { map.removeLayer(marker); marker = null; }
    if (hasMappedPosition(record)) {
      const lat = Number(record.Position.Latitude);
      const lng = Number(record.Position.Longitude);
      setDraftPosition(lat, lng, true);
      const verified = record.Data && record.Data.coordinateStatus === 'verified-user';
      coordinateState.className = 'coordinate-state' + (verified ? ' verified' : '');
      coordinateState.textContent = verified ? 'Verified coordinate' : 'Existing coordinate · ' + cleanText(record.Data && record.Data.coordinateStatus || 'source not recorded');
    } else {
      latitudeInput.value = '';
      longitudeInput.value = '';
      coordinateState.className = 'coordinate-state unmapped';
      coordinateState.textContent = 'No mapped coordinate';
      const countyPosition = county.Position;
      if (countyPosition && validCoordinates(Number(countyPosition.Latitude), Number(countyPosition.Longitude))) {
        map.setView([Number(countyPosition.Latitude), Number(countyPosition.Longitude)], 9);
      } else {
        map.setView(DEFAULT_VIEW, 7);
      }
    }
    status.textContent = 'Click the map, drag the marker, or enter exact decimal coordinates.';
  }

  function populateMines(preferredIndex) {
    const county = selectedCountyRecord();
    mineSelect.replaceChildren();
    (county.location || []).forEach(function (record, index) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = (hasMappedPosition(record) ? '● ' : '○ ') + cleanText(record.Mine);
      mineSelect.appendChild(option);
    });
    mineSelect.value = String(Math.min(preferredIndex || 0, Math.max(mineSelect.options.length - 1, 0)));
    updateRecordPanel();
  }

  function populateCounties() {
    countySelect.replaceChildren();
    dataset.forEach(function (county, index) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = cleanText(county.county);
      countySelect.appendChild(option);
    });
    countySelect.value = '0';
    populateMines(0);
  }

  function applyCoordinates() {
    const lat = Number(latitudeInput.value);
    const lng = Number(longitudeInput.value);
    if (!validCoordinates(lat, lng)) {
      status.textContent = 'Coordinates are invalid or outside the island of Ireland.';
      latitudeInput.focus();
      return;
    }
    const record = selectedMineRecord();
    record.Position = { Latitude: Number(lat.toFixed(7)), Longitude: Number(lng.toFixed(7)) };
    record.Data = Object.assign({}, record.Data, {
      coordinateStatus: 'verified-user',
      verifiedAt: new Date().toISOString()
    });
    changes.add(recordKey());
    setDraftPosition(lat, lng, true);
    populateMines(Number(mineSelect.value));
    coordinateState.className = 'coordinate-state verified';
    coordinateState.textContent = 'Verified coordinate';
    status.textContent = 'Verified coordinates applied to the working copy.';
    updateChangeSummary();
  }

  function revertRecord() {
    const countyIndex = Number(countySelect.value);
    const mineIndex = Number(mineSelect.value);
    dataset[countyIndex].location[mineIndex] = JSON.parse(JSON.stringify(originalDataset[countyIndex].location[mineIndex]));
    changes.delete(recordKey());
    populateMines(mineIndex);
    status.textContent = 'This record was restored to its original value.';
    updateChangeSummary();
  }

  function clearCoordinates() {
    const record = selectedMineRecord();
    record.Position = { Latitude: null, Longitude: null };
    record.Data = Object.assign({}, record.Data, { coordinateStatus: 'unmapped-user' });
    delete record.Data.verifiedAt;
    changes.add(recordKey());
    populateMines(Number(mineSelect.value));
    status.textContent = 'The record is marked as unmapped in the working copy.';
    updateChangeSummary();
  }

  function nextUnmapped() {
    const startCounty = Number(countySelect.value);
    const startMine = Number(mineSelect.value);
    for (let countyOffset = 0; countyOffset < dataset.length; countyOffset += 1) {
      const countyIndex = (startCounty + countyOffset) % dataset.length;
      const mines = dataset[countyIndex].location || [];
      const firstMine = countyOffset === 0 ? startMine + 1 : 0;
      for (let mineIndex = firstMine; mineIndex < mines.length; mineIndex += 1) {
        if (!hasMappedPosition(mines[mineIndex])) {
          countySelect.value = String(countyIndex);
          populateMines(mineIndex);
          return;
        }
      }
    }
    status.textContent = 'No later unmapped records were found. Choose a county to continue reviewing.';
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(dataset, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MineSites_20230622.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Updated JSON downloaded. Replace the site dataset with this file, test, then publish.';
  }

  map.on('click', function (event) {
    setDraftPosition(event.latlng.lat, event.latlng.lng, false);
    status.textContent = 'Map position selected. Apply the coordinates to keep this change.';
  });
  countySelect.addEventListener('change', function () { populateMines(0); });
  mineSelect.addEventListener('change', updateRecordPanel);
  latitudeInput.addEventListener('change', function () {
    const lat = Number(latitudeInput.value); const lng = Number(longitudeInput.value);
    if (validCoordinates(lat, lng)) setDraftPosition(lat, lng, true);
  });
  longitudeInput.addEventListener('change', function () {
    const lat = Number(latitudeInput.value); const lng = Number(longitudeInput.value);
    if (validCoordinates(lat, lng)) setDraftPosition(lat, lng, true);
  });
  applyButton.addEventListener('click', applyCoordinates);
  revertButton.addEventListener('click', revertRecord);
  clearButton.addEventListener('click', clearCoordinates);
  nextButton.addEventListener('click', nextUnmapped);
  downloadButton.addEventListener('click', downloadJson);

  fetch('MineSites_20230622.json')
    .then(function (response) {
      if (!response.ok) throw new Error('The mine dataset could not be loaded.');
      return response.json();
    })
    .then(function (data) {
      dataset = data;
      originalDataset = JSON.parse(JSON.stringify(data));
      populateCounties();
      updateChangeSummary();
      status.textContent = 'Dataset loaded. Choose a record to begin.';
    })
    .catch(function (error) {
      status.textContent = error.message;
      selectedName.textContent = 'Dataset unavailable';
      applyButton.disabled = true;
      clearButton.disabled = true;
      revertButton.disabled = true;
    });
}());
