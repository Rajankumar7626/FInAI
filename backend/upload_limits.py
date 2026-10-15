from __future__ import annotations

import sys
from tempfile import SpooledTemporaryFile
from threading import BoundedSemaphore
from typing import Any

from starlette.responses import JSONResponse


class UploadRequestSizeLimitMiddleware:
    def __init__(
        self,
        app: Any,
        *,
        max_request_size_bytes: int,
        max_concurrent_uploads: int = 10,
        spool_memory_size_bytes: int = 64 * 1024,
        replay_chunk_size_bytes: int = 64 * 1024,
    ) -> None:
        if max_concurrent_uploads < 1:
            raise ValueError("Maximum concurrent uploads must be positive.")
        self.app = app
        self.max_request_size_bytes = max_request_size_bytes
        self.spool_memory_size_bytes = spool_memory_size_bytes
        self.replay_chunk_size_bytes = replay_chunk_size_bytes
        self._upload_slots = BoundedSemaphore(max_concurrent_uploads)

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if not (
            scope.get("type") == "http"
            and scope.get("method") == "POST"
            and scope.get("path") == "/documents/upload"
        ):
            await self.app(scope, receive, send)
            return

        if not self._upload_slots.acquire(blocking=False):
            await self._reject_concurrency(scope, receive, send)
            return

        body_spool = None
        try:
            content_length = self._content_length(scope)
            if content_length is not None and content_length > self.max_request_size_bytes:
                await self._reject_size(scope, receive, send)
                return

            body_spool = SpooledTemporaryFile(
                max_size=self.spool_memory_size_bytes,
                mode="w+b",
            )
            body_size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                if message["type"] != "http.request":
                    continue

                chunk = message.get("body", b"")
                body_size += len(chunk)
                if body_size > self.max_request_size_bytes:
                    await self._reject_size(scope, receive, send)
                    return
                body_spool.write(chunk)
                if not message.get("more_body", False):
                    break

            body_spool.seek(0)
            remaining = body_size
            final_body_sent = False

            async def replay_receive() -> dict[str, Any]:
                nonlocal remaining, final_body_sent
                if remaining:
                    chunk = body_spool.read(min(self.replay_chunk_size_bytes, remaining))
                    remaining -= len(chunk)
                    more_body = remaining > 0
                    if not more_body:
                        final_body_sent = True
                    return {
                        "type": "http.request",
                        "body": chunk,
                        "more_body": more_body,
                    }
                if not final_body_sent:
                    final_body_sent = True
                    return {"type": "http.request", "body": b"", "more_body": False}
                return await receive()

            await self.app(scope, replay_receive, send)
        finally:
            active_exception = sys.exception()
            cleanup_error: BaseException | None = None
            if body_spool is not None:
                try:
                    body_spool.close()
                except BaseException as exc:
                    cleanup_error = exc
            self._upload_slots.release()
            if active_exception is None and cleanup_error is not None:
                raise cleanup_error

    @staticmethod
    def _content_length(scope: dict[str, Any]) -> int | None:
        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    return int(value)
                except ValueError:
                    return None
        return None

    async def _reject_size(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": (
                    "Upload request exceeds the configured size limit "
                    f"of {self.max_request_size_bytes} bytes."
                )
            },
        )
        await response(scope, receive, send)

    async def _reject_concurrency(
        self,
        scope: dict[str, Any],
        receive: Any,
        send: Any,
    ) -> None:
        response = JSONResponse(
            status_code=429,
            content={
                "detail": "Too many uploads are being processed. Please retry shortly."
            },
        )
        await response(scope, receive, send)
