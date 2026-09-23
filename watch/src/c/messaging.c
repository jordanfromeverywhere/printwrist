#include <pebble.h>
#include "messaging.h"

PrintState g_state = {.stage = STAGE_OFFLINE, .nozzle = TEMP_NONE, .bed = TEMP_NONE,
                      .chamber = TEMP_NONE, .ams_color = -1, .conn = CONN_CONNECTING,
                      .layout = LAYOUT_ARC};

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
  v = -1; read_int(it, MESSAGE_KEY_CONTROL_ENABLED, &v); if (v >= 0) g_state.control_enabled = v == 1;

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

void messaging_send_control(int action) {
  DictionaryIterator *out;
  if (app_message_outbox_begin(&out) != APP_MSG_OK) return;
  dict_write_int32(out, MESSAGE_KEY_CONTROL_ACTION, action);
  app_message_outbox_send();
}
