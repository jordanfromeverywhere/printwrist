#include <pebble.h>
#include "messaging.h"

PrintState g_state = {.stage = STAGE_OFFLINE, .nozzle = TEMP_NONE, .bed = TEMP_NONE,
                      .chamber = TEMP_NONE, .ams_color = -1, .conn = CONN_CONNECTING,
                      .layout = LAYOUT_ARC,
                      .nozzle_target = TEMP_NONE, .bed_target = TEMP_NONE,
                      .fan_part = -1, .fan_aux = -1, .fan_chamber = -1,
                      .speed_level = 0, .light = -1, .tray_active = -1,
                      .tray_color = {-1, -1, -1, -1}, .ext_color = -1};

static StateChangedFn s_on_state;
static AlertFn s_on_alert;
static ControlResultFn s_on_control;

static void read_int(DictionaryIterator *it, uint32_t key, int *out) {
  Tuple *t = dict_find(it, key);
  if (t) *out = (int)t->value->int32;
}

static void read_str(DictionaryIterator *it, uint32_t key, char *out, size_t n) {
  Tuple *t = dict_find(it, key);
  if (t) { strncpy(out, t->value->cstring, n - 1); out[n - 1] = '\0'; }
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
  read_int(it, MESSAGE_KEY_TRAY_ACTIVE, &g_state.tray_active);

  uint32_t tray_type_keys[4] = {MESSAGE_KEY_TRAY0_TYPE, MESSAGE_KEY_TRAY1_TYPE,
                                 MESSAGE_KEY_TRAY2_TYPE, MESSAGE_KEY_TRAY3_TYPE};
  uint32_t tray_color_keys[4] = {MESSAGE_KEY_TRAY0_COLOR, MESSAGE_KEY_TRAY1_COLOR,
                                  MESSAGE_KEY_TRAY2_COLOR, MESSAGE_KEY_TRAY3_COLOR};
  for (int i = 0; i < 4; i++) {
    read_str(it, tray_type_keys[i], g_state.tray_type[i], sizeof g_state.tray_type[i]);
    Tuple *tc = dict_find(it, tray_color_keys[i]);
    if (tc) g_state.tray_color[i] = tc->value->int32;
  }
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
  if (cr && s_on_control) s_on_control((int)cr->value->int32);
}

void messaging_init(StateChangedFn on_state, AlertFn on_alert, ControlResultFn on_control) {
  s_on_state = on_state;
  s_on_alert = on_alert;
  s_on_control = on_control;
  app_message_register_inbox_received(inbox);
  app_message_open(1024, 128);
}

bool messaging_send_control(int action) {
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
