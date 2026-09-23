#pragma once
#include "model.h"

typedef void (*StateChangedFn)(void);
typedef void (*AlertFn)(AlertKind kind, bool vibrate);
typedef void (*ControlResultFn)(int result);

void messaging_init(StateChangedFn on_state, AlertFn on_alert, ControlResultFn on_control);
bool messaging_send_control(int action);
