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

/* One large slot card: used for an HT unit's single tray and for the external-spool card on the
   no-AMS page. `label` is drawn as given (already formatted, e.g. "External: PLA" or "No spool")
   when `has` is false, or the filament type when `has` is true. */
static void draw_big_slot(GContext *ctx, GRect box, bool has, int32_t color, const char *label, bool active) {
  GPoint c = GPoint(box.origin.x + box.size.w / 2, box.origin.y + 22);

  if (!has) {
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_line(ctx, GPoint(c.x - 12, c.y - 4), GPoint(c.x - 4, c.y - 12));
    graphics_draw_line(ctx, GPoint(c.x - 12, c.y + 4), GPoint(c.x + 4, c.y - 12));
    graphics_draw_line(ctx, GPoint(c.x - 4, c.y + 12), GPoint(c.x + 12, c.y - 4));
  } else {
    GColor fill = color >= 0 ? GColorFromHEX(color) : GColorLightGray;
    graphics_context_set_fill_color(ctx, fill);
    graphics_fill_circle(ctx, c, 14);
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
    graphics_draw_circle(ctx, c, 14);
  }

  graphics_context_set_text_color(ctx, has ? GColorWhite : GColorLightGray);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(box.origin.x, box.origin.y + 40, box.size.w, 16),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);

  if (active) {
    graphics_context_set_stroke_color(ctx, GColorScreaminGreen);
    graphics_context_set_stroke_width(ctx, 2);
  } else {
    graphics_context_set_stroke_color(ctx, GColorDarkGray);
    graphics_context_set_stroke_width(ctx, 1);
  }
  graphics_draw_round_rect(ctx, box, 8);
}

static void draw_title(GContext *ctx, GRect b, int x, int w, const char *title) {
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, title, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(x, b.origin.y + 2, w, 16), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

static void draw_ext_row(GContext *ctx, int x, int w, int ext_y, const char *ext_type, int32_t ext_color, bool ext_active) {
  GColor dot = ext_active ? GColorScreaminGreen : (ext_color >= 0 ? GColorFromHEX(ext_color) : GColorDarkGray);
  graphics_context_set_fill_color(ctx, dot);
  graphics_fill_circle(ctx, GPoint(x + 6, ext_y + 6), 6);

  char label[24];
  if (ext_type[0]) snprintf(label, sizeof label, "External: %s", ext_type);
  else snprintf(label, sizeof label, "External: none");
  graphics_context_set_text_color(ctx, ext_active ? GColorWhite : GColorLightGray);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(x + 18, ext_y - 2, w - 18, 18), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

void layout_filament_draw(GContext *ctx, GRect b, const PrintState *s, int unit) {
  int x = b.origin.x + 12, right_margin = 22, gap = 6;
  int w = b.size.w - 12 - right_margin;
  int y0 = b.origin.y + 20;

  if (s->unit_count == 0) {
    bool has = s->ext_type[0] != '\0';
    char label[24];

    draw_title(ctx, b, x, w, "NO AMS");
    if (has) snprintf(label, sizeof label, "External: %s", s->ext_type);
    else snprintf(label, sizeof label, "No spool");
    draw_big_slot(ctx, GRect(x, y0, w, 60), has, s->ext_color, label, s->ext_active != 0);
    return;
  }

  const AmsUnit *u = &s->units[unit];
  int n = 1, i, ext_y;
  for (i = 0; i < unit; i++) { if (s->units[i].kind == u->kind) n++; }

  char title[16];
  snprintf(title, sizeof title, u->kind == 'H' ? "AMS HT %d" : "AMS %d", n);
  draw_title(ctx, b, x, w, title);

  if (s->unit_count > 1) {
    char kn[24];
    snprintf(kn, sizeof kn, "%d/%d", unit + 1, s->unit_count);
    graphics_context_set_text_color(ctx, GColorLightGray);
    graphics_draw_text(ctx, kn, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                       GRect(x, b.origin.y + 2, w, 16), GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
  }

  if (u->kind == 'H') {
    bool has = u->type[0][0] != '\0';
    draw_big_slot(ctx, GRect(x, y0, w, 60), has, u->color[0], has ? u->type[0] : "empty", u->active == 0);
    ext_y = y0 + 60 + 12;
  } else {
    int box_w = (w - gap) / 2, box_h = 44;
    for (i = 0; i < 4; i++) {
      int col = i % 2, row = i / 2;
      GRect box = GRect(x + col * (box_w + gap), y0 + row * (box_h + gap), box_w, box_h);
      draw_slot(ctx, box, u->type[i], u->color[i], u->active == i);
    }
    ext_y = y0 + 2 * box_h + gap + 12;
  }

  draw_ext_row(ctx, x, w, ext_y, s->ext_type, s->ext_color, s->ext_active != 0);
}
