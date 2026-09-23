#include "layouts.h"
#include "ui_common.h"
#include "format.h"

static void grid_cell(GContext *ctx, GRect cell, IconId icon, const char *value) {
  icon_draw(ctx, icon, GPoint(cell.origin.x, cell.origin.y + 6), GColorLightGray);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, value, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                     GRect(cell.origin.x + 18, cell.origin.y - 2, cell.size.w - 18, 22),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

void layout_big_draw(GContext *ctx, GRect b, const PrintState *s) {
  int x = b.origin.x + 12, w = b.size.w - 24;
  ui_draw_stage(ctx, GRect(x, b.origin.y + 4, w, 18), s->stage, GTextAlignmentLeft);
  ui_draw_percent(ctx, GRect(x - 12, b.origin.y + 22, b.size.w, 50), s->progress, FONT_KEY_LECO_42_NUMBERS);
  ui_draw_bar(ctx, GRect(x, b.origin.y + 76, w, 8), s->progress, stage_color(s->stage));

  char rem[12], left[20], fin[8], done_at[16];
  format_remaining(s->remaining_min, rem, sizeof rem);
  snprintf(left, sizeof left, "%s left", rem);
  time_t now = time(NULL);
  struct tm *t = localtime(&now);
  format_finish(t->tm_hour, t->tm_min, s->remaining_min, ui_clock24(), fin, sizeof fin);
  snprintf(done_at, sizeof done_at, "done %s", fin);
  GFont f = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, left, f, GRect(x, b.origin.y + 86, w / 2 + 10, 22), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, done_at, f, GRect(x + w / 2, b.origin.y + 86, w / 2, 22), GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);

  char noz[8], bed[8], cha[8], lay[16];
  format_temp(s->nozzle, noz, sizeof noz);
  format_temp(s->bed, bed, sizeof bed);
  format_temp(s->chamber, cha, sizeof cha);
  snprintf(lay, sizeof lay, "%d/%d", s->layer, s->total_layers);
  int y = b.origin.y + 116, half = w / 2;
  grid_cell(ctx, GRect(x, y, half - 4, 24), ICON_NOZZLE, noz);
  grid_cell(ctx, GRect(x + half + 4, y, half - 4, 24), ICON_BED, bed);
  grid_cell(ctx, GRect(x, y + 26, half - 4, 24), ICON_CHAMBER, cha);
  grid_cell(ctx, GRect(x + half + 4, y + 26, half - 4, 24), ICON_LAYERS, lay);
}
