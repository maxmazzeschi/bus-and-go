import time
import requests
from google.transit import gtfs_realtime_pb2
import threading


class Vehicles:
    def __init__(self, url, headers, refresh_interval):
        self.created_date = time.time()
        self.vehicle_list = []
        self.last_update = 0
        self.refresh_interval = refresh_interval
        self.vehicles_lock = threading.Lock()
        self.url = url
        self.headers = headers
        self.update_vehicle_positions()
        self.update_thread = threading.Thread(target=self.update_loop)
        self.update_thread.daemon = True
        self.update_thread.start()

    def update_vehicle_positions(self):
        feed = gtfs_realtime_pb2.FeedMessage()
        try:
            if self.headers is not None:
                response = requests.get(self.url, headers=self.headers)
            else:
                response = requests.get(self.url)
            if response.status_code != 200:
                print(f"Error {response.status_code} getting data from {self.url}")
                return
            feed.ParseFromString(response.content)
            last_update = int(feed.header.timestamp)
            if last_update == self.last_update:
                return
            self.last_update = feed.header.timestamp
        except Exception as e:
            print(f"Error fetching vehicle positions: {e}")
            return
        new_vehicles = []
        for entity in feed.entity:
            if entity.HasField("vehicle"):
                vehicle_id = entity.vehicle.vehicle.id
                route_id = entity.vehicle.trip.route_id
                if route_id == '':
                    route_id = entity.vehicle.vehicle.label
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
            self.vehicle_list = new_vehicles
        print(f"Updated vehicle positions: {len(self.vehicle_list)}")

    def update_loop(self):
        while True:
            self.update_vehicle_positions()
            time.sleep(self.refresh_interval)

    def get_vehicles_positions(self, north, south, east, west, selected_routes):
        north = float(north)
        south = float(south)
        east = float(east)
        west = float(west)
        selected_routes = selected_routes.split(",") if selected_routes else []
        with self.vehicles_lock:
            filtered_vehicles = [
                v
                for v in self.vehicle_list
                if south <= v["lat"] <= north
                and west <= v["lon"] <= east
                and (not selected_routes or v["route_id"] in selected_routes)
            ]
        return {"created_date": self.created_date,
                "last_update": self.last_update,
                "vehicles": filtered_vehicles}

    def get_available_routes(self):
        with self.vehicles_lock:
            route_ids = list({v["route_id"] for v in self.vehicle_list})
        return route_ids
