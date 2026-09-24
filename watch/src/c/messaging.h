#pragma once
#include "model.h"

typedef void (*StateChangedFn)(void);
typedef void (*AlertFn)(AlertKind kind, bool vibrate);
typedef void (*ControlResultFn)(int result);

typedef enum {
  CONTROL_PAUSE = 1, CONTROL_RESUME = 2, CONTROL_STOP = 3,
  CONTROL_LIGHT_ON = 4, CONTROL_LIGHT_OFF = 5, CONTROL_REFRESH = 6,
  CONTROL_SPEED_SILENT = 7, CONTROL_SPEED_STANDARD = 8, CONTROL_SPEED_SPORT = 9, CONTROL_SPEED_LUDICROUS = 10
} ControlAction;

typedef enum { CONTROL_RESULT_OK = 0, CONTROL_RESULT_REJECTED = 1, CONTROL_RESULT_FAILED = 2 } ControlResult;

void messaging_init(StateChangedFn on_state, AlertFn on_alert, ControlResultFn on_control);
bool messaging_send_control(int action);
bool messaging_send_code(const char *code);
int messaging_last_action(void);
