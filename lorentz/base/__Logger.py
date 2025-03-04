import logging as _logging
import os

class LoggerBase:
    def __init__(self, target: str = 'main') -> None:
        if not os.path.exists("log/"):
            os.makedirs("log/")

        self.logger = _logging
        self.target = '[' + target.upper() + '] '
        self.logger.basicConfig(
            format='%(asctime)s\t[%(levelname)s]\tIn %(name)s\t%(message)s',
            datefmt='%d-%b-%y %H:%M:%S',
            level=self.logger.DEBUG,
            handlers=[
                self.logger.FileHandler(f'log/log_{target.upper()}.log',
                                        mode='a',
                                        encoding='utf-8'),
                self.logger.StreamHandler()
            ]
        )

    def debug(self, msg, *args, **kwargs) -> None:
        self.logger.debug(self.target + msg, *args, **kwargs)
        return

    def info(self, msg, *args, **kwargs) -> None:
        self.logger.info(self.target + msg, *args, **kwargs)
        return

    def warn(self, msg, *args, **kwargs) -> None:
        self.logger.warning(self.target + msg, *args, **kwargs)
        return

    def error(self, msg, *args, **kwargs) -> None:
        self.logger.error(self.target + msg, *args, **kwargs)
        return

    def critical(self, msg, *args, **kwargs) -> None:
        self.logger.critical(self.target + msg, *args, **kwargs)
        return

    def exception(self, msg, *args, **kwargs) -> None:
        self.logger.exception(self.target + msg, *args, **kwargs)
        return