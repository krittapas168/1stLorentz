import csv
import io

data = {
    'Counter': 1.0, 'LidarLiteV3': 2.0, 'AccelerometerX': 3.0, 'AccelerometerY': 4.0, 'AccelerometerZ': 5.0, 
    'Latitude': 6.0, 'Longitude': 7.0, 'SpectrometerVoltage': 8.0, 
    'Spectrometer': {f'Spectrometer{i}': float(i-1) for i in range(1, 289)}
}

# Prepare CSV data
output = io.StringIO()
csv_writer = csv.writer(output)

# Write headers
headers = list(data.keys())[:-1] + list(data['Spectrometer'].keys())
csv_writer.writerow(headers)

# Write values
values = list(data.values())[:-1] + list(data['Spectrometer'].values())
csv_writer.writerow(values)

# Get CSV string
csv_string = output.getvalue()
output.close()

csv_string
