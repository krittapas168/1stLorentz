import serial

ser = serial.Serial(port='COM7', baudrate=57600, timeout=1)

while True:
    if ser.in_waiting:
        try:
            data = ser.readline().decode('ascii', errors='ignore').strip() 
            print(f"Received: {data}")
        except UnicodeDecodeError as e:
            print(f"Decoding error: {e}")