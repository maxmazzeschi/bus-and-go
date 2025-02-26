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

function updateVehiclePositions() {
  const bounds = map.getBounds();
  const selectedRoutes = Array.from(
    document.querySelectorAll('#routeSelector input[type="checkbox"]:checked'),
  ).map((checkbox) => checkbox.value);

  const params = new URLSearchParams({
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    routes: selectedRoutes.join(","),
  });

  fetch(`/get_vehicle_positions?${params}`)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      const date = new Date(data.last_update * 1000); // Multiply by 1000 to convert seconds to milliseconds

      // Format the date to a human-readable string
      const humanReadableDate = date.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      console.log(humanReadableDate);
      // Remove previous markers
      for (const marker of Object.values(vehicleMarkers)) {
        map.removeLayer(marker);
      }
      for (const label of Object.values(vehicleLabels)) {
        map.removeLayer(label);
      }
      vehicleMarkers = {};
      vehicleLabels = {};
      vehicles = data.vehicles;
      vehicles.forEach((vehicle) => {
        const { lat, lon, route_id, bearing, speed, vehicle_id } = vehicle;
        //console.log(vehicle);
        // Create a circle marker for the vehicle's position

        // Add route label
        const label = L.divIcon({
          className: "vehicle-label",
          html: route_id + (speed > 0 ? "@" + speed + " Km/h" : ""),
          iconSize: speed > 0 ? [90, 15] : [30, 15],
          iconAnchor: [-10, 10],
        });

        const labelMarker = L.marker([lat, lon], { icon: label }).addTo(map);

        if (false && speed > 0) {
          // Improved arrow using SVG
          const arrowHtml = `
            <svg class="arrow-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <polygon points="12,2 22,22 12,17 2,22" />
            </svg>
          `;

          const arrow = L.divIcon({
            className: "arrow-icon",
            html: arrowHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12], // Anchor point at the center of the arrow
          });

          // Create an arrow marker at the correct lat, lon
          const arrowMarker = L.marker([lat, lon], { icon: arrow }).addTo(map);

          // Rotate the arrow based on the bearing
          const approx_angle = Math.round(bearing); // Round the bearing to an integer if necessary
          arrowMarker.getElement().style.transform = `rotate(${approx_angle}deg)`;

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
  if (va == NaN && vb == NaN) {
    return a < b ? -1 : 1;
  }
  if (va == NaN) {
    return 1;
  }
  if (vb == NaN) {
    return -1;
  }
  return va - vb;
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

function fetchAvailableRoutes() {
  fetch("/get_available_routes")
    .then((response) => response.json())
    .then((routeIds) => {
      populateRouteSelector(routeIds);
    });
}


function populateDatasetSelector(datasets) {
    const datasetSelector = document.getElementById("datasetSelector");
    datasetSelector.innerHTML = "";
    console.log( datasets[0]);
    datasets.forEach((dataset) => {
      // Sort datasets IDs alphabetically
      const label = document.createElement("label");
      label.innerHTML = `
              <input type="checkbox" value="${dataset}" />
              ${dataset}
          `;
      datasetSelector.appendChild(label);
    });
  }

  
function fetchAvailableDatasets() {
    fetch("/get_available_datasets")
      .then((response) => response.json())
      .then((routeIds) => {
        populateDatasetSelector(routeIds);
      });
  }

window.onload = () => {
  initializeMap();
  fetchAvailableDatasets();
  fetchAvailableRoutes();
  updateVehiclePositions();
  document
    .getElementById("routeSelector")
    .addEventListener("change", updateVehiclePositions);
};
