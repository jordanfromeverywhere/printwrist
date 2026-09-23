#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum { STAGE_IDLE = 0, STAGE_PRINTING, STAGE_PAUSED, STAGE_DONE, STAGE_FAILED, STAGE_OFFLINE } Stage;
typedef enum { CONN_OK = 0, CONN_CONNECTING, CONN_NEED_LOGIN, CONN_NEED_CODE, CONN_RELAY_DOWN,
               CONN_TFA_UNSUPPORTED, CONN_NO_PRINTER } ConnState;
typedef enum { LAYOUT_ARC = 0, LAYOUT_BIG, LAYOUT_DENSE } Layout;
typedef enum { ALERT_NONE = 0, ALERT_DONE, ALERT_FAILED, ALERT_PAUSED, ALERT_RECONNECT } AlertKind;

#define TEMP_NONE (-1000)

typedef struct {
  Stage stage;
  int progress, remaining_min, nozzle, bed, chamber, layer, total_layers;
  int32_t ams_color;
  char job[32], ams_label[20], error_code[12], printer_name[24];
  ConnState conn;
  Layout layout;
  bool control_enabled, has_status;
} PrintState;

extern PrintState g_state;
