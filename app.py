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
_SerialReader = SerialReader(_SerialPort)
_parser = Parser(rx_data_format)
_queue = Queue()

_thread_serial = None
_thread_file_writer = None
_telemetry_broadcaster = None

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

previous_ports = []
def monitor_ports():
    global previous_ports
    while True:
        _SerialPort.refresh()
        current_ports = _SerialPort.ports()
        if current_ports != previous_ports:
            socketio.emit('receive_ports', current_ports)
            previous_ports = current_ports
        time.sleep(1)

# -------------------- SOCKETIO EVENTS --------------------
@socketio.on('connect_serial')
def connect_serial(data):
    global _thread_serial, _telemetry_broadcaster, _thread_file_writer

    port, baud = data.get('port'), data.get('baud')
    if not port or not baud:
        return socketio.emit('serial_connected', {'status': False, 'message': 'Invalid port or baud rate'})

    try:
        if _SerialPort.connect(port, baud):
            # Start telemetry reading
            _thread_serial = ThreadSerial(parser=_parser, reader=_SerialReader, queue=_queue, socketio=socketio)
            _thread_serial.start()

            # Start telemetry broadcasting
            _telemetry_broadcaster = TelemetryBroadcaster(queue=_queue, socketio=socketio)
            _telemetry_broadcaster.start()

            # Start file writing
            file_writer = FileWriter(folder_name='telemetry_logs', save_name='telemetry')
            _thread_file_writer = ThreadFileWriter(file_writer, _queue)
            _thread_file_writer.start()

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
