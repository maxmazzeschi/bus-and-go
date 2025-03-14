import requests
import os
import zipfile
import tempfile
from .vehicles import Vehicles
from .siri_vehicles import SIRI_Vehicles
import uuid


class Dataset:
    def __init__(self, provider):
        self.src = provider
        self.vehicle_url = self.src["vehicle_positions_url"]
        if (provider["vehicle_positions_url_type"] == "SIRI"):
            keyEnvVar = provider["KEY_ENV_VAR"]
            if keyEnvVar:
                print(f"getting {keyEnvVar}")
                api_key = os.getenv(keyEnvVar)
                print(f"value is {api_key}")
                url = self.vehicle_url + api_key
            else:
                url = self.vehicle_url
            self.vehicles = SIRI_Vehicles(url, self.src["refresh_interval"])
        else:
            self.vehicles = Vehicles(self.vehicle_url, self.src["refresh_interval"])
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
