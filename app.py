from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO
from threading import Thread
import time
import logging

# Custom lorentz library
from lorentz import (
    SerialPort, SerialReader, Parser, Queue, ThreadSerial, TelemetryBroadcaster, FileWriter, ThreadFileWriter, Logger, ALL_BAUD
)
from DataFormat import rx_data_format

# -------------------- INITIALIZATION --------------------
app = Flask(__name__)
socketio = SocketIO(app)
_log = Logger('GCS')
_log.warn("Ground Control Station Initialized")

# Disable werkzeug logs
werkzeug_logger = logging.getLogger('werkzeug')
werkzeug_logger.setLevel(logging.ERROR)
werkzeug_logger.disabled = True

# -------------------- SERIAL SETUP --------------------
_SerialPort = SerialPort()
_SerialReader = SerialReader(_SerialPort, encoding="utf-8")
_parser = Parser(rx_data_format, header="H", tail="A")
_queue = Queue()

_thread_serial = None
_thread_file_writer = None
_telemetry_broadcaster = None

gport = None
gbaud = None

# -------------------- MONITORING THREADS --------------------
def monitor_serial_connection():
    isConnected = False
    while True:
        if _SerialPort.is_connected() and not isConnected:
            isConnected = True
            socketio.emit('serial_connected', {'status': True, 'message': 'Connection established'})
        elif not _SerialPort.is_connected() and isConnected:
            isConnected = False
            socketio.emit('serial_disconnected', {'status': False, 'message': 'Disconnected'})
        time.sleep(1)

def monitor_ports():
    last_ports = set()
    while True:
        _SerialPort.refresh()
        current_ports = _SerialPort.ports()

        if current_ports != last_ports:
            socketio.emit('receive_ports', _SerialPort.ports())
            last_ports = current_ports  

        time.sleep(1)  


# -------------------- SOCKETIO EVENTS --------------------

@socketio.on('connect_serial')
def connect_serial(data):
    global _thread_serial, _telemetry_broadcaster, _thread_file_writer, gbaud, gport

    port, baud = data.get('port'), data.get('baud')
    if not port or not baud:
        return socketio.emit('serial_connected', {'status': False, 'message': 'Invalid port or baud rate'})

    try:

        if _SerialPort.connect(port, baud):

            gport = port
            gbaud = baud

            print(f"gport set to: {gport}")
            print(f"gbaud set to: {gbaud}")

            # Start telemetry reading
            _thread_serial = ThreadSerial(parser=_parser, reader=_SerialReader, queue=_queue, socketio=socketio)
            _thread_serial.start()

            # Start file writing
            file_writer = FileWriter(folder_name='3-15-test', save_name='telemetry', device_id='789')
            _thread_file_writer = ThreadFileWriter(file_writer, _queue)
            _thread_file_writer.start()

            # Start telemetry broadcasting
            _telemetry_broadcaster = TelemetryBroadcaster(queue=_queue, socketio=socketio)
            _telemetry_broadcaster.start()

            socketio.emit('serial_connected', {'status': True, 'message': f'Connected to {port} @ {baud} baud'})
        else:
            socketio.emit('serial_connected', {'status': False, 'message': 'Connection failed'})

    except Exception as e:
        socketio.emit('serial_connected', {'status': False, 'message': f'Error: {str(e)}'})

@socketio.on('disconnect_serial')
def disconnect_serial():
    global _thread_serial, _telemetry_broadcaster, _thread_file_writer

    try:
        if _thread_serial:
            _thread_serial.stop()
            _thread_serial = None

        if _telemetry_broadcaster:
            _telemetry_broadcaster.stop()
            _telemetry_broadcaster = None

        if _thread_file_writer:
            _thread_file_writer.stop()
            _thread_file_writer = None

        _SerialPort.disconnect()
        socketio.emit('serial_disconnected', {'status': True, 'message': 'Disconnected'})
    except Exception as e:
        socketio.emit('serial_disconnected', {'status': False, 'message': f'Error: {str(e)}'})

# -------------------- ROUTES --------------------
@app.route("/")
def ground_control_station():
    return render_template('index.html')

@app.route("/reset_connection")
def reset_connection():
    global gport, gbaud

    if not gport or not gbaud:
        return jsonify({"status": "error", "message": "Port or baud rate not set"}), 400

    try:
        _SerialPort.disconnect()
        time.sleep(0.500)
        _SerialPort.connect(gport, gbaud)

        socketio.emit('serial_connected', {'status': True, 'message': f'Reconnected to {gport} @ {gbaud} baud'})

        return jsonify({"status": "success", "message": "Connection reset successfully"})
    except Exception as e:
        socketio.emit('serial_connected', {'status': False, 'message': f'Error: {str(e)}'})
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/get_ports", methods=['GET'])
def get_ports():
    _SerialPort.refresh()
    return jsonify(_SerialPort.ports())

@app.route("/get_bauds", methods=['GET'])
def get_bauds():
    return jsonify(ALL_BAUD)

# -------------------- THREAD STARTUP --------------------
def start_background_threads():
    Thread(target=monitor_ports, daemon=True).start()
    Thread(target=monitor_serial_connection, daemon=True).start()

# -------------------- MAIN --------------------
if __name__ == "__main__":
    start_background_threads()
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)
