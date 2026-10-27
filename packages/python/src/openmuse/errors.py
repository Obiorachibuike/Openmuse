from typing import Optional

class OpenMuseError(Exception):
    """Base error raised by the OpenMuse SDK."""


class OpenMuseAPIError(OpenMuseError):
    def __init__(self, message: str, status: int, code: Optional[str] = None,
                 request_id: Optional[str] = None, retry_after: Optional[int] = None,
                 error_type: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id
        self.retry_after = retry_after
        self.type = error_type


class OpenMuseRateLimitError(OpenMuseAPIError):
    """The service rejected this request due to rate limiting."""


class OpenMuseTimeoutError(OpenMuseError):
    """The request exceeded the configured timeout."""


class OpenMuseConnectionError(OpenMuseError):
    """The SDK could not connect to OpenMuse."""
