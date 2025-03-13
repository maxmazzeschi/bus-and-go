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

  datasetId = getCurrentDataset();
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

  fetch(`/get_vehicles_positions?${params}`)
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
        speed = Math.round(speed);
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

function fetchAvailableRoutes() {
  datasetId = getCurrentDataset();
  if (datasetId == null) {
    return;
  }
  const params = new URLSearchParams({
    datasetId: datasetId
  });

  console.log("Fetching routes for dataset: " + datasetId);
  fetch(`/get_available_routes?${params}`)
    .then((response) => response.json())
    .then((routeIds) => {
      populateRouteSelector(routeIds);
    });
}

function getCurrentDataset() {
  const selectedDatasets = [];
  const datasetSelector = document.getElementById("datasetSelector");
  const checkboxes = datasetSelector.querySelectorAll('input[type="checkbox"]:checked');

  checkboxes.forEach((checkbox) => {
    const label = checkbox.parentElement;
    const name = label.textContent.trim();
    const value = checkbox.value;
    selectedDatasets.push({ name, value });
  });
  if (selectedDatasets.length == 0) {
    return null;
  }
  return selectedDatasets[0].value;
}

function onChangeDataset() {
  fetchAvailableRoutes();
  updateVehiclePositions();
}

function populateDatasetSelector(datasets) {
    const datasetSelector = document.getElementById("datasetSelector");
    datasetSelector.innerHTML = "";
    console.log( datasets[0]);
    datasets.forEach((dataset) => {
      // Sort datasets IDs alphabetically
      const label = document.createElement("label");
      dname = dataset.name;
      dvalue = dataset.id;
      console.log(dname + " " + dvalue);
      label.innerHTML = `
              <input type="checkbox" value="${dvalue}" />
              ${dname}
          `;
      datasetSelector.appendChild(label);
    });
  }

  
function fetchAvailableDatasets() {
    fetch("/get_available_datasets")
      .then((response) => response.json())
      .then((datasets) => {
        populateDatasetSelector(datasets);
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
