#include <pebble.h>
#include "alert_window.h"
#include "ui_common.h"
#include "format.h"

static Window *s_win;
static Layer *s_canvas;
static AlertKind s_kind;

static const uint32_t FAILED_PATTERN[] = {150, 100, 150, 100, 150};
static const uint32_t PAUSED_PATTERN[] = {150, 100, 150};

static GColor header_color(AlertKind k) {
  switch (k) {
    case ALERT_DONE: return GColorElectricBlue;
    case ALERT_FAILED: return GColorSunsetOrange;
    case ALERT_PAUSED: return GColorChromeYellow;
    default: return GColorLightGray;
  }
}

static void draw(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, b, 0, GCornerNone);

  const char *title = "RECONNECT";
  IconId icon = ICON_X;
  bool has_icon = false;
  char detail[40] = "Bambu login expired";
  switch (s_kind) {
    case ALERT_DONE: title = "PRINT DONE"; icon = ICON_CHECK; has_icon = true;
      snprintf(detail, sizeof detail, "%s", g_state.job[0] ? g_state.job : "Print finished"); break;
    case ALERT_FAILED: title = "PRINT FAILED"; icon = ICON_X; has_icon = true;
      snprintf(detail, sizeof detail, "%s%s%d%% L%d", g_state.error_code, g_state.error_code[0] ? " \xc2\xb7 " : "",
               g_state.progress, g_state.layer); break;
    case ALERT_PAUSED: title = "PAUSED"; icon = ICON_PAUSE; has_icon = true;
      snprintf(detail, sizeof detail, "At %d%% L%d", g_state.progress, g_state.layer); break;
    default: break;
  }

  GRect head = GRect(0, 0, b.size.w, 52);
  graphics_context_set_fill_color(ctx, header_color(s_kind));
  graphics_fill_rect(ctx, head, 0, GCornerNone);
  if (has_icon) icon_draw(ctx, icon, GPoint(10, 10), GColorBlack);
  graphics_context_set_text_color(ctx, GColorBlack);
  graphics_draw_text(ctx, title, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD), GRect(has_icon ? 26 : 10, 0, b.size.w - 30, 28),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
  graphics_draw_text(ctx, detail, fonts_get_system_font(FONT_KEY_GOTHIC_14), GRect(10, 28, b.size.w - 20, 18),
                     GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);

  if (s_kind == ALERT_RECONNECT) {
    graphics_context_set_text_color(ctx, GColorLightGray);
    graphics_draw_text(ctx, "Open the Pebble app on your phone and sign in to PrintWrist again.",
                       fonts_get_system_font(FONT_KEY_GOTHIC_18), GRect(10, 62, b.size.w - 20, 100),
                       GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);
  } else {
    char noz[8], bed[8], lay[16];
    format_temp(g_state.nozzle, noz, sizeof noz);
    format_temp(g_state.bed, bed, sizeof bed);
    snprintf(lay, sizeof lay, "%d/%d", g_state.layer, g_state.total_layers);
    int x = 10, w = b.size.w - 20, y = 62;
    ui_draw_row(ctx, GRect(x, y, w, 24), ICON_NOZZLE, GColorLightGray, "Nozzle", noz);
    ui_draw_row(ctx, GRect(x, y + 26, w, 24), ICON_BED, GColorLightGray, "Bed", bed);
    ui_draw_row(ctx, GRect(x, y + 52, w, 24), ICON_LAYERS, GColorLightGray, "Layer", lay);
  }

  GRect hint = GRect(0, b.size.h - 26, b.size.w, 26);
  graphics_context_set_stroke_color(ctx, GColorDarkGray);
  graphics_draw_line(ctx, GPoint(0, hint.origin.y), GPoint(b.size.w, hint.origin.y));
  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, "Press any button to dismiss", fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(0, hint.origin.y + 4, b.size.w, 20), GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
}

static void dismiss(ClickRecognizerRef r, void *ctx) { window_stack_remove(s_win, true); }

static void clicks(void *ctx) {
  window_single_click_subscribe(BUTTON_ID_SELECT, dismiss);
  window_single_click_subscribe(BUTTON_ID_UP, dismiss);
  window_single_click_subscribe(BUTTON_ID_DOWN, dismiss);
}

static void load(Window *w) {
  Layer *root = window_get_root_layer(w);
  s_canvas = layer_create(layer_get_bounds(root));
  layer_set_update_proc(s_canvas, draw);
  layer_add_child(root, s_canvas);
}

static void unload(Window *w) {
  layer_destroy(s_canvas);
  s_canvas = NULL;
  window_destroy(s_win);
  s_win = NULL;
}

static void vibrate_for(AlertKind k) {
  switch (k) {
    case ALERT_DONE: vibes_long_pulse(); break;
    case ALERT_FAILED: vibes_enqueue_custom_pattern((VibePattern){.durations = FAILED_PATTERN, .num_segments = ARRAY_LENGTH(FAILED_PATTERN)}); break;
    case ALERT_PAUSED: vibes_enqueue_custom_pattern((VibePattern){.durations = PAUSED_PATTERN, .num_segments = ARRAY_LENGTH(PAUSED_PATTERN)}); break;
    case ALERT_RECONNECT: vibes_short_pulse(); break;
    default: break;
  }
}

void alert_window_show(AlertKind kind, bool vibrate) {
  if (kind == ALERT_NONE) return;
  s_kind = kind;
  if (vibrate) vibrate_for(kind);
  if (s_win) { layer_mark_dirty(s_canvas); return; }
  s_win = window_create();
  window_set_background_color(s_win, GColorBlack);
  window_set_click_config_provider(s_win, clicks);
  window_set_window_handlers(s_win, (WindowHandlers){.load = load, .unload = unload});
  window_stack_push(s_win, true);
}
