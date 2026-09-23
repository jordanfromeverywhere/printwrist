#include "layouts.h"
#include "ui_common.h"
#include "format.h"

static void draw_slot(GContext *ctx, GRect box, const char *type, int32_t color, bool active) {
  GPoint c = GPoint(box.origin.x + box.size.w / 2, box.origin.y + 16);
  bool empty = type[0] == '\0';

  if (empty) {
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_line(ctx, GPoint(c.x - 9, c.y - 3), GPoint(c.x - 3, c.y - 9));
    graphics_draw_line(ctx, GPoint(c.x - 9, c.y + 3), GPoint(c.x + 3, c.y - 9));
    graphics_draw_line(ctx, GPoint(c.x - 3, c.y + 9), GPoint(c.x + 9, c.y - 3));
  } else {
    GColor fill = color >= 0 ? GColorFromHEX(color) : GColorLightGray;
    graphics_context_set_fill_color(ctx, fill);
    graphics_fill_circle(ctx, c, 10);
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_circle(ctx, c, 10);
  }

  graphics_context_set_text_color(ctx, empty ? GColorLightGray : GColorWhite);
  graphics_draw_text(ctx, empty ? "empty" : type, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(box.origin.x, box.origin.y + 28, box.size.w, 16),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);

  if (active) {
    graphics_context_set_stroke_color(ctx, GColorScreaminGreen);
    graphics_context_set_stroke_width(ctx, 2);
  } else {
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
  }
  graphics_draw_round_rect(ctx, box, 6);
}

void layout_filament_draw(GContext *ctx, GRect b, const PrintState *s) {
  int x = b.origin.x + 12, right_margin = 22, gap = 6;
  int w = b.size.w - 12 - right_margin;
  int box_w = (b.size.w - 12 - right_margin - gap) / 2, box_h = 44;

  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, "FILAMENT", fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(x, b.origin.y + 2, w, 16), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  int y0 = b.origin.y + 20;
  for (int i = 0; i < 4; i++) {
    int col = i % 2, row = i / 2;
    GRect box = GRect(x + col * (box_w + gap), y0 + row * (box_h + gap), box_w, box_h);
    draw_slot(ctx, box, s->tray_type[i], s->tray_color[i], s->tray_active == i);
  }

  int ext_y = y0 + 2 * box_h + gap + 12;
  bool ext_active = s->tray_active == 4;
  GColor dot = ext_active ? GColorScreaminGreen : (s->ext_color >= 0 ? GColorFromHEX(s->ext_color) : GColorDarkGray);
  graphics_context_set_fill_color(ctx, dot);
  graphics_fill_circle(ctx, GPoint(x + 6, ext_y + 6), 6);

  char label[24];
  if (s->ext_type[0]) snprintf(label, sizeof label, "External: %s", s->ext_type);
  else snprintf(label, sizeof label, "External: none");
  graphics_context_set_text_color(ctx, ext_active ? GColorWhite : GColorLightGray);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(x + 18, ext_y - 2, w - 18, 18), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}
