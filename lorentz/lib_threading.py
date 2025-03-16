import time
from .base.__ThreadBase import ThreadBase
from .base.__SerialCommunication import SerialReader
from .lib_parser import Parser
from .lib_data import Queue
from .lib_logger import Logger
from .lib_file import FileWriter
from flask_socketio import SocketIO


class ThreadSerial(ThreadBase):
    def __init__(self,
                 parser: Parser,
                 reader: SerialReader,
                 queue: Queue,
                 socketio: SocketIO, 
                 interval: float = 0.500,
                 timeout: float = 4.000):
        self.__parser = parser
        self.__reader = reader
        self.__queue = queue
        self.__socketio = socketio  
        self.__interval = interval
        self.__logger =  Logger('THREAD_SERIAL')

        super().__init__(timeout)
        self.start()

    def _task(self):
        while self._on:
            self.__reader.read()
            if self.__reader.available():
                msg = self.__reader.get_message()
                print(msg) 
                print()
                if len(msg) > 0:
                    try:
                        parsed_msg = self.__parser.parse(msg)
                        self.__queue.push(parsed_msg)
                        self.send_to_frontend(parsed_msg)  
                    except ValueError as e:
                        self.__logger.error(e)

            time.sleep(self.__interval)

        self.__reader.read()
        while self.__reader.available():
            msg = self.__reader.get_message()
            if len(msg) > 0:
                try:
                    parsed_msg = self.__parser.parse(msg)
                    self.__queue.push(parsed_msg)

                except ValueError as e:
                    self.__logger.error(e)

    def send_to_frontend(self, data):
        """Emit telemetry data to frontend via Flask-SocketIO."""
        if self.__socketio:
            self.__socketio.emit('telemetry_data', data)

    def get_queue_data(self):
        """Retrieve all available data from the queue."""
        return [self.__queue.pop() for _ in range(self.__queue.size())]

    @property
    def queue(self):
        return self.__queue

    @property
    def _logger(self):
        return self.__logger


class TelemetryBroadcaster(ThreadBase):
    """Background thread that sends queue data to the frontend."""
    def __init__(self, queue: Queue, socketio: SocketIO, interval: float = 0.500):
        self.__queue = queue
        self.__socketio = socketio
        self.__interval = interval
        self.__logger = Logger(target='TELEMETRY_BROADCAST')

        super().__init__()
        self.start()

    def _task(self):
        self.__logger.info("Telemetry broadcast thread started.")
        while self._on:
            if self.__queue.available():
                data = self.__queue.peek()
                if data is not None:
                    self.__socketio.emit('telemetry_data', data)
            time.sleep(self.__interval)

        self._logger.info("Telemetry broadcast thread stopped.")


class ThreadFileWriter(ThreadBase):
    def __init__(self, 
                 file_writer: FileWriter,
                 queue_csv: Queue,
                 queue_raw: Queue = None,
                 interval: float = 0.500,
                 timeout: float = 4.000):
        self.__writer = file_writer
        self.__queue_csv = queue_csv
        self.__queue_raw = queue_raw or Queue()
        self.__interval = interval
        self.__logger = Logger(target='THREAD_FILE')

        super().__init__(timeout)
        self.start()

    def _task(self):
        self._logger.info("File writer thread task started.")
        while self.status:
            if self.__queue_csv.available():
                self.__writer.append_csv(self.__queue_csv.pop())

            if self.__queue_raw.available():
                self.__writer.append_csv(self.__queue_raw.pop())

            time.sleep(self.__interval)

        # Flush remaining data after stopping
        while self.__queue_csv.available():
            self.__writer.append_csv(self.__queue_csv.pop())

        self._logger.info("File writer thread task stopped.")

    @property
    def queue_csv(self):
        return self.__queue_csv

    @property
    def _logger(self):
        return self.__logger
