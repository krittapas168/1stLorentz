import pandas as pd
import numpy as np
from collections.abc import Iterable
from collections import deque
import random
import time

from .base.__Logger import LoggerBase
_logger = LoggerBase('data')

class Queue:
    def __init__(self, max_size=None):
        """
        A deque wrapper for ease of use.
        It is thread-safe according to Python docs.

        The queue is simply a "buffer"
        """
        self.__queue = deque()
        self.__max_size = max_size

    def push(self, item):
        if self.__max_size and len(self.__queue) >= self.__max_size:
            # If the queue is full, remove the first (oldest) item to maintain FIFO behavior
            self.__queue.popleft()
            _logger.info("Queue full, removing oldest item to maintain FIFO")
        self.__queue.append(item)

    def pop(self):
        if self.__queue.__len__() == 0:
            return None
        return self.__queue.popleft()

    def front(self):
        if self.__queue.__len__() == 0:
            return None
        return self.__queue.__getitem__(0)

    def back(self):
        if self.__queue.__len__() == 0:
            return None
        return self.__queue.__getitem__(-1)

    def available(self):
        return self.__len__() > 0

    def __len__(self):
        return self.__queue.__len__()

    def __str__(self):
        return self.__queue.__str__()

    def __repr__(self):
        return self.__queue.__repr__()

    def __getitem__(self, index):
        return self.__queue.__getitem__(index)

    @property
    def data(self):
        return self.__queue


class Data:
    def __init__(self, data_or_header: dict | pd.DataFrame | Iterable = None, trim_len: int = None):
        """
        A wrapper class around Pandas DataFrame for ease of usage.
        Still, you can manipulate the DataFrame data directly.

        :param data_or_header: Data or header for creating the DataFrame.
        """
        if isinstance(data_or_header, dict) or isinstance(data_or_header, pd.DataFrame):
            try:
                self.__df = pd.DataFrame(data_or_header)
            except ValueError:
                self.__df = pd.DataFrame()
        elif isinstance(data_or_header, Iterable) and not isinstance(data_or_header, str):
            self.__df = pd.DataFrame(data_or_header)
        else:
            self.__df = pd.DataFrame({k: [] for k in data_or_header})

        self.__headers = self.__df.columns.values.tolist()
        self.__dim = self.__headers.__len__()

    def front(self) -> pd.Series:
        return self.__df.iloc[0]

    def back(self) -> pd.Series:
        return self.__df.iloc[-1]

    def push(self, data: dict):
        """
        Pushes a new row of data (represented as a dictionary) to the DataFrame.
        Data is expected as a dictionary where keys are column names.
        """
        self.__iadd__(data)

    def pop(self, n: int = -1):
        """
        Pops a row (or n rows) from the DataFrame.
        :param n: The index of the row to remove (defaults to last row).
        """
        self.__df.drop(self.__df.index[n], inplace=True)
        self.__df.reset_index(drop=True, inplace=True)
        self.__df = pd.DataFrame(data=self.__df.values, index=self.__df.index, columns=self.__df.columns)

    def pop_many(self, n: int):
        """
        Pops 'n' rows from the DataFrame.
        :param n: The number of rows to remove.
        """
        if n < 1:
            return
        n = min(n, self.__len__())
        for i in range(n):
            self.__df.drop(self.__df.index[-1], inplace=True)
        self.__df.reset_index(drop=True, inplace=True)
        self.__df = pd.DataFrame(data=self.__df.values, index=self.__df.index, columns=self.__df.columns)

    def available(self):
        return self.__len__() > 0

    def clear(self):
        """
        Clears all data from the DataFrame.
        """
        self.__df = pd.DataFrame(columns=self.__headers)

    def __getitem__(self, item):
        return self.__df.__getitem__(item)

    def __iadd__(self, other: dict):
        """
        Adds new data to the DataFrame.
        Data should be provided as a dictionary where keys are column names.
        """
        if isinstance(other, dict):
            row = [other.get(col, None) for col in self.__headers]
            self.__df.loc[self.__len__()] = row
        return self

    def __add__(self, other: dict):
        """
        Adds new data and returns a new Data object.
        """
        __data = Data(self.__df)
        __data.__iadd__(other)
        return __data

    def __len__(self):
        return self.__df.__len__()

    def __str__(self):
        return self.__df.__str__()

    def __repr__(self):
        return self.__df.__repr__()

    @property
    def df(self):
        return self.__df

    @property
    def headers(self):
        return self.__headers

    @property
    def dim(self):
        return self.__dim

    @property
    def size(self):
        """
        Returns DataFrame Row x Column.
        """
        return self.__len__(), self.__dim

    @df.setter
    def df(self, value: pd.DataFrame):
        self.__df = value

    @staticmethod
    def from_df(data: pd.DataFrame):
        return Data(data)

    def __copy__(self):
        return Data(self.__df)

    def copy(self):
        return self.__copy__()

class Test:
    @staticmethod
    def generate_data():
        data = {
            "counter_packet": random.randint(1, 1000),
            "timestamp": time.time(),
            "lidar": random.random(),
            "lat": random.uniform(-90, 90),
            "lon": random.uniform(-180, 180),
            "aceloX": random.uniform(-10, 10),
            "aceloY": random.uniform(-10, 10),
            "aceloZ": random.uniform(-10, 10),
            "specV": random.uniform(0, 1),
        }

        # Generate spec1 through spec288 dynamically
        for i in range(1, 289):
            data[f"spec{i}"] = random.uniform(0, 1)

        return data

def main():
    q = Queue(max_size=5)  # Set a maximum size for the queue
    data_store = Data(data_or_header=["counter_packet", "timestamp", "lidar", "lat", "lon", 
                                      "aceloX", "aceloY", "aceloZ", "specV"] + [f"spec{i}" for i in range(1, 289)])

    for _ in range(10):
        new_data = Test.generate_data()
        q.push(new_data)
        data_store.push(new_data)

        time.sleep(0.1)

        # Output the data at each step
        print(data_store.__len__())

if __name__ == '__main__':
    main() 