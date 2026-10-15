from __future__ import annotations

import asyncio
from collections.abc import Iterable

import pytest

from backend.upload_limits import UploadRequestSizeLimitMiddleware


def make_scope(headers: Iterable[tuple[bytes, bytes]] = ()) -> dict[str, object]:
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/documents/upload",
        "raw_path": b"/documents/upload",
        "query_string": b"",
        "root_path": "",
        "headers": list(headers),
        "server": ("testserver", 80),
        "client": ("testclient", 123),
    }


def run_middleware(
    middleware: UploadRequestSizeLimitMiddleware,
    messages: list[dict[str, object]],
    headers: Iterable[tuple[bytes, bytes]] = (),
) -> tuple[list[dict[str, object]], list[bytes], int]:
    sent: list[dict[str, object]] = []
    received_messages = iter(messages)
    receive_calls = 0
    inner_body: list[bytes] = []

    async def receive() -> dict[str, object]:
        nonlocal receive_calls
        receive_calls += 1
        try:
            return next(received_messages)
        except StopIteration:
            return {"type": "http.disconnect"}

    async def send(message: dict[str, object]) -> None:
        sent.append(message)

    async def inner_app(scope, app_receive, app_send) -> None:
        while True:
            message = await app_receive()
            if message["type"] == "http.disconnect":
                break
            inner_body.append(message.get("body", b""))
            if not message.get("more_body", False):
                break
        await app_send({"type": "http.response.start", "status": 200, "headers": []})
        await app_send({"type": "http.response.body", "body": b"ok", "more_body": False})

    middleware.app = inner_app
    asyncio.run(middleware(make_scope(headers), receive, send))
    return sent, inner_body, receive_calls


def test_rejects_oversized_request_early_from_content_length() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=8,
        spool_memory_size_bytes=4,
    )
    sent, inner_body, receive_calls = run_middleware(
        middleware,
        [{"type": "http.request", "body": b"not consumed", "more_body": False}],
        headers=[(b"content-length", b"9")],
    )

    assert sent[0]["status"] == 413
    assert inner_body == []
    assert receive_calls == 0


def test_rejects_oversized_stream_without_content_length_and_closes_spool(monkeypatch) -> None:
    import backend.upload_limits as upload_limits

    spools = []
    original_factory = upload_limits.SpooledTemporaryFile

    def tracking_factory(*args, **kwargs):
        spool = original_factory(*args, **kwargs)
        spools.append(spool)
        return spool

    monkeypatch.setattr(upload_limits, "SpooledTemporaryFile", tracking_factory)
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=8,
        spool_memory_size_bytes=4,
    )
    sent, inner_body, receive_calls = run_middleware(
        middleware,
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"67890", "more_body": False},
        ],
    )

    assert sent[0]["status"] == 413
    assert inner_body == []
    assert receive_calls == 2
    assert len(spools) == 1 and spools[0].closed


def test_actual_stream_length_wins_over_understated_content_length() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=8,
        spool_memory_size_bytes=4,
    )
    sent, inner_body, receive_calls = run_middleware(
        middleware,
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"67890", "more_body": False},
        ],
        headers=[(b"content-length", b"1")],
    )

    assert sent[0]["status"] == 413
    assert inner_body == []
    assert receive_calls == 2


def test_under_limit_request_is_replayed_in_bounded_chunks() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=8,
        spool_memory_size_bytes=4,
        replay_chunk_size_bytes=3,
    )
    sent, inner_body, _ = run_middleware(
        middleware,
        [
            {"type": "http.request", "body": b"12345", "more_body": True},
            {"type": "http.request", "body": b"678", "more_body": False},
        ],
    )

    assert sent[0]["status"] == 200
    assert b"".join(inner_body) == b"12345678"
    assert max(len(chunk) for chunk in inner_body) <= 3


def test_cancelled_request_closes_body_spool(monkeypatch) -> None:
    import backend.upload_limits as upload_limits

    spools = []
    original_factory = upload_limits.SpooledTemporaryFile

    def tracking_factory(*args, **kwargs):
        spool = original_factory(*args, **kwargs)
        spools.append(spool)
        return spool

    monkeypatch.setattr(upload_limits, "SpooledTemporaryFile", tracking_factory)
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=16,
        spool_memory_size_bytes=4,
    )
    first_chunk_received = asyncio.Event()
    second_receive_started = asyncio.Event()

    async def receive() -> dict[str, object]:
        if not first_chunk_received.is_set():
            first_chunk_received.set()
            return {"type": "http.request", "body": b"12345", "more_body": True}
        second_receive_started.set()
        await asyncio.Future()

    async def send(_: dict[str, object]) -> None:
        return None

    async def cancel_middleware() -> None:
        task = asyncio.create_task(middleware(make_scope(), receive, send))
        await second_receive_started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(cancel_middleware())

    assert len(spools) == 1
    assert spools[0].closed


def test_spool_close_failure_does_not_mask_application_error(monkeypatch) -> None:
    import backend.upload_limits as upload_limits

    underlying_spools = []
    original_factory = upload_limits.SpooledTemporaryFile

    class CloseFailingSpool:
        def __init__(self, spool) -> None:
            self._spool = spool
            underlying_spools.append(spool)

        def __getattr__(self, name: str):
            return getattr(self._spool, name)

        def close(self) -> None:
            self._spool.close()
            raise OSError("synthetic spool close failure")

    monkeypatch.setattr(
        upload_limits,
        "SpooledTemporaryFile",
        lambda *args, **kwargs: CloseFailingSpool(original_factory(*args, **kwargs)),
    )
    middleware = UploadRequestSizeLimitMiddleware(app=None, max_request_size_bytes=16)

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"body", "more_body": False}

    async def send(_: dict[str, object]) -> None:
        return None

    async def failing_app(scope, app_receive, app_send) -> None:
        raise RuntimeError("synthetic processing failure")

    middleware.app = failing_app

    with pytest.raises(RuntimeError, match="synthetic processing failure"):
        asyncio.run(middleware(make_scope(), receive, send))

    assert len(underlying_spools) == 1
    assert underlying_spools[0].closed


def test_concurrent_upload_limit_rejects_excess_and_releases_after_completion() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=32,
        max_concurrent_uploads=1,
    )
    entered_processing = asyncio.Event()
    allow_first_to_finish = asyncio.Event()
    app_calls = 0

    async def inner_app(scope, app_receive, app_send) -> None:
        nonlocal app_calls
        app_calls += 1
        await app_receive()
        if app_calls == 1:
            entered_processing.set()
            await allow_first_to_finish.wait()
        await app_send({"type": "http.response.start", "status": 200, "headers": []})
        await app_send({"type": "http.response.body", "body": b"ok", "more_body": False})

    middleware.app = inner_app

    async def exercise_concurrency() -> None:
        first_sent: list[dict[str, object]] = []
        second_sent: list[dict[str, object]] = []
        third_sent: list[dict[str, object]] = []
        second_receive_calls = 0

        async def receive_body() -> dict[str, object]:
            return {"type": "http.request", "body": b"data", "more_body": False}

        async def second_receive() -> dict[str, object]:
            nonlocal second_receive_calls
            second_receive_calls += 1
            return await receive_body()

        async def send_to(messages: list[dict[str, object]], message: dict[str, object]) -> None:
            messages.append(message)

        first_task = asyncio.create_task(
            middleware(
                make_scope(),
                receive_body,
                lambda message: send_to(first_sent, message),
            )
        )
        await entered_processing.wait()

        await middleware(
            make_scope(),
            second_receive,
            lambda message: send_to(second_sent, message),
        )
        assert second_sent[0]["status"] == 429
        assert "Too many uploads" in second_sent[1]["body"].decode()
        assert second_receive_calls == 0

        allow_first_to_finish.set()
        await first_task
        assert first_sent[0]["status"] == 200

        await middleware(
            make_scope(),
            receive_body,
            lambda message: send_to(third_sent, message),
        )
        assert third_sent[0]["status"] == 200
        assert app_calls == 2

    asyncio.run(exercise_concurrency())


def test_cancelled_upload_releases_concurrency_permit() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=32,
        max_concurrent_uploads=1,
    )
    entered_processing = asyncio.Event()
    app_calls = 0

    async def inner_app(scope, app_receive, app_send) -> None:
        nonlocal app_calls
        app_calls += 1
        await app_receive()
        if app_calls == 1:
            entered_processing.set()
            await asyncio.Future()
        await app_send({"type": "http.response.start", "status": 200, "headers": []})
        await app_send({"type": "http.response.body", "body": b"ok", "more_body": False})

    middleware.app = inner_app

    async def exercise_cancellation() -> None:
        async def receive_body() -> dict[str, object]:
            return {"type": "http.request", "body": b"data", "more_body": False}

        first_task = asyncio.create_task(
            middleware(make_scope(), receive_body, lambda _: asyncio.sleep(0))
        )
        await entered_processing.wait()
        first_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first_task

        second_sent: list[dict[str, object]] = []
        await middleware(
            make_scope(),
            receive_body,
            lambda message: _append_message(second_sent, message),
        )
        assert second_sent[0]["status"] == 200
        assert app_calls == 2

    asyncio.run(exercise_cancellation())


def test_processing_exception_releases_concurrency_permit() -> None:
    middleware = UploadRequestSizeLimitMiddleware(
        app=None,
        max_request_size_bytes=32,
        max_concurrent_uploads=1,
    )
    app_calls = 0

    async def inner_app(scope, app_receive, app_send) -> None:
        nonlocal app_calls
        app_calls += 1
        await app_receive()
        if app_calls == 1:
            raise RuntimeError("synthetic parser failure")
        await app_send({"type": "http.response.start", "status": 200, "headers": []})
        await app_send({"type": "http.response.body", "body": b"ok", "more_body": False})

    middleware.app = inner_app

    async def exercise_exception() -> None:
        async def receive_body() -> dict[str, object]:
            return {"type": "http.request", "body": b"data", "more_body": False}

        with pytest.raises(RuntimeError, match="synthetic parser failure"):
            await middleware(make_scope(), receive_body, lambda _: asyncio.sleep(0))

        response: list[dict[str, object]] = []
        await middleware(
            make_scope(),
            receive_body,
            lambda message: _append_message(response, message),
        )
        assert response[0]["status"] == 200
        assert app_calls == 2

    asyncio.run(exercise_exception())


async def _append_message(messages: list[dict[str, object]], message: dict[str, object]) -> None:
    messages.append(message)
