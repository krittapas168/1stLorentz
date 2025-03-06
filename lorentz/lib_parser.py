from collections.abc import Iterable
from collections.abc import Sized
import re
from typing import Dict, Any, Optional, List
import datetime

from .lib_logger import Logger

# DONT FORGET ABOUT ADDING LOG FOR SOME INSUCESSFULLY PARSE
# DONT FORGET ABOUT ADDING LOG FOR SOME INSUCESSFULLY PARSE
# DONT FORGET ABOUT ADDING LOG FOR SOME INSUCESSFULLY PARSE

data_format = {           
            "counter": 1,
            "lidatlitev3": 1,
            "lat": 1,
            "lon": 1,
            "acceloX": 1,
            "acceloY": 1,
            "acceloZ": 1,
            "spectrometer": 28
            }

class Parser:
    def __init__(self,
                 data_format: Iterable[str, int] | Sized,
                 delimiter: str = ',',
                 header: str = None,
                 tail: str = None,
                 *args,
                 **kwargs) -> None:
        
        self.__data_format = data_format
        self.__total_length = sum(self.__data_format.values())
        self.__delimiter = delimiter
        self.__header = header
        self.__tail = tail

        self.__logger = Logger('PARSER')

    def parse(self, data:str) -> dict[str, any]:
        if self.__header is None:
            return self.__parse_delim_only(data)
        if self.__tail is None:
            return self.__parse_with_header(data) 
        return self.__parse_with_tail(data)
    
    def unparse(self, data: dict):
        """
        Parse the data according to the preset, handling sub-dictionaries and lists.
        This will return the raw values without keys.

        :param data: The data dictionary to unparse.
        :return: The parsed string with just values.
        """
        __data_dict = self.make_blank()
        __data_dict.update(data)

        flattened_data = []
        for value in __data_dict.values():
            if isinstance(value, dict):
                flattened_data.extend([str(sub_value) for sub_value in value.values() if sub_value is not None])
            elif isinstance(value, list):
                flattened_data.extend([str(item) for item in value if item is not None])
            else:
                flattened_data.append(str(value) if value is not None else '')

        __payload = (self.__delimiter + ' ').join(flattened_data)

        if self.__header is None:
            return __payload
        if self.__tail is None:
            return self.__header + __payload
        return self.__header + __payload + self.__tail


    def __remove_consecutive_delimiter(self, __data: str):
        pattern = re.escape(self.__delimiter) + '+'
        return re.sub(pattern, self.__delimiter, __data)
    
    def __parse_delim_only(self, __data: str):
        data_cleaned = self.__remove_consecutive_delimiter(__data)
        data_list = data_cleaned.split(self.__delimiter)
        
        data_dict = {}
        index = 0

        for field, length in self.__data_format.items():
            if length == 1:
                if field == "timestamp":
                    # Do not consume a token for "timestamps" --
                    # instead, assign the current real time.
                    data_dict[field] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                else:
                    data_dict[field] = self.__parse_value(data_list[index])
                    index += 1
            else:
                data_dict[field] = {
                    f"{field}{i + 1}": self.__parse_value(data_list[index + i])
                    for i in range(length)
                }
                index += length  

        return data_dict
    
    def __parse_with_header(self, data: str) -> Dict[str, Any]:
        """
        Parse data that contains a header and delimited values.

        Args:
            data: The input string.

        Returns:
            A dictionary with parsed data.
        """
        if not data.startswith(self.__header):
            raise ValueError("Data does not start with the expected header")
        data_cleaned = data[len(self.__header):]
        return self.__parse_delim_only(data_cleaned)

    def __parse_with_tail(self, data: str) -> Dict[str, Any]:
        """
        Parse data that contains a header, delimited values, and a tail.

        Args:
            data: The input string.

        Returns:
            A dictionary with parsed data.
        """
        if not data.startswith(self.__header) or not data.endswith(self.__tail):
            raise ValueError("Data does not match the expected header and tail")
        data_cleaned = data[len(self.__header):-len(self.__tail)]
        return self.__parse_delim_only(data_cleaned)

    def make_blank(self) -> Dict[str, Any]:
        """
        Create a blank data structure based on the format.

        Returns:
            A dictionary with all fields initialized to None or empty lists.
        """
        blank = {}
        for field, length in self.__data_format.items():
            if length == 1:
                blank[field] = None
            else:
                blank[field] = [None] * length
        return blank

    @staticmethod
    def __parse_value(value: str) -> Optional[float]:
        """
        Convert a string value to the appropriate type.

        Args:
            value: The string value to parse.

        Returns:
            The parsed value (float or None).
        """
        if value is None or value == '':
            return None
        try:
            return float(value)
        except ValueError as e :
            return None

    @property
    def data_format(self) -> Dict[str, int]:
        """Get the data format specification."""
        return self.__data_format

    @property
    def total_length(self) -> int:
        """Get the total number of data points expected."""
        return self.__total_length