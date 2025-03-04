from .base.__SerialPort import SerialPort
from .base.__SerialCommunication import SerialReader

ALL_BAUD = (1200, 2400, 9600, 19200, 57600, 115200, 230400, 460800, 921600)

ALL_BAUD_STR = tuple(str(e) for e in ALL_BAUD)