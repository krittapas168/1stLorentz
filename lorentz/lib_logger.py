from .base.__Logger import LoggerBase

class Logger(LoggerBase):
    def __init__(self, target: str = 'main') -> None:
        super().__init__(target)
        