from lorentz import ThreadSerial, SerialPort, SerialReader, Parser, Queue, ThreadFileWriter, FileWriter
from DataFormat import rx_data_format
import time

def main():
    serial_port = SerialPort()
    if not serial_port.connect('COM5', 9600):
        print("Failed to connect to COM5.")
        return  

    serial_reader = SerialReader(serial_port)
    parser = Parser(rx_data_format)
    queue = Queue()
    file_writer = FileWriter(folder_name='test', save_name='test')

    thread_serial = ThreadSerial(parser=parser, reader=serial_reader, queue=queue)
    thread_file = ThreadFileWriter(file_writer, queue)

    print("ThreadSerial started. Reading data...")

    try:
        while True:
            if queue.available:
                time.sleep(1)
                
    except KeyboardInterrupt:
        print("Stopping ThreadSerial...")

    finally:
        thread_serial.stop()
        print("ThreadSerial stopped.")

if __name__ == '__main__':
    main()
