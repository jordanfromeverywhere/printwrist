import json
import pathlib

import pytest

from app.normalize import normalize

KEYS = {"stage", "progress", "remaining_min", "nozzle", "bed", "chamber", "layer",
        "total_layers", "job", "error_code", "ams"}
FIX = pathlib.Path(__file__).parent / "fixtures"


def report(**print_fields):
    return {"print": print_fields}


def test_none_is_offline_with_all_keys():
    out = normalize(None)
    assert set(out) == KEYS
    assert out["stage"] == "offline"
    assert out["progress"] is None


@pytest.mark.parametrize("raw,stage", [
    ("RUNNING", "printing"), ("PREPARE", "printing"), ("SLICING", "printing"),
    ("PAUSE", "paused"), ("FINISH", "done"), ("FAILED", "failed"), ("IDLE", "idle"),
    ("SOMETHING_NEW", "idle"),
])
def test_stage_mapping(raw, stage):
    assert normalize(report(gcode_state=raw))["stage"] == stage


def test_core_fields():
    out = normalize(report(gcode_state="RUNNING", mc_percent=65, mc_remaining_time=134,
                           nozzle_temper=238.4, bed_temper="60.0", chamber_temper=42,
                           layer_num=184, total_layer_num=280, subtask_name="benchy_v3"))
    assert out["progress"] == 65
    assert out["remaining_min"] == 134
    assert (out["nozzle"], out["bed"], out["chamber"]) == (238, 60, 42)
    assert (out["layer"], out["total_layers"]) == (184, 280)
    assert out["job"] == "benchy_v3"
    assert out["error_code"] is None
    assert set(out) == KEYS


def test_error_code_formatting():
    assert normalize(report(gcode_state="FAILED", print_error=0x0300400C))["error_code"] == "0300-400C"
    assert normalize(report(gcode_state="FAILED", print_error=0))["error_code"] is None


def test_ams_slot_from_tray_now():
    ams = {"tray_now": "1", "ams": [{"id": "0", "tray": [
        {"id": "0", "tray_type": "PETG", "tray_color": "00FF00FF"},
        {"id": "1", "tray_type": "PLA", "tray_color": "FF0000FF"}]}]}
    out = normalize(report(gcode_state="RUNNING", ams=ams))
    assert out["ams"] == {"slot": "AMS1-2", "type": "PLA", "color": "FF0000"}


def test_ams_external_and_none():
    ext = normalize(report(gcode_state="RUNNING", ams={"tray_now": "254"},
                           vt_tray={"tray_type": "TPU", "tray_color": "000000FF"}))
    assert ext["ams"] == {"slot": "Ext", "type": "TPU", "color": "000000"}
    assert normalize(report(gcode_state="IDLE", ams={"tray_now": "255"}))["ams"] is None


def test_ams_external_from_vir_slot():
    ext = normalize(report(gcode_state="RUNNING", ams={"tray_now": "254"},
                           vir_slot=[{"id": "255", "tray_type": "TPU", "tray_color": "9B9EA0FF"}]))
    assert ext["ams"] == {"slot": "Ext", "type": "TPU", "color": "9B9EA0"}


def test_nested_temperature_fallbacks():
    dev = {"extruder": {"info": [{"temp": 220}]}, "bed": {"info": {"temp": 55}},
           "ctc": {"info": {"temp": 38}}}
    out = normalize(report(gcode_state="RUNNING", device=dev))
    assert (out["nozzle"], out["bed"], out["chamber"]) == (220, 55, 38)


@pytest.mark.skipif(not (FIX / "report_p2s.json").exists(), reason="Task 1 fixture missing")
def test_recorded_p2s_report():
    out = normalize(json.loads((FIX / "report_p2s.json").read_text()))
    assert set(out) == KEYS
    assert out["stage"] in {"printing", "paused", "done", "failed", "idle"}
    assert isinstance(out["nozzle"], int) and 0 <= out["nozzle"] < 400
    assert isinstance(out["bed"], int) and 0 <= out["bed"] < 150
