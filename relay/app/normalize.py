from __future__ import annotations

from typing import Any

STAGES = {
    "RUNNING": "printing", "PREPARE": "printing", "SLICING": "printing",
    "PAUSE": "paused", "FINISH": "done", "FAILED": "failed", "IDLE": "idle",
}
_EMPTY = {"stage": "offline", "progress": None, "remaining_min": None, "nozzle": None, "bed": None,
          "chamber": None, "layer": None, "total_layers": None, "job": None, "error_code": None,
          "ams": None}


def _num(v: Any) -> int | None:
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return None


def _deep(d: Any, *keys: Any) -> Any:
    for k in keys:
        if isinstance(d, dict):
            d = d.get(k)
        elif isinstance(d, list) and isinstance(k, int) and 0 <= k < len(d):
            d = d[k]
        else:
            return None
    return d


def _first(*vals: Any) -> int | None:
    for v in vals:
        n = _num(v)
        if n is not None:
            return n
    return None


def _color(c: Any) -> str | None:
    return c[:6].upper() if isinstance(c, str) and len(c) >= 6 else None


def _error_code(v: Any) -> str | None:
    n = _num(v)
    if not n:
        return None
    h = f"{n & 0xFFFFFFFF:08X}"
    return f"{h[:4]}-{h[4:]}"


def _ams(p: dict) -> dict | None:
    ams = p.get("ams") or {}
    now = str(ams.get("tray_now", "255"))
    if now == "255":
        return None
    if now == "254":
        tray = p.get("vt_tray")
        if not tray:
            vir_slot = p.get("vir_slot")
            if isinstance(vir_slot, list) and vir_slot:
                tray = vir_slot[0]
            else:
                tray = {}
        return {"slot": "Ext", "type": tray.get("tray_type") or "", "color": _color(tray.get("tray_color"))}
    idx = _num(now)
    if idx is None:
        return None
    unit, slot = divmod(idx, 4)
    for u in ams.get("ams") or []:
        if _num(u.get("id")) == unit:
            for t in u.get("tray") or []:
                if _num(t.get("id")) == slot:
                    return {"slot": f"AMS{unit + 1}-{slot + 1}", "type": t.get("tray_type") or "",
                            "color": _color(t.get("tray_color"))}
    return {"slot": f"AMS{unit + 1}-{slot + 1}", "type": "", "color": None}


def normalize(report: dict | None) -> dict:
    if not report or not isinstance(report.get("print"), dict):
        return dict(_EMPTY)
    p = report["print"]
    return {
        "stage": STAGES.get(str(p.get("gcode_state", "")).upper(), "idle"),
        "progress": _num(p.get("mc_percent")),
        "remaining_min": _num(p.get("mc_remaining_time")),
        "nozzle": _first(p.get("nozzle_temper"), _deep(p, "device", "extruder", "info", 0, "temp")),
        "bed": _first(p.get("bed_temper"), _deep(p, "device", "bed", "info", "temp")),
        "chamber": _first(p.get("chamber_temper"), _deep(p, "device", "ctc", "info", "temp")),
        "layer": _num(p.get("layer_num")),
        "total_layers": _num(p.get("total_layer_num")),
        "job": p.get("subtask_name") or None,
        "error_code": _error_code(p.get("print_error")),
        "ams": _ams(p),
    }
