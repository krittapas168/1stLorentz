from lorentz import Parser

data_format = {
    "timestamps": 1,
    "counter": 1,
    "lidatlitev3": 1,
    "lat": 1,
    "lon": 1,
    "acceloX": 1,
    "acceloY": 1,
    "acceloZ": 1,
    "spectrometer": 28
}

if __name__ == "__main__":
    parser = Parser(data_format)
    test_data = "1234567890,1,0.123,13.7563,100.5018,0.1,0.2,9.8," + ",".join(str(i) for i in range(28))
    parsed = parser.parse(test_data)
    print("Parsed Data:", parsed)
    
    unparsed = parser.unparse(parsed)
    print("Unparsed Data:", unparsed)
