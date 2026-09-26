#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum { STAGE_IDLE = 0, STAGE_PRINTING, STAGE_PAUSED, STAGE_DONE, STAGE_FAILED, STAGE_OFFLINE } Stage;
typedef enum { CONN_OK = 0, CONN_CONNECTING, CONN_NEED_LOGIN, CONN_NEED_CODE, CONN_RELAY_DOWN,
               CONN_TFA_UNSUPPORTED, CONN_NO_PRINTER } ConnState;
typedef enum { LAYOUT_ARC = 0, LAYOUT_BIG, LAYOUT_DENSE } Layout;
typedef enum { ALERT_NONE = 0, ALERT_DONE, ALERT_FAILED, ALERT_PAUSED, ALERT_RECONNECT } AlertKind;

#define TEMP_NONE (-1000)
#define MAX_UNITS 12

typedef struct {
  char kind;              /* 'A' (regular AMS) or 'H' (AMS HT) */
  int8_t active;          /* fed slot index, or -1 for none */
  uint8_t n_trays;        /* 4 for a regular unit, 1 for HT */
  char type[4][8];
  int32_t color[4];
} AmsUnit;

typedef struct {
  Stage stage;
  int progress, remaining_min, nozzle, bed, chamber, layer, total_layers;
  int32_t ams_color;
  char job[32], ams_label[20], error_code[12], printer_name[24];
  ConnState conn;
  Layout layout;
  bool has_status;
  int nozzle_target, bed_target, fan_part, fan_aux, fan_chamber, speed_level, light;
  AmsUnit units[MAX_UNITS];
  int unit_count;
  int ext_active;
  char ext_type[8];
  int32_t ext_color;
} PrintState;

extern PrintState g_state;
