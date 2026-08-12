import json
import logging
import time
import uuid

from django.utils.deprecation import MiddlewareMixin


class RequestLoggingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request._start_time = time.monotonic()

    def process_response(self, request, response):
        duration_ms = int((time.monotonic() - getattr(request, "_start_time", time.monotonic())) * 1000)
        response["X-Request-ID"] = getattr(request, "request_id", "")
        logging.getLogger("aiviva.request").info(
            "request",
            extra={
                "request_id": getattr(request, "request_id", ""),
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "user_id": getattr(getattr(request, "user", None), "id", None),
            },
        )
        return response
