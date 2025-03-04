import time
from lorentz import SerialPort, SerialReader, Logger

def main():
    logger = Logger(target='LOG_MAIN')
    serial_port = SerialPort()

    port_name = input("Enter device name: ").strip()
    if serial_port.connect(port_name, 9600):
        logger.info(f"Connected to {port_name}")
        serial_reader = SerialReader(port=serial_port, terminator='\r\n')

        try:
            while True:
                serial_reader.read()
                if serial_reader.available():
                    message = serial_reader.get_message()
                    logger.info(f"Received message: {message}")

                time.sleep(0.1)
        except KeyboardInterrupt:
            logger.info("Stopped by user.")
        finally:
            serial_port.disconnect()
            logger.info("Disconnected.")

if __name__ == "__main__":
    main()
