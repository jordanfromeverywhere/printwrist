#include <pebble.h>
#include "messaging.h"
#include "status_window.h"

PrintState g_state = {.stage = STAGE_OFFLINE, .nozzle = TEMP_NONE, .bed = TEMP_NONE,
                      .chamber = TEMP_NONE, .ams_color = -1, .conn = CONN_CONNECTING,
                      .layout = LAYOUT_ARC,
                      .nozzle_target = TEMP_NONE, .bed_target = TEMP_NONE,
                      .fan_part = -1, .fan_aux = -1, .fan_chamber = -1,
                      .speed_level = 0, .light = -1,
                      .unit_count = 0, .ext_active = 0, .ext_color = -1};

static StateChangedFn s_on_state;
static AlertFn s_on_alert;
static ControlResultFn s_on_control;
static int s_last_action;

static void read_int(DictionaryIterator *it, uint32_t key, int *out) {
  Tuple *t = dict_find(it, key);
  if (t) *out = (int)t->value->int32;
}

static void read_str(DictionaryIterator *it, uint32_t key, char *out, size_t n) {
  Tuple *t = dict_find(it, key);
  if (t) { strncpy(out, t->value->cstring, n - 1); out[n - 1] = '\0'; }
}

static int parse_hex6(const char *s, int len) {
  int v = 0, i, d;
  if (len != 6) return -1;
  for (i = 0; i < 6; i++) {
    char c = s[i];
    if (c >= '0' && c <= '9') d = c - '0';
    else if (c >= 'A' && c <= 'F') d = c - 'A' + 10;
    else if (c >= 'a' && c <= 'f') d = c - 'a' + 10;
    else return -1;
    v = (v << 4) | d;
  }
  return v;
}

/* Parses one "|TYPE,COLOR" (or bare "|TYPE," / empty "|") tray segment, already stripped of its
   leading '|'. Never writes past type_out_sz. */
static void parse_tray(const char *seg, int len, char *type_out, size_t type_out_sz, int32_t *color_out) {
  int type_len, i;
  const char *comma = NULL;
  type_out[0] = '\0';
  *color_out = -1;
  if (len <= 0) return;
  for (i = 0; i < len; i++) { if (seg[i] == ',') { comma = seg + i; break; } }
  type_len = comma ? (int)(comma - seg) : len;
  if (type_len > (int)type_out_sz - 1) type_len = (int)type_out_sz - 1;
  for (i = 0; i < type_len; i++) type_out[i] = seg[i];
  type_out[type_len] = '\0';
  if (comma) *color_out = parse_hex6(comma + 1, (int)(seg + len - (comma + 1)));
}

/* Parses AMS_UNITS ("A3|PLA,FF0000|...|...;H-|PA,202020" style). Bad kind chars are skipped
   (that unit is dropped, parsing continues after its ';'); trays beyond 4 and units beyond
   MAX_UNITS are ignored; malformed hex becomes -1. Builds into a scratch array first so a
   truncated or malformed message never leaves g_state half-updated. */
static void parse_ams_units(const char *str) {
  AmsUnit tmp[MAX_UNITS];
  int count = 0;
  const char *p = str;
  memset(tmp, 0, sizeof tmp);

  while (*p && count < MAX_UNITS) {
    const char *seg_end = strchr(p, ';');
    int seg_len = seg_end ? (int)(seg_end - p) : (int)strlen(p);
    if (seg_len >= 2 && (p[0] == 'A' || p[0] == 'H')) {
      AmsUnit *u = &tmp[count];
      const char *tp = p + 2;
      const char *seg_stop = p + seg_len;
      int tray_idx = 0, i;
      u->kind = p[0];
      u->active = (p[1] >= '0' && p[1] <= '3') ? (int8_t)(p[1] - '0') : -1;
      for (i = 0; i < 4; i++) { u->type[i][0] = '\0'; u->color[i] = -1; }
      while (tp < seg_stop && *tp == '|') {
        const char *next_pipe;
        tp++;
        next_pipe = tp;
        while (next_pipe < seg_stop && *next_pipe != '|') next_pipe++;
        if (tray_idx < 4) {
          parse_tray(tp, (int)(next_pipe - tp), u->type[tray_idx], sizeof u->type[tray_idx], &u->color[tray_idx]);
          tray_idx++;
        }
        tp = next_pipe;
      }
      u->n_trays = (uint8_t)tray_idx;
      count++;
    }
    if (!seg_end) break;
    p = seg_end + 1;
  }

  memcpy(g_state.units, tmp, sizeof tmp);
  g_state.unit_count = count;
}

static void inbox(DictionaryIterator *it, void *ctx) {
  int v;
  Tuple *stage = dict_find(it, MESSAGE_KEY_STAGE);
  if (stage) { g_state.stage = (Stage)stage->value->int32; g_state.has_status = true; }
  read_int(it, MESSAGE_KEY_PROGRESS, &g_state.progress);
  read_int(it, MESSAGE_KEY_REMAINING_MIN, &g_state.remaining_min);
  read_int(it, MESSAGE_KEY_NOZZLE, &g_state.nozzle);
  read_int(it, MESSAGE_KEY_BED, &g_state.bed);
  read_int(it, MESSAGE_KEY_CHAMBER, &g_state.chamber);
  read_int(it, MESSAGE_KEY_LAYER, &g_state.layer);
  read_int(it, MESSAGE_KEY_TOTAL_LAYERS, &g_state.total_layers);
  Tuple *c = dict_find(it, MESSAGE_KEY_AMS_COLOR);
  if (c) g_state.ams_color = c->value->int32;
  read_str(it, MESSAGE_KEY_JOB, g_state.job, sizeof g_state.job);
  read_str(it, MESSAGE_KEY_AMS_LABEL, g_state.ams_label, sizeof g_state.ams_label);
  read_str(it, MESSAGE_KEY_ERROR_CODE, g_state.error_code, sizeof g_state.error_code);
  read_str(it, MESSAGE_KEY_PRINTER_NAME, g_state.printer_name, sizeof g_state.printer_name);
  v = -1; read_int(it, MESSAGE_KEY_CONN_STATE, &v); if (v >= 0) g_state.conn = (ConnState)v;
  v = -1; read_int(it, MESSAGE_KEY_LAYOUT, &v); if (v >= 0) g_state.layout = (Layout)v;

  read_int(it, MESSAGE_KEY_NOZZLE_TARGET, &g_state.nozzle_target);
  read_int(it, MESSAGE_KEY_BED_TARGET, &g_state.bed_target);
  read_int(it, MESSAGE_KEY_FAN_PART, &g_state.fan_part);
  read_int(it, MESSAGE_KEY_FAN_AUX, &g_state.fan_aux);
  read_int(it, MESSAGE_KEY_FAN_CHAMBER, &g_state.fan_chamber);
  read_int(it, MESSAGE_KEY_SPEED_LEVEL, &g_state.speed_level);
  read_int(it, MESSAGE_KEY_LIGHT, &g_state.light);

  Tuple *au = dict_find(it, MESSAGE_KEY_AMS_UNITS);
  if (au) parse_ams_units(au->value->cstring);
  read_int(it, MESSAGE_KEY_EXT_ACTIVE, &g_state.ext_active);
  read_str(it, MESSAGE_KEY_EXT_TYPE, g_state.ext_type, sizeof g_state.ext_type);
  Tuple *ec = dict_find(it, MESSAGE_KEY_EXT_COLOR);
  if (ec) g_state.ext_color = ec->value->int32;

  if (s_on_state) s_on_state();

  Tuple *alert = dict_find(it, MESSAGE_KEY_ALERT_KIND);
  if (alert && s_on_alert) {
    Tuple *vib = dict_find(it, MESSAGE_KEY_VIBRATE);
    s_on_alert((AlertKind)alert->value->int32, vib && vib->value->int32 == 1);
  }
  Tuple *cr = dict_find(it, MESSAGE_KEY_CONTROL_RESULT);
  if (cr && s_on_control) {
    /* The phone echoes CONTROL_ACTION alongside CONTROL_RESULT so overlapping actions can't be
       mis-attributed; fall back to our own last-sent record for older phone builds that don't. */
    Tuple *ca = dict_find(it, MESSAGE_KEY_CONTROL_ACTION);
    int action = ca ? (int)ca->value->int32 : s_last_action;
    s_on_control((int)cr->value->int32, action);
  }
}

static void outbox_failed(DictionaryIterator *it, AppMessageResult reason, void *ctx) {
  vibes_short_pulse();
  status_window_toast("Couldn't send");
}

void messaging_init(StateChangedFn on_state, AlertFn on_alert, ControlResultFn on_control) {
  s_on_state = on_state;
  s_on_alert = on_alert;
  s_on_control = on_control;
  app_message_register_inbox_received(inbox);
  app_message_register_outbox_failed(outbox_failed);
  app_message_open(1024, 128);
}

bool messaging_send_control(int action) {
  s_last_action = action;
  DictionaryIterator *out;
  if (app_message_outbox_begin(&out) != APP_MSG_OK) return false;
  dict_write_int32(out, MESSAGE_KEY_CONTROL_ACTION, action);
  return app_message_outbox_send() == APP_MSG_OK;
}

bool messaging_send_code(const char *code) {
  DictionaryIterator *out;
  if (app_message_outbox_begin(&out) != APP_MSG_OK) return false;
  dict_write_cstring(out, MESSAGE_KEY_CODE, code);
  return app_message_outbox_send() == APP_MSG_OK;
}
