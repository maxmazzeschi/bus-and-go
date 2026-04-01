import os
from datetime import datetime, timezone

from flask import Flask, jsonify, redirect, render_template, request, url_for
from public_transport_datasets.datasets_provider import DatasetsProvider

app = Flask(__name__)

MOBILE_USER_AGENT_TOKENS = (
    "android",
    "iphone",
    "ipad",
    "ipod",
    "mobile",
    "opera mini",
    "iemobile",
)


def get_requested_ui_mode():
    ui_mode = request.args.get("view", "").strip().lower()
    if ui_mode in {"desktop", "mobile"}:
        return ui_mode
    return None


def is_mobile_request():
    user_agent = request.headers.get("User-Agent", "").lower()
    return any(token in user_agent for token in MOBILE_USER_AGENT_TOKENS)


@app.route("/")
def index():
    requested_ui_mode = get_requested_ui_mode()
    if requested_ui_mode == "mobile" or (
        requested_ui_mode is None and is_mobile_request()
    ):
        return redirect(url_for("mobile_index"))
    return render_template("index.html")


@app.route("/mobile")
def mobile_index():
    if get_requested_ui_mode() == "desktop":
        return redirect(url_for("index", view="desktop"))
    return render_template("mobile.html")


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
    last_update = filtered_vehicles.get("last_update")
    if last_update is not None:
        last_update_human = datetime.fromtimestamp(
            float(last_update), tz=timezone.utc
        ).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(f"last update timestamp: {last_update} ({last_update_human})")
    else:
        print("last update timestamp: missing")
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
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=False)
