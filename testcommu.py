from lorentz import SerialPort, SerialReader

def main():
    serial_port = SerialPort()
    serial_port.connect('COM5', 9600)
    print(serial_port.port_pair)
    serial_reader = SerialReader(serial_port)

    while True:
        serial_reader.read() 
        if serial_reader.available():
            message = serial_reader.get_message() 
            print(f"Received: {message}")
    

if __name__ == '__main__':
    main()