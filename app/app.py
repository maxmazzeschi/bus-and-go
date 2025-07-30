from flask import Flask, jsonify, render_template, request
from public_transport_datasets.datasets_provider import DatasetsProvider

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_vehicles_position")
def get_vehicles_position():
    datasetId = request.args.get("datasetId")
    if not datasetId:
        return jsonify([])
    dataset = DatasetsProvider.get_dataset(datasetId)
    if dataset is None:
        return jsonify([])
    north = float(request.args.get("north", 90))
    south = float(request.args.get("south", -90))
    east = float(request.args.get("east", 180))
    west = float(request.args.get("west", -180))
    selected_routes = request.args.get("routes")
    filtered_vehicles = dataset.get_vehicles_position(
        north, south, east, west, selected_routes
    )
    return jsonify(filtered_vehicles)


@app.route("/get_routes_info")
def get_routes_info():
    datasetId = request.args.get("datasetId")
    if not datasetId:
        return jsonify([])
    dataset = DatasetsProvider.get_dataset(datasetId)
    if dataset is None:
        return jsonify([])
    info = dataset.get_routes_info()
    return jsonify(info)


@app.route("/get_available_countries")
def get_available_datasets():
    available_countries = DatasetsProvider.get_available_countries()
    return list(available_countries)


@app.route("/get_available_cities")
def get_available_cities():
    country = request.args.get("country")
    available_cities = DatasetsProvider.get_datasets_by_country(country)
    return jsonify(available_cities)


@app.route("/get_stops_info")
def get_stops_info():
    datasetId = request.args.get("datasetId")
    if not datasetId:
        return jsonify([])
    dataset = DatasetsProvider.get_dataset(datasetId)
    if dataset is None:
        return jsonify([])
    north = float(request.args.get("north", 90))
    south = float(request.args.get("south", -90))
    east = float(request.args.get("east", 180))
    west = float(request.args.get("west", -180))

    info = dataset.get_stops_in_area(north, south, east, west)

    return jsonify(info)


if __name__ == "__main__":
        app.run(debug=False)

