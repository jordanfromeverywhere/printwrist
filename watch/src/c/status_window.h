#pragma once
#include <pebble.h>
Window *status_window_create(void);
void status_window_refresh(void);
void status_window_toast(const char *text);
