import pytest

from app.bambu_api import get_username
from app.errors import AuthError, UpstreamError


class FakeResponse:
    def __init__(self, status_code, json_body=None):
        self.status_code = status_code
        self._json = json_body or {}

    def json(self):
        return self._json


class FakeSession:
    def __init__(self, status_code, json_body=None):
        self.status_code = status_code
        self.json_body = json_body
        self.calls = []

    def get(self, url, headers=None, timeout=None):
        self.calls.append((url, headers, timeout))
        return FakeResponse(self.status_code, self.json_body)


def test_401_raises_auth_error():
    session = FakeSession(401)
    with pytest.raises(AuthError):
        get_username("tok-401", session=session, ttl=0)


def test_403_raises_upstream_error_not_auth_error():
    session = FakeSession(403)
    with pytest.raises(UpstreamError):
        get_username("tok-403", session=session, ttl=0)


def test_other_non_200_raises_upstream_error():
    session = FakeSession(500)
    with pytest.raises(UpstreamError):
        get_username("tok-500", session=session, ttl=0)


def test_200_with_uid_returns_username():
    session = FakeSession(200, {"uid": "12345"})
    assert get_username("tok-200", session=session, ttl=0) == "u_12345"
