#pragma once
#include <pebble.h>
#include "model.h"
void layout_arc_draw(GContext *ctx, GRect body, const PrintState *s);
void layout_big_draw(GContext *ctx, GRect body, const PrintState *s);
void layout_dense_draw(GContext *ctx, GRect body, const PrintState *s);
