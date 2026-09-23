#pragma once
#include <pebble.h>
#include "model.h"
#include "icons.h"

GColor stage_color(Stage s);
void ui_draw_stage(GContext *ctx, GRect box, Stage s, GTextAlignment align);
void ui_draw_percent(GContext *ctx, GRect box, int progress, const char *num_font_key);
void ui_draw_icon_value(GContext *ctx, GRect box, IconId icon, const char *value);
void ui_draw_row(GContext *ctx, GRect row, IconId icon, GColor icon_color, const char *label, const char *value);
void ui_draw_bar(GContext *ctx, GRect box, int progress, GColor fill);
bool ui_clock24(void);
void ui_draw_conn(GContext *ctx, GRect body, ConnState c);
