from .__Logger import LoggerBase
from .__SerialPort import SerialPort


class AbstractCommunication:
    def get_message(self, terminator: str = None) -> str:
        raise NotImplementedError()

    def read(self):
        raise NotImplementedError()

    def clear(self):
        raise NotImplementedError()

    def available(self) -> bool:
        raise NotImplementedError()


class SerialReader(AbstractCommunication):
    def __init__(self, port: SerialPort,
                 terminator: str = '\n',
                 encoding: str = 'ascii',
                 errors: str = 'ignore'):
        """
        SerialReader object for reading data from serial port.

        :param port: SerialPort object, not serial.Serial object!
        :param terminator: Terminator string to read each message, default is newline
        :param encoding: Encoding, default is "ascii"
        :param errors: Encoding errors handling, default is "ignore"
        """
        self.__port = port
        self.__encoding = {'encoding': encoding, 'errors': errors}
        self.__terminator = terminator.encode(**self.__encoding)
        self.__stream = b''
        self.__buffer = []
        self.__available = False
        self.__logger = LoggerBase(target='LOG_READER')

    def get_message(self, terminator: str = None) -> str:
        if terminator is None:
            terminator = self.__terminator
        else:
            terminator = terminator.encode(**self.__encoding)

        __idx = self.__stream.find(terminator)
        if __idx == -1:
            return ''
        __msg = self.__stream[:__idx]

        if len(__msg) == len(self.__stream):
            self.clear()
        else:
            self.__stream = self.__stream[__idx + 1:]

        # Remove Carriage Return
        if terminator == b'\n':
            __msg = __msg.replace(b'\r', b'')

        return __msg.decode(**self.__encoding)

    def read(self):
        self.__stream += self.__read()

    def clear(self):
        self.__stream = b''

    def __read(self) -> bytes:
        if not self.__port.is_connected():
            return b''
        try:
            __no_bytes = self.__port.device.in_waiting
            __byte = self.__port.device.read(__no_bytes)
            return __byte
        except OSError:
            self.__port.drop()
            return b''

    def available(self) -> bool:
        return len(self.__stream) > 0 and self.__stream.find(self.__terminator) != -1

    @property
    def port(self):
        return self.__port

    @property
    def stream(self):
        return self.__stream