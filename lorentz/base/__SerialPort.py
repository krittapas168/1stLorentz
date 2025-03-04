import threading
import time
import serial
import serial.tools.list_ports
from .__CustomException import NoDeviceFoundException
from .__Logger import LoggerBase

from flask_socketio import SocketIO
socketio = SocketIO() 

class SerialPort:
    def __init__(self):
        self.__device: serial.Serial | None = None
        self.__name: str | None = None
        self.__baud = 115200
        self.__port_pair = self.ports()
        self.__logger = LoggerBase(target='LOG_SERIAL')
        self.__thread_reconnect: threading.Thread | None = None
        self.__flag_reconnect = False
        self.__is_reconnecting = False

    def refresh(self):
        """
        Refresh port list

        :return:
        """
        self.__port_pair = self.ports()

    def connect(self, name: str, baud: int | str = 115200,
                auto_reconnect: bool = True, override: bool = False,
                attempt_reconnect: bool = False) -> bool:
        """
        Connect the device

        :param name: device name (directory)
        :param baud: baud rate
        :param auto_reconnect: Auto reconnect or not
        :param override: Override name checking
        :param attempt_reconnect: Is this connection attempt to reconnect? to suppress warnings
        :return: Connection successful or not
        """

        name = name.strip()
        if not override:
            try:
                if '(' in name and ')' in name:
                    if name not in self.__port_pair:
                        raise NoDeviceFoundException(f'No device named "{name}"!')
                    __name = self.__port_pair[name]
                else:
                    if name not in self.__port_pair.values():
                        raise NoDeviceFoundException(f'No device named "{name}"!')
                    __name = name
            except NoDeviceFoundException:
                if not attempt_reconnect:
                    self.__logger.warn('Device not found!')
                return False
        else:
            __name = name

        if isinstance(self.__device, serial.Serial) and not attempt_reconnect:
            self.__logger.info(f'Clearing connection from "{self.__name}" before connecting "{name}".')
            self.disconnect()

        self.__name = __name
        self.__baud = int(baud)

        try:
            self.__device = serial.Serial(self.__name, baudrate=self.__baud, timeout=2)
            self.__logger.info(f'Device "{self.__name}" is successfully connected with baud rate {self.__baud}.')
            try:
                if not self.__device.is_open:
                    self.__device.open()
                if auto_reconnect:
                    self.__setup_auto_reconnect()
                return True
            except serial.SerialException:
                self.__logger.exception(
                    f'Unexpected Error! Can\'t open port "{__name}".'
                )
        except serial.SerialException or FileNotFoundError:
            if not attempt_reconnect:
                self.__logger.exception(
                    f'Unexpected Error! Can\'t connect port "{__name}" or the port is already connected.'
                )
        self.__device = None
        return False

    def disconnect(self, *, destructor=False):
        """
        Disconnect the device

        :return:
        """
        if not destructor:
            if not isinstance(self.__device, serial.Serial):
                self.__logger.critical('The port has not been initialized.')
            elif self.__device.is_open:
                self.__destroy_auto_reconnect()
                self.__device.close()
                self.__device = None
                self.__logger.info(f'"{self.__name}" has been successfully closed!')
            else:
                self.__logger.warn(f'"{self.__name}" has already been disconnected!')
        else:
            if not isinstance(self.__device, serial.Serial):
                return
            self.__destroy_auto_reconnect()
            self.__device.close()
            self.__device = None
            self.__logger.info(f'"{self.__name}" has been successfully closed!')

    def is_connected(self) -> bool:
        """
        Check if the device is connected

        :return:
        """
        return isinstance(self.__device, serial.Serial) and self.__device.is_open

    def print_ports(self):
        """
        Print ports list with number

        :return:
        """
        for i, (k, v) in enumerate(self.__port_pair, start=1):
            print(f'[{i}] {v} ({k})')

    def reset(self):
        """
        Reset hardware port (clear connection and reinitializing)

        :return:
        """
        self.disconnect()
        self.__init__()

    def drop(self):
        """
        **DANGER!** Drop the port, for internal usage. Do not use.

        :return:
        """
        self.__device = None

    def __setup_auto_reconnect(self):
        self.__flag_reconnect = True
        self.__thread_reconnect = threading.Thread(
            target=self.__try_reconnect, daemon=True
        )
        self.__thread_reconnect.start()

    def __destroy_auto_reconnect(self):
        if isinstance(self.__thread_reconnect, threading.Thread):
            self.__flag_reconnect = False
            self.__thread_reconnect.join()
            self.__thread_reconnect = None

    def __try_reconnect(self):
        result = True
        attempt_no = 20
        while self.__flag_reconnect:
            if not self.is_connected():
                self.__is_reconnecting = True
                self.__logger.warn(f'Attempting to reconnect "{self.__name}"...')
                try:
                    for i in range(attempt_no):
                        result = self.connect(self.__name, self.__baud,
                                              auto_reconnect=False,
                                              attempt_reconnect=True)
                        if result:
                            break
                        time.sleep(2.000 / attempt_no)
                except serial.SerialException or FileNotFoundError:
                    pass
            if result:
                time.sleep(0.100)
            else:
                time.sleep(2.000)

    def __del__(self):
        """
        Disconnect and stop event when destructor is called.

        :return:
        """
        self.disconnect(destructor=True)

    @property
    def port_pair(self):
        return self.__port_pair

    @property
    def device(self):
        """
        Serial device object

        :return: Serial device object
        """
        return self.__device

    @staticmethod
    def ports():
        """
        Returns all available ports in dictionary with full name as key
        and true device name as value. Used for referencing user inputs.

        :return: Dictionary of device full name : device true name
        """
        __port_name = dict()
        __port_infos = serial.tools.list_ports.comports()
        for port_iter in __port_infos:
            __name = f'{str(port_iter.device)} ({str(port_iter.manufacturer)} {str(port_iter.product)})'
            __port_name[__name] = port_iter.device
        return __port_name