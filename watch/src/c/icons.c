#include "icons.h"

static void rect(GContext *ctx, int x, int y, int w, int h) { graphics_fill_rect(ctx, GRect(x, y, w, h), 0, GCornerNone); }
static void line(GContext *ctx, int x0, int y0, int x1, int y1) { graphics_draw_line(ctx, GPoint(x0, y0), GPoint(x1, y1)); }

void icon_draw(GContext *ctx, IconId id, GPoint o, GColor color) {
  int x = o.x, y = o.y;
  graphics_context_set_fill_color(ctx, color);
  graphics_context_set_stroke_color(ctx, color);
  graphics_context_set_stroke_width(ctx, 1);
  switch (id) {
    case ICON_NOZZLE:
      rect(ctx, x + 3, y, 6, 4); rect(ctx, x + 4, y + 4, 4, 3); rect(ctx, x + 5, y + 7, 2, 3); rect(ctx, x + 5, y + 11, 2, 1);
      break;
    case ICON_BED:
      rect(ctx, x, y + 9, 12, 2);
      for (int i = 0; i < 3; i++) { int cx = x + 2 + i * 4; line(ctx, cx, y + 1, cx + 1, y + 3); line(ctx, cx + 1, y + 3, cx, y + 5); line(ctx, cx, y + 5, cx + 1, y + 7); }
      break;
    case ICON_CHAMBER:
      rect(ctx, x + 5, y, 2, 8); graphics_fill_circle(ctx, GPoint(x + 6, y + 9), 3);
      break;
    case ICON_LAYERS:
      rect(ctx, x + 2, y + 1, 8, 2); rect(ctx, x + 1, y + 5, 10, 2); rect(ctx, x, y + 9, 12, 2);
      break;
    case ICON_CLOCK:
      graphics_draw_circle(ctx, GPoint(x + 6, y + 6), 5); line(ctx, x + 6, y + 6, x + 6, y + 3); line(ctx, x + 6, y + 6, x + 8, y + 7);
      break;
    case ICON_SPOOL:
      graphics_fill_circle(ctx, GPoint(x + 6, y + 6), 6);
      graphics_context_set_fill_color(ctx, GColorBlack); graphics_fill_circle(ctx, GPoint(x + 6, y + 6), 2);
      break;
    case ICON_PLAY:
      for (int dx = 0; dx < 9; dx++) { int h = 5 - dx * 5 / 9; line(ctx, x + 2 + dx, y + 6 - h, x + 2 + dx, y + 6 + h); }
      break;
    case ICON_CHECK:
      graphics_context_set_stroke_width(ctx, 3); line(ctx, x + 1, y + 6, x + 4, y + 9); line(ctx, x + 4, y + 9, x + 11, y + 2);
      break;
    case ICON_X:
      graphics_context_set_stroke_width(ctx, 3); line(ctx, x + 2, y + 2, x + 10, y + 10); line(ctx, x + 10, y + 2, x + 2, y + 10);
      break;
    case ICON_PAUSE:
      rect(ctx, x + 2, y + 1, 3, 10); rect(ctx, x + 7, y + 1, 3, 10);
      break;
  }
}
