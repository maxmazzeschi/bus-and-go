let map;
let vehicleMarkers = {};
let vehicleLabels = {};
let stopsMarkers = []; // Changed to a list
let updateInterval = 60; // Update every 60 seconds
let remainingTime = updateInterval;
let timerInterval;
let StopsData = [];

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

  let drawStopMarkers = zoom >= 14;

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
        const { lat, lon, route_id, bearing, speed, vehicle_id } = vehicle;

        const roundedSpeed = Math.round(speed);
        const label = L.divIcon({
          className: "vehicle-label",
          html: `${route_id}${roundedSpeed > 0 ? `@${roundedSpeed} Km/h` : ""}`,
          iconSize: roundedSpeed > 0 ? [90, 15] : [30, 15],
          iconAnchor: [-10, 10],
        });

        const labelMarker = L.marker([lat, lon], { icon: label }).addTo(map);

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
          vehicleMarkers[vehicle_id] = arrowMarker;
        } else {
          const marker = L.circleMarker([lat, lon], {
            radius: 8,
            color: "#ff5722",
            fillColor: "#ff5722",
            fillOpacity: 0.7,
          }).addTo(map);
          vehicleMarkers[vehicle_id] = marker;
        }

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

// Main window load
window.onload = () => {
  initializeMap();
  fetchAvailableCountries();
  document
    .getElementById("routeSelector")
    .addEventListener("change", updateVehiclePositions);
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

// Populate route selector
function populateRouteSelector(routeIds) {
  const routeSelector = document.getElementById("routeSelector");
  routeSelector.innerHTML = "";
  routeIds.sort(compareRouteId).forEach((routeId) => {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" value="${routeId}" />
      ${routeId}
    `;
    routeSelector.appendChild(label);
  });
}

// Fetch available routes
function fetchAvailableRoutes() {
  const datasetId = getCurrentCity();
  if (!datasetId) return;

  const params = new URLSearchParams({ datasetId });

  console.log("Fetching routes for dataset: " + datasetId);
  fetch(`/get_routes_info?${params}`)
    .then((response) => response.json())
    .then((route_info) => {
      populateRouteSelector(route_info.route_ids);
      const lat = (route_info.min_latitude + route_info.max_latitude) / 2;
      const lon = (route_info.min_longitude + route_info.max_longitude) / 2;
      map.setView([lat, lon], 12);
    });
}

// Country change event
function onChangeCountry() {
  const citySelector = document.getElementById("citySelector");
  citySelector.innerHTML = "";
  fetchAvailableCities();
}

// Country selected event
function countrySelected(event) {
  if (!event.target.checked) return;

  const countrySelector = document.getElementById("countrySelector");
  const checkboxes = countrySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && checkbox !== event.target) {
      checkbox.checked = false;
    }
  });
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
}

// Fetch available countries
function fetchAvailableCountries() {
  fetch("/get_available_countries")
    .then((response) => response.json())
    .then((countries) => {
      populateCountrySelector(countries);
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

// City selected event
function citySelected(event) {
  if (!event.target.checked) return;

  const citySelector = document.getElementById("citySelector");
  const checkboxes = citySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && checkbox !== event.target) {
      checkbox.checked = false;
    }
  });
}

function populateCitySelector(cities) {
  const citySelector = document.getElementById("citySelector");
  var city_catalogue = []; // Initialize the catalogue
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
}

// Fetch available cities
function fetchAvailableCities() {
  const currentCountry = getCurrentCountry();
  const params = new URLSearchParams({ country: currentCountry });
  fetch(`/get_available_cities?${params}`)
    .then((response) => response.json())
    .then((cities) => {
      populateCitySelector(cities);
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
