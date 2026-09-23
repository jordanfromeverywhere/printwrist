#include "status_window.h"
#include "layouts.h"
#include "ui_common.h"
#include "control_menu.h"

static Window *s_window;
static StatusBarLayer *s_bar;
static Layer *s_canvas;
static char s_toast[40];
static AppTimer *s_toast_timer;

static void draw(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, b, 0, GCornerNone);
  if (!g_state.has_status && g_state.conn != CONN_OK) { ui_draw_conn(ctx, b, g_state.conn); return; }
  switch (g_state.layout) {
    case LAYOUT_BIG:
      layout_big_draw(ctx, b, &g_state);
      break;
    case LAYOUT_DENSE:
      layout_dense_draw(ctx, b, &g_state);
      break;
    default:
      layout_arc_draw(ctx, b, &g_state);
      break;
  }
  const char *banner = s_toast[0] ? s_toast
    : (g_state.conn == CONN_RELAY_DOWN ? "Can't reach service"
    : (g_state.conn == CONN_NEED_LOGIN ? "Sign in again on your phone" : NULL));
  if (banner) {
    GRect r = GRect(0, b.size.h - 20, b.size.w, 20);
    graphics_context_set_fill_color(ctx, GColorDarkGray);
    graphics_fill_rect(ctx, r, 0, GCornerNone);
    graphics_context_set_text_color(ctx, GColorWhite);
    graphics_draw_text(ctx, banner, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD), GRect(4, r.origin.y + 1, b.size.w - 8, 18),
                       GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
  }
}

static void clear_toast(void *ctx) { s_toast[0] = '\0'; s_toast_timer = NULL; layer_mark_dirty(s_canvas); }

void status_window_toast(const char *text) {
  strncpy(s_toast, text, sizeof s_toast - 1);
  s_toast[sizeof s_toast - 1] = '\0';
  if (s_toast_timer) app_timer_cancel(s_toast_timer);
  s_toast_timer = app_timer_register(3000, clear_toast, NULL);
  if (s_canvas) layer_mark_dirty(s_canvas);
}

static void select_long(ClickRecognizerRef r, void *ctx) {
  if (g_state.control_enabled && g_state.conn == CONN_OK) control_menu_open(g_state.stage);
}

static void click_config(void *ctx) {
  window_long_click_subscribe(BUTTON_ID_SELECT, 600, select_long, NULL);
}

static void load(Window *w) {
  Layer *root = window_get_root_layer(w);
  GRect b = layer_get_bounds(root);
  s_bar = status_bar_layer_create();
  status_bar_layer_set_colors(s_bar, GColorBlack, GColorLightGray);
  status_bar_layer_set_separator_mode(s_bar, StatusBarLayerSeparatorModeNone);
  layer_add_child(root, status_bar_layer_get_layer(s_bar));
  s_canvas = layer_create(GRect(0, STATUS_BAR_LAYER_HEIGHT, b.size.w, b.size.h - STATUS_BAR_LAYER_HEIGHT));
  layer_set_update_proc(s_canvas, draw);
  layer_add_child(root, s_canvas);
}

static void unload(Window *w) {
  layer_destroy(s_canvas); s_canvas = NULL;
  status_bar_layer_destroy(s_bar);
}

Window *status_window_create(void) {
  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_click_config_provider(s_window, click_config);
  window_set_window_handlers(s_window, (WindowHandlers){.load = load, .unload = unload});
  return s_window;
}

void status_window_refresh(void) { if (s_canvas) layer_mark_dirty(s_canvas); }
