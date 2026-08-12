from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    import logging

    response = exception_handler(exc, context)
    if response is not None:
        detail = response.data
        if isinstance(detail, dict) and "detail" in detail:
            message = detail["detail"]
        else:
            message = detail
        response.data = {
            "error": True,
            "status_code": response.status_code,
            "message": message,
            "details": detail if isinstance(detail, dict) else {"detail": detail},
        }
        return response
    logging.getLogger("django.request").exception("Unhandled API exception", exc_info=exc)
    return Response(
        {
            "error": True,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal server error",
            "details": {"detail": str(exc)},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
