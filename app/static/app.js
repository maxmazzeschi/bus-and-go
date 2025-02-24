let map;
let vehicleMarkers = {};
let vehicleLabels = {};

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

  // Update every 60 sec
  setInterval(updateVehiclePositions, 60000);
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

      // Remove previous markers
      for (const marker of Object.values(vehicleMarkers)) {
        map.removeLayer(marker);
      }
      for (const label of Object.values(vehicleLabels)) {
        map.removeLayer(label);
      }
      vehicleMarkers = {};
      vehicleLabels = {};
      data.forEach((vehicle) => {
        const { lat, lon, route_id, bearing, speed, vehicle_id } = vehicle;
        //console.log(vehicle);
        // Create a circle marker for the vehicle's position

        // Add route label
        const label = L.divIcon({
          className: "vehicle-label",
          html: route_id + "@" + speed + " Km/h",
          iconSize: [90, 25],
          iconAnchor: [-10, 10],
        });

        const labelMarker = L.marker([lat, lon], { icon: label }).addTo(map);

        if (speed > 0) {
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

window.onload = () => {
  initializeMap();
  fetchAvailableRoutes();
  updateVehiclePositions();
  document
    .getElementById("routeSelector")
    .addEventListener("change", updateVehiclePositions);
};
