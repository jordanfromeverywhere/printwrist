import pytest

from app.errors import AuthError
from app.mqtt_transport import deep_merge, fetch_report
from tests.fakes import FakeTransport


def test_requests_pushall_and_merges_until_state_seen():
    t = FakeTransport([
        {"info": {"x": 1}},
        {"print": {"gcode_state": "RUNNING", "mc_percent": 10}},
        {"print": {"mc_percent": 11, "ams": {"tray_now": "0"}}},
    ])
    out = fetch_report(t, "ABC12345")
    assert t.subscribed == ["device/ABC12345/report"]
    topic, payload = t.published[0]
    assert topic == "device/ABC12345/request"
    assert payload["pushing"]["command"] == "pushall"
    assert out["print"] == {"gcode_state": "RUNNING", "mc_percent": 11, "ams": {"tray_now": "0"}}
    assert t.closed


def test_returns_none_when_no_state_arrives():
    t = FakeTransport([{"print": {"mc_percent": 5}}])
    assert fetch_report(t, "ABC12345") is None
    assert t.closed


def test_auth_error_propagates_and_closes():
    t = FakeTransport([], fail_auth=True)
    with pytest.raises(AuthError):
        fetch_report(t, "ABC12345")


def test_deep_merge_nested():
    a = {"print": {"ams": {"tray_now": "0", "ams": [1]}, "x": 1}}
    deep_merge(a, {"print": {"ams": {"tray_now": "1"}, "y": 2}})
    assert a == {"print": {"ams": {"tray_now": "1", "ams": [1]}, "x": 1, "y": 2}}
