# Bambu Cloud contract (observed 2026-09-23 against P2S firmware, Bambu Cloud US)

## Login
- Response keys on success: first response (password step) is HTTP 200 with accessToken, refreshToken, expiresIn (0), refreshExpiresIn, tfaKey, accessMethod, loginType "verifyCode", firstAppLogin. After POST sendemail/code (HTTP 200) and login with {account, code}: HTTP 200 with accessToken, refreshToken present, expiresIn 7776000 (90 days), refreshExpiresIn 7776000, loginType "".
- Login type for the test account: verifyCode (email code, not password-only, not authenticator tfa)
- Headers needed (did the default User-Agent work?): yes, default User-Agent "bambu_network_agent/01.09.05.01" worked for every call, no extra headers needed
- CORS allow-origin on login: None (no access-control-allow-origin header returned). This confirms the browser cannot call Bambu directly, so login must stay a JS-side (relay-less) flow, not something the settings page calls cross-origin.

## Refresh
- Endpoint worked: no. POST /v1/user-service/user/refreshtoken returned HTTP 401 {"code":401,"error":"The client must authenticate itself..."} both with and without an Authorization bearer header. Ruling: refresh is best-effort in v1 and must not be relied on. The 90-day access token lifetime plus the existing reconnect-and-relogin flow cover token expiry for v1.

## Profile / MQTT username
- uid field path: top-level `uid` on GET /v1/user-service/my/profile (HTTP 200). MQTT username is `u_<uid>`.
- MQTT connect result: "Success" using username `u_<uid>` and password = access token.

## Devices
- Serial field: `dev_id` (top-level of each entry in `devices[]` from GET /v1/iot-service/api/user/bind)
- Name field: `name` (also `dev_product_name` for the model, e.g. "P2S"; `dev_model_name` is the internal model code, e.g. "N7-V2")
- Online field: `online` (boolean)
- See `watch/test/fixtures/devices.json` for the full sanitized shape (print_status, print_job, dev_access_code redacted, nozzle_diameter, dev_structure, total_print_time also present).

## Report fields (P2S)
- gcode_state values seen: FINISH (mc_percent 100). Only one state observed this run; other states (RUNNING, PAUSE, FAILED, IDLE, PREPARE, SLICING) not exercised, per the plan's expected mapping.
- progress / remaining / layer / total layers paths: `print.mc_percent` (progress), `print.mc_remaining_time` (remaining minutes), `print.layer_num` and `print.total_layer_num` (also duplicated under `print["3D"].layer_num` / `print["3D"].total_layer_num`).
- nozzle / bed / chamber temp paths (note any packed or nested format): `print.nozzle_temper` and `print.bed_temper` are plain top-level floats, not packed. There is no `chamber_temper` field anywhere in the P2S report. The closest thing to a chamber reading is `print.device.ctc.info.temp` (28), which is duplicated at `print.info.temp` (also 28) in the smaller delta message. Treat `device.ctc.info.temp` as the chamber-temp fallback.
- ams / tray_now / vt_tray paths: `print.ams.tray_now` (string, "255" = none selected), `print.ams.ams[]` is the array of AMS units, each with `id`, `temp`, `humidity`, and a `tray[]` array of slots with `id`, `tray_type`, `tray_color`, `tray_sub_brands`, etc. There is no `vt_tray` object anywhere in the report. Instead there is a top-level `print.vir_slot` array (one entry, `id: "255"`) that has the same shape as an AMS tray and appears to be the external-spool slot.
- print_error / hms paths: `print.print_error` (0, top-level, matches expected). `print.hms` is a top-level array of `{attr, code, ts_boot, ts_unix}` objects; two entries were present even on a successful finished print (historical/informational HMS codes, not necessarily active errors).
- Did pushall return a full state or only deltas?: Full state, in one message. Of 8 messages received on `device/<serial>/report` after publishing one pushall request: 6 were empty `{}` envelopes, one (message index 1) was the full merged report with every field above, and one (message index 3) was a small delta containing only `command: push_status`, `device.ctc.info.temp`, `info.temp`, `msg`, `sequence_id`, `t_utc`. Report-parsing code must tolerate messages with no `print` key or an empty `print` dict.

## Camera transport (for v1.1)
- ipcam fields: `agora_service: disable`, `brtc_service: enable`, `tutk_server: disable`, `rtsp_url: disable`, `resolution: 1080p` (also `cap_pic_enable: enable`, `ipcam_record: enable`, `liveview_preview: true`, `laser_preview_res: 7`, `mode_bits: 2`, timelapse-storage counters). v1.1 camera transport should target BRTC, since agora, tutk, and rtsp are all disabled.

## Unsigned control
- ledctrl replies: two replies received, `{"system": {"command": "ledctrl", "sequence_id": "101", "result": "success", "reason": ""}}` for led_mode "on" and the same with `"sequence_id": "102"` for led_mode "off". No err_code in either reply.
- Light visibly changed: yes, owner confirmed the chamber light visibly turned on then off.

## Verdict
- CONTROL_MODE: unsigned
- Deviations from the plan's expected contract that later tasks must apply:
  - Refresh endpoint (`/v1/user-service/user/refreshtoken`) rejects our calls with 401 regardless of auth header. v1 must not depend on refresh; rely on the 90-day access token plus a manual reconnect/relogin flow on expiry.
  - There is no `vt_tray` field on the P2S report. The external-spool slot 254 lives at `print.vir_slot` instead. Any code path that reads `vt_tray` for slot 254 (for example the AMS-tray lookup in `watch/src/pkjs/normalize.js`) should also check `vir_slot`.
  - There is no `chamber_temper` field on the P2S report. Chamber temperature (when present) is at `print.device.ctc.info.temp`, duplicated at `print.info.temp`. Code should read the nested `device.ctc.info.temp` path as the chamber-temp source (already the fallback path used in `watch/src/pkjs/normalize.js`).
  - `pushall` can return a mix of empty `{}` payloads and partial delta payloads alongside the one full merged report; consumers must not assume every message on the report topic carries a `print` key.

Caveat: ledctrl is weaker proof of unsigned control than pause/stop would be, since a light command could in principle be accepted and silently ignored by the printer. The live pause performed in the final control-path test is the stronger confirmation that unsigned commands actually reach and affect the printer; until that test runs, treat this verdict as supported mainly by the owner's visual confirmation that the chamber light actually turned on then off.
