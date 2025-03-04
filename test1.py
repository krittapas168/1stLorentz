import time
from lorentz import SerialPort
from lorentz import SerialReader
from lorentz import Logger

def main():
    # Initialize logger
    logger = Logger(target='LOG_MAIN')

    # Create SerialPort instance
    serial_port = SerialPort()

    # Refresh available ports and print
    serial_port.refresh()

    # Connect to a device (use the correct port name)
    device_name = input("Enter device name to connect to: ").strip()
    if serial_port.connect(device_name):
        logger.info(f"Connected to {device_name}")

        serial_reader = SerialReader(port=serial_port)

        try:
            while True:
                serial_reader.read()

                if serial_reader.available():
                    message = serial_reader.get_message()
                    logger.info(f"Received message: {message}")

                time.sleep(0.1)
        except KeyboardInterrupt:
            logger.info("Program terminated by user.")
        finally:
            serial_port.disconnect()
            logger.info("Disconnected from serial device.")

if __name__ == "__main__":
    main()
