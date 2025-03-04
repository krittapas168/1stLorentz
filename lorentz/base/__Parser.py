from collections.abc import Iterable
from collections.abc import Sized


class ParserBase:
    def __init__(self,
                 data_format: Iterable[str] | Sized,
                 *args,
                 **kwargs):
        self.__data_format = data_format

    def parse(self, *args, **kwargs) -> dict:
        raise NotImplementedError

    def unparse(self, *args, **kwargs):
        raise NotImplementedError

    def validate_length(self, data: Sized):
        return len(data) == len(self.__data_format)

    def validate(self, data: dict):
        return (None not in data.values()) and self.validate_length(data)

    def make_blank(self):
        return {k: None for k in self.__data_format}

    @property
    def data_format(self):
        return self.__data_format

    @staticmethod
    def final_type(value) -> None | str | float | int:
        if value is None or value == '':
            return None
        try:
            if isinstance(value, int):
                return value
            if isinstance(value, float):
                return value
            if isinstance(value, str):
                if '.' in value:
                    return float(value)
                else:
                    return int(value)
            return value
        except ValueError:
            return value