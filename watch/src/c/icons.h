#pragma once
#include <pebble.h>
typedef enum { ICON_NOZZLE, ICON_BED, ICON_CHAMBER, ICON_LAYERS, ICON_CLOCK, ICON_SPOOL,
               ICON_PLAY, ICON_CHECK, ICON_X, ICON_PAUSE, ICON_FAN, ICON_SPEED } IconId;
void icon_draw(GContext *ctx, IconId id, GPoint o, GColor color);
