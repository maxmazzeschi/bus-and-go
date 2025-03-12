import json
import os
import threading
from .dataset import Dataset
import re


datasets = {}
datasets_lock = threading.Lock()


class GTFSDatasetsProvider:
    def __init__(self, id):
        pass

    @staticmethod
    def get_config_path():
        base_dir = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(base_dir, 'sources')
        return config_path

    @staticmethod
    def get_dataset(id):
        with datasets_lock:
            ds = datasets.get(id)
            if ds:
                return ds
            found = False
            with os.scandir(GTFSDatasetsProvider.get_config_path()) as file_list:
                for entry in file_list:
                    if re.search(r"\.json", os.fsdecode(entry.name)):
                        with open(entry.path) as f:
                            provider = json.load(f)
                            if provider["id"] == id:
                                found = True
                                break
            if found is False:
                raise NameError
            ds = Dataset(provider)
            datasets[id] = ds
            return ds

    @staticmethod
    def get_datasets_list() -> list:
        datasets_list = []
        with os.scandir(GTFSDatasetsProvider.get_config_path()) as file_list:
            for entry in file_list:
                if re.search(r"\.json", os.fsdecode(entry.name)):
                    with open(entry.path) as f:
                        provider = json.load(f)
                        datasets_list.append(
                            {"name": provider["name"], "id": provider["id"]}
                        )
        return datasets_list
