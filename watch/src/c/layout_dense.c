#include "layouts.h"
#include "ui_common.h"
#include "format.h"

void layout_dense_draw(GContext *ctx, GRect b, const PrintState *s) {
  int x = b.origin.x + 10, w = b.size.w - 20;
  ui_draw_stage(ctx, GRect(x, b.origin.y + 4, w, 18), s->stage, GTextAlignmentLeft);
  char pct[6];
  snprintf(pct, sizeof pct, "%d%%", clamp_progress(s->progress));
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, pct, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD), GRect(x, b.origin.y, w, 22),
                     GTextOverflowModeFill, GTextAlignmentRight, NULL);
  ui_draw_bar(ctx, GRect(x, b.origin.y + 24, w, 6), s->progress, stage_color(s->stage));

  char rem[12], noz[8], bed[8], cha[8], lay[16];
  format_remaining(s->remaining_min, rem, sizeof rem);
  format_temp(s->nozzle, noz, sizeof noz);
  format_temp(s->bed, bed, sizeof bed);
  format_temp(s->chamber, cha, sizeof cha);
  snprintf(lay, sizeof lay, "%d/%d", s->layer, s->total_layers);

  int y = b.origin.y + 36, step = 26;
  ui_draw_row(ctx, GRect(x, y, w, 24), ICON_CLOCK, GColorLightGray, "Left", rem); y += step;
  ui_draw_row(ctx, GRect(x, y, w, 24), ICON_NOZZLE, GColorLightGray, "Nozzle", noz); y += step;
  ui_draw_row(ctx, GRect(x, y, w, 24), ICON_BED, GColorLightGray, "Bed", bed); y += step;
  ui_draw_row(ctx, GRect(x, y, w, 24), ICON_CHAMBER, GColorLightGray, "Chamber", cha); y += step;
  ui_draw_row(ctx, GRect(x, y, w, 24), ICON_LAYERS, GColorLightGray, "Layer", lay); y += step;
  if (s->ams_label[0]) {
    GColor swatch = s->ams_color >= 0 ? GColorFromHEX(s->ams_color) : GColorLightGray;
    ui_draw_row(ctx, GRect(x, y, w, 24), ICON_SPOOL, swatch, "Filament", s->ams_label);
  }
}
