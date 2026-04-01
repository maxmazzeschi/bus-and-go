let map;
let vehicleMarkers = {};
let vehicleLabels = {};
let stopsMarkers = []; // Changed to a list
let updateInterval = 30; // Update every 30 seconds
let remainingTime = updateInterval;
let timerInterval;
let StopsData = [];
let mobileRouteDialValue = '';

// Storage keys
const STORAGE_KEYS = {
  COUNTRY: 'selected_country',
  CITY: 'selected_city',
  ROUTES: 'selected_routes'
};

function isMobileLayout() {
  return document.body?.dataset?.uiMode === 'mobile';
}

function getSelectedLabelText(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const checkedInput = container.querySelector('input[type="checkbox"]:checked');
  if (!checkedInput) return null;

  return checkedInput.parentElement.textContent.trim();
}

function getSelectedRoutesCount() {
  return document.querySelectorAll('#routeSelector input[type="checkbox"]:checked').length;
}

function getRouteCheckboxes() {
  return Array.from(document.querySelectorAll('#routeSelector input[type="checkbox"]'));
}

function getVisibleRouteLabels() {
  return Array.from(document.querySelectorAll('#routeSelector .route-option')).filter((label) => {
    return label.style.display !== 'none';
  });
}

function getRouteDialDisplayElement() {
  return document.getElementById('routeDialDisplay');
}

function setDropdownButtonText(containerId, text) {
  const container = document.getElementById(containerId);
  const dropdown = container ? container.closest('.dropdown') : null;
  const button = dropdown ? dropdown.querySelector('button') : null;

  if (button) {
    button.textContent = text;
  }
}

function syncDropdownButtonLabels() {
  const selectedCountry = getSelectedLabelText('countrySelector');
  const selectedCity = getSelectedLabelText('citySelector');
  const selectedRoutesCount = getSelectedRoutesCount();

  setDropdownButtonText('countrySelector', selectedCountry ? `Country: ${selectedCountry}` : 'Country');
  setDropdownButtonText('citySelector', selectedCity ? `City: ${selectedCity}` : 'City');
  setDropdownButtonText(
    'routeSelector',
    selectedRoutesCount > 0 ? `Routes: ${selectedRoutesCount} selected` : 'All routes'
  );
}

function updateSelectionSummary() {
  const summaryElement = document.getElementById('selectionSummary');
  if (!summaryElement) return;

  const selectedCountry = getSelectedLabelText('countrySelector');
  const selectedCity = getSelectedLabelText('citySelector');
  const selectedRoutesCount = getSelectedRoutesCount();

  if (!selectedCountry && !selectedCity) {
    summaryElement.textContent = 'Choose a country and city to start.';
    return;
  }

  const summaryParts = [];
  if (selectedCountry) summaryParts.push(selectedCountry);
  if (selectedCity) summaryParts.push(selectedCity);
  summaryParts.push(
    selectedRoutesCount > 0 ? `${selectedRoutesCount} routes selected` : 'All routes'
  );

  summaryElement.textContent = summaryParts.join(' • ');
}

function syncSelectionUi() {
  syncDropdownButtonLabels();
  updateSelectionSummary();
  updateRouteSelectionMeta();
}

function updateRouteSelectionMeta() {
  const metaElement = document.getElementById('routeSelectionMeta');
  if (!metaElement) return;

  const totalRoutes = getRouteCheckboxes().length;
  const selectedRoutes = getSelectedRoutesCount();
  const visibleRoutes = getVisibleRouteLabels().length;
  const dialSuffix = isMobileLayout() && mobileRouteDialValue
    ? ` • dial ${mobileRouteDialValue}`
    : '';

  metaElement.textContent = `${selectedRoutes} selected • ${visibleRoutes} visible • ${totalRoutes} total${dialSuffix}`;
}

function filterMobileRouteOptions() {
  const query = mobileRouteDialValue.trim().toLowerCase();
  const routeLabels = Array.from(document.querySelectorAll('#routeSelector .route-option'));

  routeLabels.forEach((label) => {
    const routeId = label.dataset.routeId || label.textContent.trim();
    const matches = query === '' || routeId.toLowerCase().startsWith(query);
    label.style.display = matches ? 'flex' : 'none';
  });

  updateRouteSelectionMeta();
}

function renderMobileRouteDialValue() {
  const displayElement = getRouteDialDisplayElement();
  if (!displayElement) return;

  if (mobileRouteDialValue) {
    displayElement.textContent = mobileRouteDialValue;
    displayElement.classList.add('route-dial-active');
  } else {
    displayElement.textContent = 'Tap digits';
    displayElement.classList.remove('route-dial-active');
  }
}

function appendRouteDialDigit(digit) {
  mobileRouteDialValue += String(digit);
  renderMobileRouteDialValue();
  filterMobileRouteOptions();
}

function backspaceRouteDial() {
  mobileRouteDialValue = mobileRouteDialValue.slice(0, -1);
  renderMobileRouteDialValue();
  filterMobileRouteOptions();
}

function clearRouteDial() {
  mobileRouteDialValue = '';
  renderMobileRouteDialValue();
  filterMobileRouteOptions();
}

function clearAllRouteSelections() {
  getRouteCheckboxes().forEach((checkbox) => {
    checkbox.checked = false;
  });

  saveRouteSelections();
  updateVehiclePositions();
}

function setRoutePickerOpenState(isOpen) {
  const controls = document.getElementById('controls');
  if (!controls || !isMobileLayout()) return;

  controls.classList.toggle('route-picker-open', isOpen);
}

function closeAllDropdowns() {
  const dropdownContainers = document.querySelectorAll('.dropdown');
  dropdownContainers.forEach((dropdown) => {
    dropdown.classList.remove('dropdown-open');
  });

  setRoutePickerOpenState(false);

  const dropdowns = document.querySelectorAll('.dropdown-content');
  dropdowns.forEach((dropdown) => {
    dropdown.style.display = 'none';
  });
}

function setMapInteractionEnabled(enabled) {
  if (!map) return;

  if (enabled) {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
    return;
  }

  map.dragging.disable();
  map.scrollWheelZoom.disable();
  map.touchZoom.disable();
}

function updateMobileControlsButton() {
  const button = document.getElementById('mobileFiltersBtn');
  const controls = document.getElementById('controls');
  if (!button || !controls) return;

  button.textContent = controls.classList.contains('collapsed') ? 'Filters' : 'Close';
}

function closeControlsPanel() {
  const controls = document.getElementById('controls');
  const icon = document.getElementById('controls-icon');
  if (!controls || controls.classList.contains('collapsed')) return;

  controls.classList.add('collapsed');
  controls.classList.remove('expanded');
  if (icon) {
    icon.textContent = '▲';
  }

  closeAllDropdowns();
  setMapInteractionEnabled(true);
  localStorage.setItem('controlsExpanded', 'false');
  updateMobileControlsButton();
}

// Initialize the map
function initializeMap() {
  map = L.map("map");

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 14);
      },
      () => {
        map.setView([41.9028, 12.4964], 12);
      }
    );
  } else {
    map.setView([41.9028, 12.4964], 12);
  }

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  map.on("moveend", updateVehiclePositions);

  // Add a timer display to the map
  const timerDiv = L.control({ position: "topright" });
  timerDiv.onAdd = () => {
    const div = L.DomUtil.create("div", "timer");
    div.innerHTML = `Next update in: ${remainingTime}s`;
    return div;
  };
  timerDiv.addTo(map);

  // Update every 60 seconds
  setInterval(updateVehiclePositions, updateInterval * 1000);
  startTimer();
}

// Start the update timer
function startTimer() {
  remainingTime = updateInterval;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    remainingTime--;
    const timerElement = document.querySelector(".timer");
    if (timerElement) {
      timerElement.innerHTML = `Next update in: ${remainingTime}s`;
    }
    if (remainingTime <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// Check if the map is initialized
function isMapInitialized() {
  return map && map._loaded && map.getCenter() && map.getZoom() !== undefined;
}

// Update vehicle positions
function updateVehiclePositions() {
  if (!isMapInitialized()) return;

  const zoom = map.getZoom();
  console.log("Zoom level: " + zoom);

  let drawStopMarkers = zoom >= 14 && !isMobileLayout();

  if (!drawStopMarkers) {
    console.log("Zoom level is too low, removing stop markers");
    stopsMarkers.forEach((stopMarker) => map.removeLayer(stopMarker));
    stopsMarkers = [];
  }

  console.log("Updating vehicle positions");
  const bounds = map.getBounds();
  const selectedRoutes = Array.from(
    document.querySelectorAll('#routeSelector input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);

  const datasetId = getCurrentCity();
  if (!datasetId) return;

  const params = new URLSearchParams({
    datasetId,
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    routes: selectedRoutes.join(","),
  });

  if (drawStopMarkers) {
    fetch(`/get_stops_info?${params}`)
      .then((response) => response.json())
      .then((stops_data) => {
        // Remove previous stops
        stopsMarkers.forEach((stopMarker) => map.removeLayer(stopMarker));
        stopsMarkers = [];

        // Create a flag-like marker using SVG
        const flagHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <polygon points="2,0 24,6 2,12" fill="#000000" />
            <line x1="0" y1="0" x2="0" y2="24" stroke="#000000" stroke-width="2"/>
          </svg>
        `;

        StopsData = stops_data;
        stops_data.forEach((stop) => {
          const { stop_id, lat, lon } = stop;

          const flagIcon = L.divIcon({
            className: "stop-flag-icon",
            html: flagHtml,
            iconSize: [24, 24],
            iconAnchor: [2, 12], // Anchor the flag's pole to the location
          });

          // Add the flag marker to the map
          const stopMarker = L.marker([lat, lon], { icon: flagIcon }).addTo(map);

          // Add hover events to the stopMarker
          stopMarker.on("mouseover", () => onStopHover(stop_id));
          stopMarker.on("mouseout", onStopMouseOut);

          stopsMarkers.push(stopMarker);
        });
      });
  }

  fetch(`/get_vehicles_position?${params}`)
    .then((response) => response.json())
    .then((data) => {
      // Remove previous markers
      Object.values(vehicleMarkers).forEach((marker) => map.removeLayer(marker));
      Object.values(vehicleLabels).forEach((label) => map.removeLayer(label));

      if (data.length === 0) return;

      vehicleMarkers = {};
      vehicleLabels = {};

      data.vehicles.forEach((vehicle) => {
        const {
          lat,
          lon,
          route_id,
          bearing,
          speed,
          vehicle_id,
          last_stop_name,
        } = vehicle;

        const roundedSpeed = Math.round(speed);
        const label = L.divIcon({
          className: '',
          html: `<div class="vehicle-label">${route_id} ${last_stop_name} ${roundedSpeed > 0 ? `@${roundedSpeed} Km/h` : ""}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const labelMarker = L.marker([lat, lon], { icon: label }).addTo(map);

        const tooltipContent = last_stop_name
          ? `Last Stop: ${last_stop_name}`
          : 'Last Stop: Unknown';

        if (bearing > 0) {
          const arrowHtml = `
            <svg class="arrow-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" style="transform: rotate(${Math.round(bearing)}deg);">
              <polygon points="12,2 22,22 12,17 2,22" />
            </svg>
          `;

          const arrow = L.divIcon({
            className: "arrow-icon",
            html: arrowHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const arrowMarker = L.marker([lat, lon], { icon: arrow }).addTo(map);
          
          // Add tooltip to arrow marker
          arrowMarker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -15],
            className: 'vehicle-tooltip'
          });
          
          vehicleMarkers[vehicle_id] = arrowMarker;
        } else {
          const marker = L.circleMarker([lat, lon], {
            radius: 8,
            color: "#ff5722",
            fillColor: "#ff5722",
            fillOpacity: 0.7,
          }).addTo(map);
          
          // Add tooltip to circle marker
          marker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -15],
            className: 'vehicle-tooltip'
          });
          
          vehicleMarkers[vehicle_id] = marker;
        }

        // Add tooltip to label marker as well
        labelMarker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -25],
          className: 'vehicle-tooltip'
        });

        vehicleLabels[vehicle_id] = labelMarker;
      });

      startTimer();
    });
}

// Hover events for stops
function onStopHover(stop_id_) {
  map.closePopup();

  StopsData.forEach((stop) => {
    const { lat, lon, stop_id, stop_name } = stop;
    if (stop_id_ === stop_id) {
      const popup = L.popup()
        .setLatLng([lat, lon])
        .setContent(`Stop: ${stop_name}`)
        .openOn(map);
    }
  });
}

function onStopMouseOut() {
  map.closePopup();
}

// Save selection to localStorage
function saveSelection(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save selection to localStorage:', error);
  }
}

// Load selection from localStorage
function loadSelection(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('Failed to load selection from localStorage:', error);
    return null;
  }
}

// Restore saved selections
function restoreSelections() {
  // Restore country selection
  const savedCountry = loadSelection(STORAGE_KEYS.COUNTRY);
  if (savedCountry) {
    setTimeout(() => {
      const countryCheckbox = document.querySelector(`#countrySelector input[value="${savedCountry}"]`);
      if (countryCheckbox) {
        countryCheckbox.checked = true;
        syncSelectionUi();
        fetchAvailableCities();
      }
    }, 100);
  }

  // Restore city selection after countries are loaded
  const savedCity = loadSelection(STORAGE_KEYS.CITY);
  if (savedCity) {
    setTimeout(() => {
      const cityCheckbox = document.querySelector(`#citySelector input[value="${savedCity}"]`);
      if (cityCheckbox) {
        cityCheckbox.checked = true;
        syncSelectionUi();
        fetchAvailableRoutes();
      }
    }, 500);
  }

  // Restore route selections after routes are loaded
  const savedRoutes = loadSelection(STORAGE_KEYS.ROUTES);
  if (savedRoutes && Array.isArray(savedRoutes)) {
    setTimeout(() => {
      savedRoutes.forEach(routeId => {
        const routeCheckbox = document.querySelector(`#routeSelector input[value="${routeId}"]`);
        if (routeCheckbox) {
          routeCheckbox.checked = true;
        }
      });
      syncSelectionUi();
      updateVehiclePositions();
    }, 1000);
  }
}

// Updated country selected event
function countrySelected(event) {
  if (!event.target.checked) return;

  const countrySelector = document.getElementById("countrySelector");
  const checkboxes = countrySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && checkbox !== event.target) {
      checkbox.checked = false;
    }
  });

  // Save country selection
  saveSelection(STORAGE_KEYS.COUNTRY, event.target.value);
  
  // Clear city and route selections when country changes
  saveSelection(STORAGE_KEYS.CITY, null);
  saveSelection(STORAGE_KEYS.ROUTES, []);
  syncSelectionUi();
}

// Updated city selected event
function citySelected(event) {
  if (!event.target.checked) return;

  const citySelector = document.getElementById("citySelector");
  const checkboxes = citySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && checkbox !== event.target) {
      checkbox.checked = false;
    }
  });

  // Save city selection
  saveSelection(STORAGE_KEYS.CITY, event.target.value);
  
  // Clear route selections when city changes
  saveSelection(STORAGE_KEYS.ROUTES, []);
  syncSelectionUi();
}

// Updated route selector population with event listeners
function populateRouteSelector(routeIds) {
  const routeSelector = document.getElementById("routeSelector");
  routeSelector.innerHTML = "";

  let routeList = routeSelector;
  if (isMobileLayout()) {
    mobileRouteDialValue = '';
    routeSelector.innerHTML = `
      <div id="routeSelectorList" class="route-options-list"></div>
      <div class="route-tools">
        <div id="routeSelectionMeta" class="route-selection-meta">0 selected • 0 visible • 0 total</div>
        <div class="route-dial-block">
          <div class="route-dial-label">Dial route number</div>
          <div id="routeDialDisplay" class="route-dial-display">Tap digits</div>
        </div>
        <div class="route-dialpad">
          <button type="button" class="route-digit-btn" data-route-digit="1">1</button>
          <button type="button" class="route-digit-btn" data-route-digit="2">2</button>
          <button type="button" class="route-digit-btn" data-route-digit="3">3</button>
          <button type="button" class="route-digit-btn" data-route-digit="4">4</button>
          <button type="button" class="route-digit-btn" data-route-digit="5">5</button>
          <button type="button" class="route-digit-btn" data-route-digit="6">6</button>
          <button type="button" class="route-digit-btn" data-route-digit="7">7</button>
          <button type="button" class="route-digit-btn" data-route-digit="8">8</button>
          <button type="button" class="route-digit-btn" data-route-digit="9">9</button>
          <button type="button" class="route-digit-btn route-digit-action" data-route-action="backspace">⌫</button>
          <button type="button" class="route-digit-btn" data-route-digit="0">0</button>
          <button type="button" class="route-digit-btn route-digit-action" data-route-action="reset-dial">C</button>
        </div>
        <div class="route-actions">
          <button type="button" class="route-action-btn" data-route-action="clear-all">Clear selected</button>
          <button type="button" class="route-action-btn route-action-secondary" data-route-action="reset-dial">Reset dial</button>
        </div>
      </div>
    `;

    routeList = document.getElementById('routeSelectorList');
    const actionButtons = routeSelector.querySelectorAll('[data-route-action]');
    const digitButtons = routeSelector.querySelectorAll('[data-route-digit]');

    actionButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = button.dataset.routeAction;
        if (action === 'backspace') {
          backspaceRouteDial();
        } else if (action === 'reset-dial') {
          clearRouteDial();
        } else if (action === 'clear-all') {
          clearAllRouteSelections();
        }
      });
    });

    digitButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        appendRouteDialDigit(button.dataset.routeDigit);
      });
    });

    renderMobileRouteDialValue();
  }

  routeIds.sort(compareRouteId).forEach((routeId) => {
    const label = document.createElement("label");
    label.className = 'route-option';
    label.dataset.routeId = routeId;
    label.innerHTML = `
      <input type="checkbox" value="${routeId}" />
      ${routeId}
    `;
    
    // Add event listener to save route selection
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', saveRouteSelections);
    
    routeList.appendChild(label);
  });

  if (isMobileLayout()) {
    filterMobileRouteOptions();
  }

  syncSelectionUi();
}

// Save route selections
function saveRouteSelections() {
  const selectedRoutes = Array.from(
    document.querySelectorAll('#routeSelector input[type="checkbox"]:checked')
  ).map((checkbox) => checkbox.value);
  
  saveSelection(STORAGE_KEYS.ROUTES, selectedRoutes);
  syncSelectionUi();
}

// Open vehicle statistics popup
function openVehicleStatsPopup() {
  const datasetId = getCurrentCity();
  if (!datasetId) {
    alert('Please select a city first');
    return;
  }

  // Get all vehicles without route filtering
  const params = new URLSearchParams({
    datasetId,
    north: 90,
    south: -90,
    east: 180,
    west: -180,
    routes: '', // Empty to get all routes
  });

  fetch(`/get_vehicles_position?${params}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.vehicles || data.vehicles.length === 0) {
        alert('No vehicle data available');
        return;
      }

      // Count vehicles by route_id
      const routeCounts = {};
      data.vehicles.forEach((vehicle) => {
        const routeId = vehicle.route_id;
        routeCounts[routeId] = (routeCounts[routeId] || 0) + 1;
      });

      // Sort route IDs
      const sortedRoutes = Object.keys(routeCounts).sort(compareRouteId);

      // Create popup content
      const popupContent = createVehicleStatsGrid(sortedRoutes, routeCounts);
      
      // Show popup
      showVehicleStatsPopup(popupContent);
    })
    .catch((error) => {
      console.error('Error fetching vehicle data:', error);
      alert('Error fetching vehicle data');
    });
}

// Create the grid content for vehicle statistics
function createVehicleStatsGrid(sortedRoutes, routeCounts) {
  let gridHTML = `
    <div class="vehicle-stats-container">
      <h3>Vehicle Count by Route</h3>
      <div class="vehicle-stats-grid">
        <div class="grid-header">
          <div class="grid-cell"><strong>Route ID</strong></div>
          <div class="grid-cell"><strong>Vehicle Count</strong></div>
        </div>
  `;

  sortedRoutes.forEach((routeId) => {
    gridHTML += `
      <div class="grid-row">
        <div class="grid-cell">${routeId}</div>
        <div class="grid-cell">${routeCounts[routeId]}</div>
      </div>
    `;
  });

  gridHTML += `
      </div>
      <div class="stats-summary">
        <p><strong>Total Routes:</strong> ${sortedRoutes.length}</p>
        <p><strong>Total Vehicles:</strong> ${Object.values(routeCounts).reduce((sum, count) => sum + count, 0)}</p>
      </div>
      <button onclick="closeVehicleStatsPopup()" class="close-btn">Close</button>
    </div>
  `;

  return gridHTML;
}

// Show the vehicle statistics popup
function showVehicleStatsPopup(content) {
  closeVehicleStatsPopup();
  
  const overlay = document.createElement('div');
  overlay.id = 'vehicleStatsOverlay';
  overlay.className = 'popup-overlay';
  overlay.innerHTML = content;
  
  // Prevent map interaction when touching popup content
  overlay.addEventListener('touchstart', function(e) {
    e.stopPropagation();
  });
  
  overlay.addEventListener('touchmove', function(e) {
    e.stopPropagation();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeVehicleStatsPopup();
    }
  });
  
  document.body.classList.add('popup-open');
  document.body.appendChild(overlay);
  
  // Disable map interaction when popup is open
  if (map) {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.touchZoom.disable();
  }
}

function closeVehicleStatsPopup() {
  const overlay = document.getElementById('vehicleStatsOverlay');
  if (overlay) {
    overlay.remove();
  }
  document.body.classList.remove('popup-open');
  
  // Re-enable map interaction when popup closes
  if (map) {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
  }
}

// Toggle controls visibility
function toggleControls() {
  const controls = document.getElementById('controls');
  const icon = document.getElementById('controls-icon');
  if (!controls) return;
  
  if (controls.classList.contains('collapsed')) {
    controls.classList.remove('collapsed');
    controls.classList.add('expanded');
    if (icon) {
      icon.textContent = '▼';
    }
    
    // Save state
    localStorage.setItem('controlsExpanded', 'true');
  } else {
    closeControlsPanel();
    return;
  }

  updateMobileControlsButton();
}

// Initialize controls state
function initializeControlsState() {
  const controls = document.getElementById('controls');
  const icon = document.getElementById('controls-icon');
  const savedState = localStorage.getItem('controlsExpanded');
  if (!controls) return;
  
  if (savedState === 'false' || (savedState === null && isMobileLayout())) {
    controls.classList.add('collapsed');
    controls.classList.remove('expanded');
    if (icon) {
      icon.textContent = '▲';
    }
  } else {
    controls.classList.add('expanded');
    controls.classList.remove('collapsed');
    if (icon) {
      icon.textContent = '▼';
    }
  }

  updateMobileControlsButton();
}

// Main window load
window.onload = () => {
  initializeMap();
  initializeControlsState(); // Add this line
  fetchAvailableCountries();
  document
    .getElementById("routeSelector")
    .addEventListener("change", updateVehiclePositions);
  syncSelectionUi();
  
  // Restore saved selections after a short delay to ensure DOM is ready
  setTimeout(restoreSelections, 200);
};

// Compare route IDs
function compareRouteId(a, b) {
  const va = parseInt(a);
  const vb = parseInt(b);
  if (!isNaN(va) && !isNaN(vb)) {
    if (va === vb) return 0;
    return va < vb ? -1 : 1;
  }
  if (isNaN(va)) return 1;
  if (isNaN(vb)) return -1;
  return 0;
}

// Fetch available routes
function fetchAvailableRoutes() {
  showCenteredLoadingMessage(); // Show loading message
  const datasetId = getCurrentCity();
  if (!datasetId) {
    hideCenteredLoadingMessage();
    return;
  }

  const params = new URLSearchParams({ datasetId });

  console.log("Fetching routes for dataset: " + datasetId);
  fetch(`/get_routes_info?${params}`)
    .then((response) => response.json())
    .then((route_info) => {
      populateRouteSelector(route_info.route_ids);
      const lat = (route_info.min_latitude + route_info.max_latitude) / 2;
      const lon = (route_info.min_longitude + route_info.max_longitude) / 2;
      map.setView([lat, lon], 12);
      syncSelectionUi();
      
      // Restore route selections after population
      const savedRoutes = loadSelection(STORAGE_KEYS.ROUTES);
      if (savedRoutes && Array.isArray(savedRoutes)) {
        setTimeout(() => {
          savedRoutes.forEach(routeId => {
            const routeCheckbox = document.querySelector(`#routeSelector input[value="${routeId}"]`);
            if (routeCheckbox) {
              routeCheckbox.checked = true;
            }
          });
          syncSelectionUi();
          updateVehiclePositions();
        }, 50);
      }
    })
    .finally(() => {
      hideCenteredLoadingMessage(); // Hide loading message
    });
}

// Country change event
function onChangeCountry() {
  const citySelector = document.getElementById("citySelector");
  citySelector.innerHTML = "";
  fetchAvailableCities();
}

// Populate country selector
function populateCountrySelector(countries) {
  const countrySelector = document.getElementById("countrySelector");
  countrySelector.innerHTML = "";
  countries.sort();
  countries.forEach((country) => {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" value="${country}" onChange="countrySelected(event)" />
      ${country}
    `;
    countrySelector.appendChild(label);
  });

  syncSelectionUi();
}

// Fetch available countries
function fetchAvailableCountries() {
  fetch("/get_available_countries")
    .then((response) => response.json())
    .then((countries) => {
      populateCountrySelector(countries);
      syncSelectionUi();
      // Restore country selection after population
      const savedCountry = loadSelection(STORAGE_KEYS.COUNTRY);
      if (savedCountry) {
        setTimeout(() => {
          const countryCheckbox = document.querySelector(`#countrySelector input[value="${savedCountry}"]`);
          if (countryCheckbox) {
            countryCheckbox.checked = true;
            syncSelectionUi();
            fetchAvailableCities();
          }
        }, 50);
      }
    });
}

// Get current country
function getCurrentCountry() {
  const selectedCountries = [];
  const countrySelector = document.getElementById("countrySelector");
  const checkboxes = countrySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    const label = checkbox.parentElement;
    const name = label.textContent.trim();
    const value = checkbox.value;
    selectedCountries.push({ name, value });
  });
  if (selectedCountries.length === 0) return null;
  return selectedCountries[0].value;
}

// City change event
function onChangeCity() {
  fetchAvailableRoutes();
}

function populateCitySelector(cities) {
  const citySelector = document.getElementById("citySelector");
  let city_catalogue = []; // Initialize the catalogue
  citySelector.innerHTML = "";

  cities.forEach((city) => {
    const city_id = city.id;
    const city_names = city.name.split(","); // Split city_name by comma
    city_names.sort();

    city_names.forEach((city_name) => {
      const trimmedName = city_name.trim();

      // Check if the city already exists in the catalogue
      const exists = city_catalogue.some(
        (entry) => entry.id === city_id && entry.name === trimmedName
      );

      if (!exists) {
        city_catalogue.push({ id: city_id, name: trimmedName }); // Store in the catalogue
      }
    });
  });

  // Sort and populate the city selector
  city_catalogue.sort((a, b) => a.name.localeCompare(b.name)); // Sort the catalogue
  city_catalogue.forEach((city) => {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" value="${city.id}" onChange="citySelected(event)" />
      ${city.name}
    `;
    citySelector.appendChild(label);
  });

  syncSelectionUi();
}

// Fetch available cities
function fetchAvailableCities() {
  const currentCountry = getCurrentCountry();
  const params = new URLSearchParams({ country: currentCountry });
  fetch(`/get_available_cities?${params}`)
    .then((response) => response.json())
    .then((cities) => {
      populateCitySelector(cities);
      syncSelectionUi();
      // Restore city selection after population
      const savedCity = loadSelection(STORAGE_KEYS.CITY);
      if (savedCity) {
        setTimeout(() => {
          const cityCheckbox = document.querySelector(`#citySelector input[value="${savedCity}"]`);
          if (cityCheckbox) {
            cityCheckbox.checked = true;
            syncSelectionUi();
            fetchAvailableRoutes();
          }
        }, 50);
      }
    });
}

// Get current city
function getCurrentCity() {
  const selectedCities = [];
  const citySelector = document.getElementById("citySelector");
  const checkboxes = citySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    const label = checkbox.parentElement;
    const name = label.textContent.trim();
    const value = checkbox.value;
    selectedCities.push({ name, value });
  });
  if (selectedCities.length === 0) return null;
  return selectedCities[0].value;
}

// Add touch support for dropdowns with map interaction prevention
document.addEventListener('DOMContentLoaded', function() {
  const dropdowns = document.querySelectorAll('.dropdown');
  
  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector('button');
    const content = dropdown.querySelector('.dropdown-content');
    
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Close other dropdowns
      dropdowns.forEach(other => {
        if (other !== dropdown) {
          const otherContent = other.querySelector('.dropdown-content');
          otherContent.style.display = 'none';
          other.classList.remove('dropdown-open');
          if (otherContent.id === 'routeSelector') {
            setRoutePickerOpenState(false);
          }
          // Re-enable map interaction
          setMapInteractionEnabled(true);
        }
      });
      
      // Toggle current dropdown
      const isVisible = content.style.display === 'block';
      content.style.display = isVisible ? 'none' : 'block';
      dropdown.classList.toggle('dropdown-open', !isVisible);
      if (content.id === 'routeSelector') {
        setRoutePickerOpenState(!isVisible);
      } else {
        setRoutePickerOpenState(false);
      }
      
      // Disable/enable map interaction based on dropdown state
      setMapInteractionEnabled(content.style.display !== 'block');
    });
    
    // Prevent map interaction when touching dropdown content
    content.addEventListener('touchstart', function(e) {
      e.stopPropagation();
    });
    
    content.addEventListener('touchmove', function(e) {
      e.stopPropagation();
    });
    
    content.addEventListener('touchend', function(e) {
      e.stopPropagation();
    });
    
    // Prevent map interaction when scrolling dropdown content
    content.addEventListener('scroll', function(e) {
      e.stopPropagation();
    });
  });
  
  // Close dropdowns when clicking outside and re-enable map
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
      closeAllDropdowns();
      
      // Re-enable map interaction
      setMapInteractionEnabled(true);
    }
  });
});

function showCenteredLoadingMessage() {
  let loadingDiv = document.getElementById('centeredLoadingMessage');
  if (!loadingDiv) {
    loadingDiv = document.createElement('div');
    loadingDiv.id = 'centeredLoadingMessage';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.background = 'rgba(255,255,255,0.95)';
    loadingDiv.style.padding = '30px 50px';
    loadingDiv.style.borderRadius = '12px';
    loadingDiv.style.boxShadow = '0 2px 16px rgba(0,0,0,0.2)';
    loadingDiv.style.zIndex = '9999';
    loadingDiv.style.fontSize = '1.5em';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.innerText = 'Loading...';
    document.body.appendChild(loadingDiv);
  } else {
    loadingDiv.style.display = 'block';
  }
}

function hideCenteredLoadingMessage() {
  const loadingDiv = document.getElementById('centeredLoadingMessage');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}