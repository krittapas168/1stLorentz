from lorentz import StringParser

def main():
    data_format = ["counter", "lidar", "spectrometer", "lat", "lon"]
    parser = StringParser(data_format)
    raw_data = "1,150,512,634,890,1023,1205,1502,785,654,512,13.4050,52.5200"

    parsed_data = parser.parse(raw_data)
    print(parsed_data)

if __name__ == '__main__':
    main()