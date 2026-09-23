#include "layouts.h"
#include "ui_common.h"
#include "format.h"

void layout_arc_draw(GContext *ctx, GRect b, const PrintState *s) {
  ui_draw_stage(ctx, GRect(b.origin.x, b.origin.y + 4, b.size.w, 18), s->stage, GTextAlignmentCenter);
  GRect ring = GRect(b.origin.x + (b.size.w - 116) / 2, b.origin.y + 24, 116, 116);
  graphics_context_set_fill_color(ctx, GColorDarkGray);
  graphics_fill_radial(ctx, ring, GOvalScaleModeFitCircle, 10, 0, TRIG_MAX_ANGLE);
  int p = clamp_progress(s->progress);
  if (p > 0) {
    graphics_context_set_fill_color(ctx, stage_color(s->stage));
    graphics_fill_radial(ctx, ring, GOvalScaleModeFitCircle, 10, 0, TRIG_MAX_ANGLE * p / 100);
  }
  ui_draw_percent(ctx, GRect(ring.origin.x, ring.origin.y + 30, ring.size.w, 40), p, FONT_KEY_LECO_32_BOLD_NUMBERS);
  char rem[12];
  format_remaining(s->remaining_min, rem, sizeof rem);
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, rem, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(ring.origin.x, ring.origin.y + 70, ring.size.w, 18), GTextOverflowModeTrailingEllipsis,
                     GTextAlignmentCenter, NULL);
  char noz[8], bed[8], lay[8];
  format_temp(s->nozzle, noz, sizeof noz);
  format_temp(s->bed, bed, sizeof bed);
  snprintf(lay, sizeof lay, "%d", s->layer);
  int y = ring.origin.y + ring.size.h + 6, col = b.size.w / 3;
  ui_draw_icon_value(ctx, GRect(b.origin.x, y, col, 34), ICON_NOZZLE, noz);
  ui_draw_icon_value(ctx, GRect(b.origin.x + col, y, col, 34), ICON_BED, bed);
  ui_draw_icon_value(ctx, GRect(b.origin.x + 2 * col, y, col, 34), ICON_LAYERS, lay);
}
