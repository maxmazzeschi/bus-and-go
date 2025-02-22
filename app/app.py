from flask import Flask, jsonify, render_template, request
import time
import requests
from google.transit import gtfs_realtime_pb2
import threading

app = Flask(__name__)

vehicles = []
vehicles_lock = threading.Lock()  # For thread safety


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/get_vehicle_positions')
def get_vehicle_positions():
    north = float(request.args.get('north'))
    south = float(request.args.get('south'))
    east = float(request.args.get('east'))
    west = float(request.args.get('west'))
    print(north, south, east, west)
    with vehicles_lock:
        filtered_vehicles = [
            v for v in vehicles
            if south <= v['lat'] <= north and west <= v['lon'] <= east
        ]
    return jsonify(filtered_vehicles)


def update_vehicle_positions():
    global vehicles
    url = 'https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb'
    while True:
        feed = gtfs_realtime_pb2.FeedMessage()
        response = requests.get(url)
        feed.ParseFromString(response.content)
        new_vehicles = []
        for entity in feed.entity:
            if entity.HasField('vehicle'):
                vehicle_id = entity.vehicle.vehicle.id
                route_id = entity.vehicle.trip.route_id
                latitude = entity.vehicle.position.latitude
                longitude = entity.vehicle.position.longitude
                new_vehicles.append({
                    'vehicle_id': vehicle_id,
                    'route_id': route_id,
                    'lat': latitude,
                    'lon': longitude
                })
        with vehicles_lock:
            vehicles = new_vehicles
        time.sleep(60)


# Start the update in a separate thread
thread = threading.Thread(target=update_vehicle_positions)
thread.daemon = True
thread.start()


if __name__ == '__main__':
    app.run(debug=True)
