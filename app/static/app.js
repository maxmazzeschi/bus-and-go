let map;
let vehicleMarkers = {};
let vehicleLabels = {};
let updateInterval = 60; // Update every 60 seconds
let remainingTime = updateInterval;
let timerInterval;

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
      },
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

  // Update every 60 sec
  setInterval(updateVehiclePositions, updateInterval * 1000);
  startTimer();
}

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

function isMapInitialized() {
  return map && map._loaded && map.getCenter() && map.getZoom() !== undefined;
}


function updateVehiclePositions() {
  if (isMapInitialized() == false) {
    return;
  } 
  const bounds = map.getBounds();
  const selectedRoutes = Array.from(
    document.querySelectorAll('#routeSelector input[type="checkbox"]:checked'),
  ).map((checkbox) => checkbox.value);

  datasetId = getCurrentCity();
  if (datasetId == null) {  
    return;
  }
  const params = new URLSearchParams({
    datasetId: datasetId,
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    routes: selectedRoutes.join(","),
  });

  fetch(`/get_vehicles_position?${params}`)
    .then((response) => response.json())
    .then((data) => {
      // Remove previous markers
      for (const marker of Object.values(vehicleMarkers)) {
        map.removeLayer(marker);
      }
      for (const label of Object.values(vehicleLabels)) {
        map.removeLayer(label);
      }
      if (data.length == 0) {
        return;
      }
      
      const created_date_ms = new Date(data.created_date * 1000); // Multiply by 1000 to convert seconds to milliseconds

      // Format the date to a human-readable string
      const created_date = created_date_ms.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const updated_date_ms = new Date(data.last_update * 1000); // Multiply by 1000 to convert seconds to milliseconds

      // Format the date to a human-readable string
      const updated_date = updated_date_ms.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      console.log("created on " + created_date + " updated on " + updated_date);
      vehicleMarkers = {};
      vehicleLabels = {};
      vehicles = data.vehicles;
      vehicles.forEach((vehicle) => {
        const { lat, lon, route_id, bearing, speed, vehicle_id } = vehicle;
        //console.log(vehicle);
        // Create a circle marker for the vehicle's position

        // Add route label
        rounded_speed = Math.round(speed);
        const label = L.divIcon({
          className: "vehicle-label",
          html: route_id + (rounded_speed > 0 ? "@" + rounded_speed + " Km/h" : ""),
          iconSize: rounded_speed > 0 ? [90, 15] : [30, 15],
          iconAnchor: [-10, 10],
        });

        const labelMarker = L.marker([lat, lon], { icon: label }).addTo(map);

        if (true && bearing > 0) {
          // Improved arrow using SVG
          const arrowHtml = `
  <svg class="arrow-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" style="transform: rotate(${Math.round(bearing)}deg);">
    <polygon points="12,2 22,22 12,17 2,22" />
  </svg>
`; // SVG code for a triangle pointing up

          const arrow = L.divIcon({
            className: "arrow-icon",
            html: arrowHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12], // Anchor point at the center of the arrow
          });

          // Create an arrow marker at the correct lat, lon
          const arrowMarker = L.marker([lat, lon], { icon: arrow }).addTo(map);

          // Store the arrow marker
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

        // Store the marker and label references

        vehicleLabels[vehicle_id] = labelMarker;
      });
      // Reset timer on update
      startTimer();
    });
}

function compareRouteId(a, b) {
  va = parseInt(a);
  vb = parseInt(b);
  if (va != NaN && vb != NaN) {
    if (va == vb) {
      return 0;
    }
    return a < b ? -1 : 1;
  }
  if (va == NaN) {
    return 1;
  }
  if (vb == NaN) {
    return -1;
  }
  return 0;
}

function populateRouteSelector(routeIds) {
  const routeSelector = document.getElementById("routeSelector");
  routeSelector.innerHTML = "";
  routeIds.sort(compareRouteId).forEach((routeId) => {
    // Sort route IDs alphabetically
    const label = document.createElement("label");
    label.innerHTML = `
            <input type="checkbox" value="${routeId}" />
            ${routeId}
        `;
    routeSelector.appendChild(label);
  });
}


// Routes
function fetchAvailableRoutes() {
  datasetId = getCurrentCity();
  if (datasetId == null) {
    return;
  }
  const params = new URLSearchParams({
    datasetId: datasetId
  });

  console.log("Fetching routes for dataset: " + datasetId);
  fetch(`/get_routes_info?${params}`)
    .then((response) => response.json())
    .then((route_info) => {
      populateRouteSelector(route_info.route_ids);
      lat = (route_info.min_latitude + route_info.max_latitude)/2
      lon = (route_info.min_longitude + route_info.max_longitude)/2
      map.setView([lat, lon], 12);
    });
}

// Country
function onChangeCountry() {
  const citySelector = document.getElementById("citySelector");
  citySelector.innerHTML = "";
  fetchAvailableCities()
}

function countrySelected(event) {
  if (event.target.checked == false) {
    return;
  }

  const countrySelector = document.getElementById("countrySelector");
  const checkboxes = countrySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && (checkbox != event.target)) {
      checkbox.checked = false;
    }
  });
}

function populateCountrySelector(countries) {
    const countrySelector = document.getElementById("countrySelector");
    countrySelector.innerHTML = "";
    countries.sort()
    countries.forEach((country) => {
      const label = document.createElement("label");
      label.innerHTML = `
              <input type="checkbox" value="${country}" onChange="countrySelected(event)" />
              ${country}
          `;
        countrySelector.appendChild(label);
    });
  }

  
function fetchAvailableCountries() {
    fetch("/get_available_countries")
      .then((response) => response.json())
      .then((countries) => {
        populateCountrySelector(countries);
      });
  }

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
  if (selectedCountries.length == 0) {
    return null;
  }
  return selectedCountries[0].value;
}

// City
function onChangeCity() {
  fetchAvailableRoutes()
}

function citySelected(event) {
  if (event.target.checked == false) {
    return;
  }

  const citySelector = document.getElementById("citySelector");
  const checkboxes = citySelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    if (checkbox.checked && (checkbox != event.target)) {
      checkbox.checked = false;
    }
  });
}

function populateCitySelector(cities) {
    const citySelector = document.getElementById("citySelector");
    citySelector.innerHTML = "";
    cities.forEach((city) => {
      const label = document.createElement("label");
      city_id = city.id
      city_names = city.name.split(","); // Split city_name by comma
      city_names.sort()
        city_names.forEach((city_name) => {
            const label = document.createElement("label");
            label.innerHTML = `
                <input type="checkbox" value="${city_id}" onChange="citySelected(event)" />
                ${city_name.trim()} <!-- Trim to remove extra spaces -->
            `;
            citySelector.appendChild(label);
        });
      });
  }
  
function fetchAvailableCities() {
  const currentCountry = getCurrentCountry()
  const params = new URLSearchParams({
    country: currentCountry
  });
  fetch(`/get_available_cities?${params}`)
      .then((response) => response.json())
      .then((cities) => {
        populateCitySelector(cities);
      });
  }

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
  if (selectedCities.length == 0) {
    return null;
  }
  return selectedCities[0].value;
}

// main window
window.onload = () => {
  initializeMap();
  fetchAvailableCountries();
  document
    .getElementById("routeSelector")
    .addEventListener("change", updateVehiclePositions);
};
