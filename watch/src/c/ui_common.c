#include "ui_common.h"
#include "format.h"

GColor stage_color(Stage s) {
  switch (s) {
    case STAGE_PRINTING: return GColorScreaminGreen;
    case STAGE_DONE: return GColorElectricBlue;
    case STAGE_PAUSED: return GColorChromeYellow;
    case STAGE_FAILED: return GColorSunsetOrange;
    default: return GColorLightGray;
  }
}

static bool stage_icon(Stage s, IconId *out) {
  switch (s) {
    case STAGE_PRINTING: *out = ICON_PLAY; return true;
    case STAGE_DONE: *out = ICON_CHECK; return true;
    case STAGE_PAUSED: *out = ICON_PAUSE; return true;
    case STAGE_FAILED: *out = ICON_X; return true;
    default: return false;
  }
}

void ui_draw_stage(GContext *ctx, GRect box, Stage s, GTextAlignment align) {
  GFont f = fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD);
  const char *label = stage_label(s);
  GSize ts = graphics_text_layout_get_content_size(label, f, box, GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft);
  IconId icon;
  bool has_icon = stage_icon(s, &icon);
  int w = ts.w + (has_icon ? 16 : 0);
  int x = align == GTextAlignmentCenter ? box.origin.x + (box.size.w - w) / 2
        : align == GTextAlignmentRight ? box.origin.x + box.size.w - w : box.origin.x;
  GColor c = stage_color(s);
  if (has_icon) icon_draw(ctx, icon, GPoint(x, box.origin.y + 3), c);
  graphics_context_set_text_color(ctx, c);
  graphics_draw_text(ctx, label, f, GRect(x + (has_icon ? 16 : 0), box.origin.y - 2, ts.w + 2, box.size.h),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
}

void ui_draw_percent(GContext *ctx, GRect box, int progress, const char *num_font_key) {
  char num[4];
  snprintf(num, sizeof num, "%d", clamp_progress(progress));
  GFont nf = fonts_get_system_font(num_font_key), pf = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  GSize ns = graphics_text_layout_get_content_size(num, nf, box, GTextOverflowModeFill, GTextAlignmentLeft);
  GSize ps = graphics_text_layout_get_content_size("%", pf, box, GTextOverflowModeFill, GTextAlignmentLeft);
  int x = box.origin.x + (box.size.w - ns.w - ps.w) / 2;
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, num, nf, GRect(x, box.origin.y, ns.w + 2, ns.h + 4), GTextOverflowModeFill, GTextAlignmentLeft, NULL);
  graphics_draw_text(ctx, "%", pf, GRect(x + ns.w + 1, box.origin.y + ns.h - ps.h - 2, ps.w + 2, ps.h + 4),
                     GTextOverflowModeFill, GTextAlignmentLeft, NULL);
}

void ui_draw_icon_value(GContext *ctx, GRect box, IconId icon, const char *value) {
  icon_draw(ctx, icon, GPoint(box.origin.x + (box.size.w - 12) / 2, box.origin.y), GColorLightGray);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, value, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                     GRect(box.origin.x, box.origin.y + 12, box.size.w, 22), GTextOverflowModeTrailingEllipsis,
                     GTextAlignmentCenter, NULL);
}

void ui_draw_row(GContext *ctx, GRect row, IconId icon, GColor icon_color, const char *label, const char *value) {
  icon_draw(ctx, icon, GPoint(row.origin.x, row.origin.y + 6), icon_color);
  GFont f = fonts_get_system_font(FONT_KEY_GOTHIC_18);
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, label, f, GRect(row.origin.x + 18, row.origin.y - 2, row.size.w / 2, 22),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, value, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                     GRect(row.origin.x + row.size.w / 2, row.origin.y - 2, row.size.w / 2, 22),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentRight, NULL);
}

void ui_draw_bar(GContext *ctx, GRect box, int progress, GColor fill) {
  int r = box.size.h / 2;
  graphics_context_set_fill_color(ctx, GColorDarkGray);
  graphics_fill_rect(ctx, box, r, GCornersAll);
  int w = box.size.w * clamp_progress(progress) / 100;
  if (w > 0) {
    graphics_context_set_fill_color(ctx, fill);
    graphics_fill_rect(ctx, GRect(box.origin.x, box.origin.y, w < box.size.h ? box.size.h : w, box.size.h), r, GCornersAll);
  }
}

bool ui_clock24(void) { return clock_is_24h_style(); }

void ui_draw_conn(GContext *ctx, GRect body, ConnState c) {
  const char *msg = "Connecting...";
  switch (c) {
    case CONN_NEED_LOGIN: msg = "Open PrintWrist settings on your phone to sign in."; break;
    case CONN_NEED_CODE: msg = "Enter the code from your email in PrintWrist settings."; break;
    case CONN_RELAY_DOWN: msg = "Can't reach Bambu Lab. Retrying."; break;
    case CONN_TFA_UNSUPPORTED: msg = "Accounts that use an authenticator app aren't supported yet."; break;
    case CONN_NO_PRINTER: msg = "No printer found on this Bambu account."; break;
    default: break;
  }
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, msg, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD), grect_inset(body, GEdgeInsets(40, 14, 0, 14)),
                     GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}
