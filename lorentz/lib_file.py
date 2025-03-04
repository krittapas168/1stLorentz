import csv
import io
import os
import typing
import numpy as np
from collections.abc import Iterable

class FileUtil:
    @staticmethod
    def new_filename(filename: str):
        dpos = filename.rfind('.')
        idx = 0
        while os.path.isfile(fname := f'{filename[:dpos]}_{idx}.{filename[dpos + 1:]}'):
            idx += 1
        return fname
    
    @staticmethod
    def mkdir(dirname: str):
        """
        Make directory if not exist

        :param dirname: Directory name
        :return:
        """
        if not os.path.exists(dirname):
            os.makedirs(dirname)

    @staticmethod
    def blocks(file_object: typing.IO, size: int = 2 ** 16):
        """
        Lazy block read

        :param file_object: File object
        :param size: Block size
        :return:
        """
        while True:
            b = file_object.read(size)
            if not b:
                break
            yield b

    @staticmethod
    def line_count(file_object: typing.IO):
        """
        Lazy line counting

        :param file_object: File object
        :return: Number of lines in the file
        """
        return sum(bl.count('\n') for bl in FileUtil.blocks(file_object))
    
class FileWriter:
    count = 0
    def __init__(self,
                 folder_name: str= 'data',
                 save_name: str = 'sensor',
                 extension: str = 'csv',  
                 device_id: int | str = 0):
        self.device_id = str(device_id)
        self.folder_name = folder_name
        self.save_name = save_name
        self.extension = extension.strip('.')

        self._device = f'_device{self.device_id}'
        self.__postfix = f'_{self.save_name}{self._device}'

        self.name_csv_save = FileUtil.new_filename(
            self.data_path(f'data{self.__postfix}.{self.extension}')
        )
        self.name_raw_save = FileUtil.new_filename(
            self.data_path(f'data{self.__postfix}.raw')
        )
        
        FileUtil.mkdir(self.folder_name)
        FileWriter.count += 1
        
    def flatten_dict(self, data: dict, parent_key: str = '', sep: str = '_'):
        items = []
        for k, v in data.items():
                new_key = f"{parent_key}{sep}{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(self.flatten_dict(v, new_key, sep=sep).items())
                else:
                    items.append((new_key, v))
        return dict(items)

    def append_csv(self, data: dict | np.ndarray | list | tuple | Iterable, delimiter: str = ','):
        flattened_data = self.flatten_dict(data)
        row = list(flattened_data.values())

        file_exists = os.path.isfile(self.name_csv_save)

        with open(self.name_csv_save, mode='a', newline='') as file:
            writer = csv.writer(file, delimiter=delimiter)
            
            if not file_exists:
                header = list(flattened_data.keys())
                writer.writerow(header)  
            
            writer.writerow(row)

    def data_path(self, filename: str = None):
        """
        Returns absolute path of data folder or filename in data folder

        :param filename: File name
        :return: Absolute path
        """
        wd = os.getcwd()
        __path = os.path.join(wd, self.folder_name)
        if filename is not None:
            __path = os.path.join(wd, self.folder_name, filename)
        return str(__path)