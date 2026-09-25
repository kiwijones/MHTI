(function () {
  'use strict';

  const IRELAND_BOUNDS = [[50, -11.5], [56.5, -5]];
  const DEFAULT_VIEW = [53.35, -8.1];
  const countySelect = document.getElementById('editor-county');
  const mineSelect = document.getElementById('editor-mine');
  const targetSelect = document.getElementById('editor-target');
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
  const savePrimaryButton = document.getElementById('save-primary-json');
  const changeCount = document.getElementById('change-count');
  const status = document.getElementById('editor-status');
  const placeSearchForm = document.getElementById('place-search-form');
  const placeSearchInput = document.getElementById('place-search-input');
  const placeSearchButton = document.getElementById('place-search-button');
  const placeSearchResults = document.getElementById('place-search-results');
  const addRecordForm = document.getElementById('add-record-form');
  const addRecordType = document.getElementById('add-record-type');
  const addRecordName = document.getElementById('add-record-name');
  const addRecordUrl = document.getElementById('add-record-url');
  const editRecordForm = document.getElementById('edit-record-form');
  const editRecordName = document.getElementById('edit-record-name');
  const editRecordUrl = document.getElementById('edit-record-url');
  const removeRecordButton = document.getElementById('remove-record');

  const map = L.map('coordinate-map', { minZoom: 6, maxZoom: 19, maxBounds: [[49.5, -13], [57.2, -3.5]] }).setView(DEFAULT_VIEW, 7);
  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
  streetLayer.addTo(map);
  L.control.layers({
    Map: streetLayer,
    Satellite: satelliteLayer
  }, null, { collapsed: false, position: 'topright' }).addTo(map);

  let dataset = [];
  let originalDataset = [];
  let marker = null;
  let primaryFileHandle = null;
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

  function selectedTargetRecord() {
    const mine = selectedMineRecord();
    if (!mine) return null;
    if (targetSelect.value === 'mine') return mine;
    const match = /^site:(\d+)$/.exec(targetSelect.value);
    return match && mine.sites ? mine.sites[Number(match[1])] : null;
  }

  function recordKey() {
    return countySelect.value + ':' + mineSelect.value + ':' + targetSelect.value;
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
    savePrimaryButton.disabled = count === 0;
  }

  function updateRecordPanel() {
    const county = selectedCountyRecord();
    const mine = selectedMineRecord();
    const record = selectedTargetRecord();
    if (!county || !mine || !record) return;
    const isMine = targetSelect.value === 'mine';
    selectedName.textContent = cleanText(isMine ? mine.Mine : (record.minesite || record.Mine || record.name)) || 'Unnamed location';
    selectedCounty.textContent = (isMine ? 'Mine or mining area' : 'Associated working of ' + cleanText(mine.Mine)) + ' · County ' + cleanText(county.county);
    editRecordName.value = cleanText(isMine ? mine.Mine : (record.minesite || record.Mine || record.name));
    editRecordUrl.value = cleanText(record.url);
    sitesList.replaceChildren();
    const sites = mine.sites || [];
    if (sites.length) {
      sites.forEach(function (site, index) {
        const item = document.createElement('li');
        item.textContent = (hasMappedPosition(site) ? '● ' : '○ ') + cleanText(site.minesite || site.Mine || site.name);
        if (targetSelect.value === 'site:' + index) item.className = 'selected-site';
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
      const parentPosition = !isMine && mine.Position;
      const countyPosition = county.Position;
      if (parentPosition && validCoordinates(Number(parentPosition.Latitude), Number(parentPosition.Longitude))) {
        map.setView([Number(parentPosition.Latitude), Number(parentPosition.Longitude)], 12);
      } else if (countyPosition && validCoordinates(Number(countyPosition.Latitude), Number(countyPosition.Longitude))) {
        map.setView([Number(countyPosition.Latitude), Number(countyPosition.Longitude)], 9);
      } else {
        map.setView(DEFAULT_VIEW, 7);
      }
    }
    status.textContent = 'Click the map, drag the marker, or enter exact decimal coordinates.';
  }

  function populateTargets(preferredValue) {
    const mine = selectedMineRecord();
    targetSelect.replaceChildren();
    if (!mine) return;
    const mineOption = document.createElement('option');
    mineOption.value = 'mine';
    mineOption.textContent = (hasMappedPosition(mine) ? '● ' : '○ ') + 'Main location — ' + cleanText(mine.Mine);
    targetSelect.appendChild(mineOption);
    (mine.sites || []).forEach(function (site, index) {
      const option = document.createElement('option');
      option.value = 'site:' + index;
      option.textContent = (hasMappedPosition(site) ? '● ' : '○ ') + 'Working — ' + cleanText(site.minesite || site.Mine || site.name);
      targetSelect.appendChild(option);
    });
    targetSelect.value = preferredValue && [...targetSelect.options].some(function (option) { return option.value === preferredValue; }) ? preferredValue : 'mine';
    updateRecordPanel();
  }

  function populateMines(preferredIndex, preferredTarget) {
    const county = selectedCountyRecord();
    mineSelect.replaceChildren();
    (county.location || []).forEach(function (record, index) {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = (hasMappedPosition(record) ? '● ' : '○ ') + cleanText(record.Mine);
      mineSelect.appendChild(option);
    });
    mineSelect.value = String(Math.min(preferredIndex || 0, Math.max(mineSelect.options.length - 1, 0)));
    populateTargets(preferredTarget || 'mine');
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
    const record = selectedTargetRecord();
    record.Position = { Latitude: Number(lat.toFixed(7)), Longitude: Number(lng.toFixed(7)) };
    record.Data = Object.assign({}, record.Data, {
      coordinateStatus: 'verified-user',
      verifiedAt: new Date().toISOString()
    });
    changes.add(recordKey());
    setDraftPosition(lat, lng, true);
    populateTargets(targetSelect.value);
    coordinateState.className = 'coordinate-state verified';
    coordinateState.textContent = 'Verified coordinate';
    status.textContent = 'Verified coordinates applied to the working copy.';
    updateChangeSummary();
  }

  function duplicateName(records, name, currentRecord) {
    const normalized = cleanText(name).toLocaleLowerCase('en-IE');
    return records.some(function (record) {
      const recordName = cleanText(record.Mine || record.minesite || record.name).toLocaleLowerCase('en-IE');
      return record !== currentRecord && recordName === normalized;
    });
  }

  function addRecord(event) {
    event.preventDefault();
    const county = selectedCountyRecord();
    const mine = selectedMineRecord();
    const name = cleanText(addRecordName.value);
    const url = cleanText(addRecordUrl.value);
    if (!name) {
      status.textContent = 'Enter a name for the new record.';
      addRecordName.focus();
      return;
    }
    if (addRecordType.value === 'mine') {
      if (duplicateName(county.location || [], name, null)) {
        status.textContent = 'A mine or mining area with that name already exists in this county.';
        return;
      }
      county.location = county.location || [];
      county.location.push({
        Mine: name,
        url: url,
        images: [],
        sites: [],
        Position: { Latitude: null, Longitude: null }
      });
      const newMineIndex = county.location.length - 1;
      populateMines(newMineIndex, 'mine');
      changes.add(recordKey());
      status.textContent = name + ' was added as an unmapped mine. Position it, then save the dataset.';
    } else {
      mine.sites = mine.sites || [];
      if (duplicateName(mine.sites, name, null)) {
        status.textContent = 'An associated working with that name already exists under this mine.';
        return;
      }
      mine.sites.push({
        minesite: name,
        url: url,
        Position: { Latitude: null, Longitude: null }
      });
      const targetValue = 'site:' + (mine.sites.length - 1);
      populateTargets(targetValue);
      changes.add(recordKey());
      status.textContent = name + ' was added under ' + cleanText(mine.Mine) + '. Position it, then save the dataset.';
    }
    addRecordForm.reset();
    updateChangeSummary();
  }

  function updateSelectedRecord(event) {
    event.preventDefault();
    const mine = selectedMineRecord();
    const record = selectedTargetRecord();
    const targetValue = targetSelect.value;
    const name = cleanText(editRecordName.value);
    if (!record || !name) {
      status.textContent = 'The selected record must have a name.';
      editRecordName.focus();
      return;
    }
    const siblings = targetValue === 'mine' ? selectedCountyRecord().location : mine.sites;
    if (duplicateName(siblings, name, record)) {
      status.textContent = 'Another record with that name already exists here.';
      return;
    }
    if (targetValue === 'mine') record.Mine = name;
    else record.minesite = name;
    record.url = cleanText(editRecordUrl.value);
    changes.add(recordKey());
    populateMines(Number(mineSelect.value), targetValue);
    status.textContent = 'The selected record details were updated in the working copy.';
    updateChangeSummary();
  }

  function removeSelectedRecord() {
    const county = selectedCountyRecord();
    const mine = selectedMineRecord();
    const record = selectedTargetRecord();
    const targetValue = targetSelect.value;
    if (!county || !mine || !record) return;
    const name = cleanText(targetValue === 'mine' ? mine.Mine : (record.minesite || record.Mine || record.name));
    const detail = targetValue === 'mine' && (mine.sites || []).length ? ' This also removes its associated workings.' : '';
    if (!window.confirm('Remove “' + name + '” from the working copy?' + detail)) return;
    if (targetValue === 'mine') {
      const mineIndex = Number(mineSelect.value);
      county.location.splice(mineIndex, 1);
      changes.add('removed:' + countySelect.value + ':' + name);
      populateMines(Math.max(0, mineIndex - 1), 'mine');
    } else {
      const siteIndex = Number(targetValue.split(':')[1]);
      mine.sites.splice(siteIndex, 1);
      changes.add('removed:' + countySelect.value + ':' + mineSelect.value + ':' + name);
      populateTargets('mine');
    }
    status.textContent = name + ' was removed from the working copy. Save the dataset to make this permanent.';
    updateChangeSummary();
  }

  function revertRecord() {
    const countyIndex = Number(countySelect.value);
    const mineIndex = Number(mineSelect.value);
    const targetValue = targetSelect.value;
    const originalMine = originalDataset[countyIndex] && originalDataset[countyIndex].location[mineIndex];
    if (!originalMine) {
      const name = cleanText(dataset[countyIndex].location[mineIndex].Mine);
      dataset[countyIndex].location.splice(mineIndex, 1);
      changes.delete(recordKey());
      populateMines(Math.max(0, mineIndex - 1), 'mine');
      status.textContent = 'The newly added record ' + name + ' was discarded.';
      updateChangeSummary();
      return;
    }
    if (targetValue === 'mine') {
      const current = dataset[countyIndex].location[mineIndex];
      const original = originalMine;
      current.Position = JSON.parse(JSON.stringify(original.Position || { Latitude: null, Longitude: null }));
      if (original.Data) current.Data = JSON.parse(JSON.stringify(original.Data));
      else delete current.Data;
    } else {
      const siteIndex = Number(targetValue.split(':')[1]);
      const originalSite = (originalMine.sites || [])[siteIndex];
      if (!originalSite) {
        dataset[countyIndex].location[mineIndex].sites.splice(siteIndex, 1);
        changes.delete(recordKey());
        populateMines(mineIndex, 'mine');
        status.textContent = 'The newly added associated working was discarded.';
        updateChangeSummary();
        return;
      }
      dataset[countyIndex].location[mineIndex].sites[siteIndex] = JSON.parse(JSON.stringify(originalSite));
    }
    changes.delete(recordKey());
    populateMines(mineIndex, targetValue);
    status.textContent = 'This record was restored to its original value.';
    updateChangeSummary();
  }

  function clearCoordinates() {
    const targetValue = targetSelect.value;
    const record = selectedTargetRecord();
    record.Position = { Latitude: null, Longitude: null };
    record.Data = Object.assign({}, record.Data, { coordinateStatus: 'unmapped-user' });
    delete record.Data.verifiedAt;
    changes.add(recordKey());
    populateTargets(targetValue);
    status.textContent = 'The record is marked as unmapped in the working copy.';
    updateChangeSummary();
  }

  function nextUnmapped() {
    const targets = [];
    dataset.forEach(function (county, countyIndex) {
      (county.location || []).forEach(function (mine, mineIndex) {
        targets.push({ countyIndex, mineIndex, target: 'mine', record: mine });
        (mine.sites || []).forEach(function (site, siteIndex) {
          targets.push({ countyIndex, mineIndex, target: 'site:' + siteIndex, record: site });
        });
      });
    });
    const currentKey = recordKey();
    const currentIndex = targets.findIndex(function (item) {
      return item.countyIndex + ':' + item.mineIndex + ':' + item.target === currentKey;
    });
    for (let index = currentIndex + 1; index < targets.length; index += 1) {
      const item = targets[index];
      if (!hasMappedPosition(item.record)) {
        countySelect.value = String(item.countyIndex);
        populateMines(item.mineIndex, item.target);
        return;
      }
    }
    status.textContent = 'No later unmapped records were found. Choose a county to continue reviewing.';
  }

  function showPlaceResults(results) {
    placeSearchResults.replaceChildren();
    if (!results.length) {
      placeSearchResults.textContent = 'No matching places found in Ireland. Try a nearby town or a broader name.';
      return;
    }
    const list = document.createElement('ul');
    results.forEach(function (result) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = result.display_name;
      button.addEventListener('click', function () {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!validCoordinates(lat, lng)) return;
        setDraftPosition(lat, lng, true);
        placeSearchResults.replaceChildren();
        status.textContent = 'Place found: ' + result.display_name + '. Adjust the marker if needed, then apply the coordinates.';
      });
      item.appendChild(button);
      list.appendChild(item);
    });
    placeSearchResults.appendChild(list);
  }

  function searchPlaces(event) {
    event.preventDefault();
    const query = cleanText(placeSearchInput.value);
    if (query.length < 2) {
      placeSearchResults.textContent = 'Enter at least two characters to search.';
      placeSearchInput.focus();
      return;
    }
    placeSearchButton.disabled = true;
    placeSearchButton.textContent = 'Searching…';
    placeSearchResults.textContent = 'Searching for places in Ireland…';
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ie&limit=6&q=' + encodeURIComponent(query);
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('Place search is temporarily unavailable.');
        return response.json();
      })
      .then(showPlaceResults)
      .catch(function (error) { placeSearchResults.textContent = error.message; })
      .finally(function () {
        placeSearchButton.disabled = false;
        placeSearchButton.textContent = 'Search map';
      });
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

  function serializedDataset() {
    return JSON.stringify(dataset, null, 2) + '\n';
  }

  async function savePrimaryJson() {
    if (!window.showSaveFilePicker) {
      status.textContent = 'Direct file saving is unavailable in this browser. Use Download a copy instead.';
      return;
    }
    try {
      if (!primaryFileHandle) {
        primaryFileHandle = await window.showSaveFilePicker({
          suggestedName: 'MineSites_20230622.json',
          types: [{
            description: 'JSON dataset',
            accept: { 'application/json': ['.json'] }
          }]
        });
      }
      const writable = await primaryFileHandle.createWritable();
      await writable.write(serializedDataset());
      await writable.close();
      status.textContent = 'Primary dataset saved. Refresh the public map to see the changes.';
    } catch (error) {
      if (error && error.name === 'AbortError') {
        status.textContent = 'Save cancelled; the working copy is unchanged.';
      } else {
        primaryFileHandle = null;
        status.textContent = 'The dataset could not be saved directly. Use Download a copy instead.';
      }
    }
  }

  map.on('click', function (event) {
    setDraftPosition(event.latlng.lat, event.latlng.lng, false);
    status.textContent = 'Map position selected. Apply the coordinates to keep this change.';
  });
  countySelect.addEventListener('change', function () { populateMines(0); });
  mineSelect.addEventListener('change', function () { populateTargets('mine'); });
  targetSelect.addEventListener('change', updateRecordPanel);
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
  savePrimaryButton.addEventListener('click', savePrimaryJson);
  placeSearchForm.addEventListener('submit', searchPlaces);
  addRecordForm.addEventListener('submit', addRecord);
  editRecordForm.addEventListener('submit', updateSelectedRecord);
  removeRecordButton.addEventListener('click', removeSelectedRecord);

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
