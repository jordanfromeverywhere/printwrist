#include "layouts.h"
#include "ui_common.h"
#include "format.h"

static void format_temp_target(int cur, int target, char *buf, size_t n) {
  char c[12];
  format_temp(cur, c, sizeof c);
  if (target <= TEMP_NONE) snprintf(buf, n, "%s", c);
  else snprintf(buf, n, "%s/%d", c, target);
}

static void format_pct(int v, char *buf, size_t n) {
  if (v < 0) snprintf(buf, n, "--");
  else snprintf(buf, n, "%d", v);
}

static void format_fans(int part, int aux, int chamber, char *buf, size_t n) {
  char p[12], a[12], c[12];
  format_pct(part, p, sizeof p);
  format_pct(aux, a, sizeof a);
  format_pct(chamber, c, sizeof c);
  snprintf(buf, n, "%s \xc2\xb7 %s \xc2\xb7 %s%%", p, a, c);
}

static void draw_left_row(GContext *ctx, GRect row, const char *label, const char *value) {
  int label_w = 50;
  icon_draw(ctx, ICON_CLOCK, GPoint(row.origin.x, row.origin.y + 6), GColorLightGray);
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_18),
                     GRect(row.origin.x + 18, row.origin.y - 2, label_w, 22),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, value, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(row.origin.x + 18 + label_w, row.origin.y, row.size.w - 18 - label_w, 20),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
}

static const char *speed_label(int level) {
  switch (level) {
    case 1: return "Silent";
    case 2: return "Standard";
    case 3: return "Sport";
    case 4: return "Ludicrous";
    default: return "--";
  }
}

void layout_details_draw(GContext *ctx, GRect b, const PrintState *s) {
  int x = b.origin.x + 12, w = b.size.w - 24;

  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, "DETAILS", fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(x, b.origin.y + 2, w, 16), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, s->job, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                     GRect(x, b.origin.y + 18, w, 22), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  ui_draw_bar(ctx, GRect(x, b.origin.y + 42, w, 6), s->progress, stage_color(s->stage));

  char rem[12], fin[8], left[24], lay[16], noz[24], bed[24], fans[48];
  format_remaining(s->remaining_min, rem, sizeof rem);
  time_t now = time(NULL);
  struct tm *t = localtime(&now);
  format_finish(t->tm_hour, t->tm_min, s->remaining_min, ui_clock24(), fin, sizeof fin);
  snprintf(left, sizeof left, "%s \xc2\xb7 %s", rem, fin);
  snprintf(lay, sizeof lay, "%d/%d", s->layer, s->total_layers);
  format_temp_target(s->nozzle, s->nozzle_target, noz, sizeof noz);
  format_temp_target(s->bed, s->bed_target, bed, sizeof bed);
  format_fans(s->fan_part, s->fan_aux, s->fan_chamber, fans, sizeof fans);

  int y = b.origin.y + 50, step = 22;
  draw_left_row(ctx, GRect(x, y, w, step), "Left", left); y += step;
  ui_draw_row(ctx, GRect(x, y, w, step), ICON_LAYERS, GColorLightGray, "Layer", lay); y += step;
  ui_draw_row(ctx, GRect(x, y, w, step), ICON_NOZZLE, GColorLightGray, "Nozzle", noz); y += step;
  ui_draw_row(ctx, GRect(x, y, w, step), ICON_BED, GColorLightGray, "Bed", bed); y += step;
  ui_draw_row(ctx, GRect(x, y, w, step), ICON_FAN, GColorLightGray, "Fans", fans); y += step;
  ui_draw_row(ctx, GRect(x, y, w, step), ICON_SPEED, GColorLightGray, "Speed", speed_label(s->speed_level));
}
