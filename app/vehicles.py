import time
import requests
from google.transit import gtfs_realtime_pb2
import threading


class Vehicles:

    def __init__(self):
        self.vehicles = []
        self.vehicles_lock = threading.Lock()
        self.url = "https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb"
        self.update_vehicle_positions()
        self.update_thread = threading.Thread(target=self.update_loop)
        self.update_thread.daemon = True
        self.update_thread.start()

    def update_vehicle_positions(self):
        feed = gtfs_realtime_pb2.FeedMessage()
        try:
            response = requests.get(self.url)
            feed.ParseFromString(response.content)
        except Exception as e:
            print(f"Error fetching vehicle positions: {e}")
            return
        new_vehicles = []
        for entity in feed.entity:
            if entity.HasField("vehicle"):
                vehicle_id = entity.vehicle.vehicle.id
                route_id = entity.vehicle.trip.route_id
                latitude = entity.vehicle.position.latitude
                longitude = entity.vehicle.position.longitude
                bearing = entity.vehicle.position.bearing
                speed = entity.vehicle.position.speed
                new_vehicles.append(
                    {
                        "vehicle_id": vehicle_id,
                        "route_id": route_id,
                        "lat": latitude,
                        "lon": longitude,
                        "bearing": bearing,
                        "speed": speed,
                    }
                )
        with self.vehicles_lock:
            self.vehicles = new_vehicles
        # print(f"Updated vehicle positions: {len(self.vehicles)}")

    def update_loop(self):
        while True:
            self.update_vehicle_positions()
            time.sleep(60)

    def get_vehicle_positions(self, north, south, east, west, selected_routes):
        north = float(north)
        south = float(south)
        east = float(east)
        west = float(west)
        selected_routes = selected_routes.split(",") if selected_routes else []
        with self.vehicles_lock:
            filtered_vehicles = [
                v
                for v in self.vehicles
                if south <= v["lat"] <= north
                and west <= v["lon"] <= east
                and (not selected_routes or v["route_id"] in selected_routes)
            ]
        return filtered_vehicles

    def get_available_routes(self):
        with self.vehicles_lock:
            route_ids = list({v["route_id"] for v in self.vehicles})
        return route_ids

    def get_vehicles(self):
        with self.vehicles_lock:
            return self.vehicles
