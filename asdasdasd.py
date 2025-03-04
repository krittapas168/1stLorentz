from lorentz import SerialPort, SerialReader, ALL_BAUD
import time

def select_serial_port(port):
    while True:
        port.refresh()
        all_ports = [(i, k) for i, k in enumerate(port.ports().keys(), start=1)]
        print('----- Serial Devices -----')
        for i, k in all_ports:
            print(f'[{i}]\t{k}')
        ui = input('Enter a number or type \'r\' to refresh\n').strip()
        if ui.isdigit() and 0 < int(ui) < len(all_ports) + 1:
            port_name = all_ports[int(ui) - 1][-1]
            return port_name

def select_baud_rate():
    while True:
        bu = input('Enter baud rate [Leave empty if 115200]\n').strip()
        if bu == '':
            return 115200
        elif bu in ALL_BAUD:
            return int(bu)
        else:
            print(f'Invalid baud rate. Available options: {ALL_BAUD}')

def read_serial_data(reader):
    """
    Reads data from the serial port using the SerialReader object.
    """
    reader.read()  # Read data from the serial port

    if reader.available():
        data = reader.get_message()
        if data:
            print(f'Received: {data}')
            return data
    else:
        print('No data available')
    return None

def main():
    port = SerialPort()
    port_name = select_serial_port(port)
    baud_rate = select_baud_rate()

    if not port.connect(port_name, baud_rate):
        print(f"Failed to connect to {port_name}")
        return

    reader = SerialReader(port=port, terminator='\n')

    try:
        while True:
            read_serial_data(reader)
            time.sleep(1)
    except KeyboardInterrupt:
        print("Interrupted by user")
    finally:
        port.disconnect()
        print(f"Disconnected from {port_name}")

if __name__ == '__main__':
    main()