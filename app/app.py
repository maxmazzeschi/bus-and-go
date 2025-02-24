from flask import Flask, jsonify, render_template, request
from vehicles import Vehicles

app = Flask(__name__)
vehicles = Vehicles()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/get_vehicle_positions")
def get_vehicle_positions():
    north = float(request.args.get("north", 90))
    south = float(request.args.get("south", -90))
    east = float(request.args.get("east", 180))
    west = float(request.args.get("west", -180))
    selected_routes = request.args.get("routes")
    filtered_vehicles = vehicles.get_vehicle_positions(
        north, south, east, west, selected_routes
    )
    return jsonify(filtered_vehicles)


@app.route("/get_available_routes")
def get_available_routes():
    route_ids = vehicles.get_available_routes()
    return jsonify(route_ids)


if __name__ == "__main__":
    app.run(debug=True)
