from lorentz import SerialPort, SerialReader, ALL_BAUD, StringParser, Data, Queue, FileUtil, FileWriter
import time
import threading

# INIT
data_queue = Queue()
file_writer = FileWriter(save_name="test_data", extension="csv")
dataFormat = ["Timestamp", "Name", "Age"]

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
            print(f'Received raw data: {data}')
            parsed_data = StringParser(data_format=dataFormat)
            data_queue.put(parsed_data)
    else:
        print('No data available')

def process_serial_data():
    """
    Processes data from the queue.
    Converts the data into a Data object and saves it using FileWriter.
    """
    while True:
        if not data_queue.empty():
            data = data_queue.get()
            print(f"Processing data: {data}")
            
            # Assume data is a list of values for simplicity
            data_object = Data([{'PacketNumber': data[0], 'Sensor1': data[1], 'Sensor2': data[2], 'Timestamp': data[3]}])
            
            # Save the processed data to CSV
            file_writer.append_csv(data_object.get_data().values[0])
        time.sleep(0.1)  # Add sleep to prevent busy-waiting

def main():
    port = SerialPort()
    port_name = select_serial_port(port)
    baud_rate = select_baud_rate()

    if not port.connect(port_name, baud_rate):
        print(f"Failed to connect to {port_name}")
        return

    reader = SerialReader(port=port, terminator='\n')

    # Start processing thread
    threading.Thread(target=process_serial_data, daemon=True).start()

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
