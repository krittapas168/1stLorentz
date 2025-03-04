import threading
from .__Logger import LoggerBase


class ThreadBase:
    def __init__(self, timeout: float = 1.000):
        self._on = False
        self._timeout = timeout
        self._thread: threading.Thread | None = None

    def start(self):
        self._setup_thread()
        self._logger.info('Thread is started!')

    def stop(self):
        self._destroy_thread()
        self._logger.info('Thread is stopped and destroyed!')

    def _setup_thread(self):
        self._on = True
        self._thread = threading.Thread(
            target=self._task, daemon=True
        )
        self._thread.start()

    def _destroy_thread(self):
        if isinstance(self._thread, threading.Thread):
            self._on = False
            self._thread.join(timeout=self._timeout)
            self._thread = None

    def _task(self):
        raise NotImplementedError()

    def __del__(self):
        if self._thread and self._thread is not threading.current_thread():
            self._destroy_thread()
            
    @property
    def status(self):
        return self._on

    @property
    def _logger(self) -> LoggerBase:
        raise NotImplementedError()

    @property
    def thread(self):
        return self._thread