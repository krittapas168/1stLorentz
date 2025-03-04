from lorentz import Parser
from lorentz import FileWriter
from DataFormat import rx_data_format

parser = Parser(rx_data_format)
file_writer = FileWriter(folder_name='test', save_name='sensor', device_id='555')

raw_data = "1,2,3,4,5,6,7,8," + ",".join(str(i) for i in range(288))

parsed = parser.parse(raw_data)

print(parsed)
file_writer.append_csv(parsed)

reconstructed = parser.unparse(parsed)
print("\nReconstructed Data:")
print(reconstructed)

try:
    parser.parse("INVALID:1,2.5,37.7749,-122.4194,0.1,0.2,0.3," + ",".join(str(i) for i in range(200)) + ":END")
except ValueError as e:
    print("\nError:", str(e))