from fastapi.testclient import TestClient

from app.control import build_command, classify_reply, send_command
from app.main import create_app
from tests.fakes import FakeTransport

AUTH = {"Authorization": "Bearer " + "t" * 40}


def test_build_command():
    assert build_command("pause", 7) == {"print": {"sequence_id": "7", "command": "pause", "param": ""}}


def test_classify_reply():
    assert classify_reply({"command": "pause", "result": "success"}) == "ok"
    assert classify_reply({"command": "pause", "result": "SUCCESS"}) == "ok"
    assert classify_reply({"command": "pause", "result": "fail", "reason": "x"}) == "rejected"
    assert classify_reply({"command": "pause", "err_code": 84033543}) == "rejected"


def test_send_command_matches_sequence():
    t = FakeTransport([
        {"print": {"command": "pause", "sequence_id": "6", "result": "fail"}},
        {"print": {"command": "pause", "sequence_id": "7", "result": "success"}},
    ])
    assert send_command(t, "ABC12345", "pause", seq=7) == "ok"
    assert t.published[0] == ("device/ABC12345/request", build_command("pause", 7))
    assert t.closed


def test_send_command_unconfirmed_when_silent():
    assert send_command(FakeTransport([]), "ABC12345", "stop", seq=1) == "unconfirmed"


def make_client(result):
    app = create_app(transport_factory=lambda u, t: FakeTransport([]),
                     username_resolver=lambda tok: "u_1",
                     control_sender=lambda app, token, serial, action: result)
    return TestClient(app)


def test_control_endpoint_ok_and_rejected():
    assert make_client("ok").post("/control", json={"serial": "ABC12345", "action": "pause"},
                                  headers=AUTH).json() == {"result": "ok"}
    r = make_client("rejected").post("/control", json={"serial": "ABC12345", "action": "stop"}, headers=AUTH)
    assert r.status_code == 409


def test_control_rejects_unknown_action():
    r = make_client("ok").post("/control", json={"serial": "ABC12345", "action": "home"}, headers=AUTH)
    assert r.status_code == 422
