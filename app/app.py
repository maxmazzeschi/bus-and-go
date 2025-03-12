from flask import Flask, jsonify, render_template, request
from GTFSDatasetsProvider.vehicles import Vehicles
from GTFSDatasetsProvider.datasets_provider import GTFSDatasetsProvider

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_vehicles_positions")
def get_vehicles_positions():
    datasetId = request.args.get("datasetId")
    print(datasetId)
    if not datasetId:
        print("No datasetId")
        return jsonify([])
    dataset = GTFSDatasetsProvider.get_dataset(datasetId)
    north = float(request.args.get("north", 90))
    south = float(request.args.get("south", -90))
    east = float(request.args.get("east", 180))
    west = float(request.args.get("west", -180))
    selected_routes = request.args.get("routes")
    filtered_vehicles = dataset.get_vehicles_positions(
        north, south, east, west, selected_routes
    )
    print(filtered_vehicles)
    return jsonify(filtered_vehicles)


@app.route("/get_available_routes")
def get_available_routes():
    datasetId = request.args.get("datasetId")
    print(datasetId)
    if not datasetId:
        return jsonify([])
    dataset = GTFSDatasetsProvider.get_dataset(datasetId)
    route_ids = dataset.get_available_routes()
    return jsonify(route_ids)

@app.route("/get_available_datasets")
def get_available_datasets():
    available_datasets = GTFSDatasetsProvider.get_datasets_list()
    print(available_datasets)
    return jsonify(available_datasets)


if __name__ == "__main__":
    app.run(debug=True)
