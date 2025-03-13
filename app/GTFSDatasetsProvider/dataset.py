import requests
import os
import zipfile
import tempfile
from .vehicles import Vehicles
import uuid


class Dataset:
    def __init__(self, provider):
        self.src = provider
        self.vehicle_url = self.src["vehicle_positions_url"]
        self.vehicles = Vehicles(self.vehicle_url)
        static_gtfs_url = self.src["static_gtfs_url"]
        if static_gtfs_url:
            response = requests.get(self.src["static_gtfs_url"])
            temp_filename = tempfile.NamedTemporaryFile(suffix='.zip',
                                                        delete=False).name
            with open(temp_filename, 'wb') as file:
                file.write(response.content)
            # Extract the ZIP file
            temp_file_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}")
            with zipfile.ZipFile(temp_filename, 'r') as zip_ref:
                zip_ref.extractall(temp_file_path)
            os.remove(temp_filename)
            #os.removedirs(temp_file_path)

    def get_available_routes(self):
        return self.vehicles.get_available_routes()

    def get_vehicles_positions(self, north, south, east, west, selected_routes):
        return self.vehicles.get_vehicles_positions(north, south,
                                                    east, west,
                                                    selected_routes)
