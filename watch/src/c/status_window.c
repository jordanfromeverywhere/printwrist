#include "status_window.h"
#include "layouts.h"
#include "ui_common.h"
#include "control_menu.h"
#include "code_window.h"

static Window *s_window;
static StatusBarLayer *s_bar;
static Layer *s_canvas;
static char s_toast[40];
static AppTimer *s_toast_timer;
static int s_page;
static char s_pending_toast[40];
static bool s_has_pending_toast;

static int page_count(void) {
  int units = g_state.unit_count > 0 ? g_state.unit_count : 1;
  return 2 + units;
}

static const char *conn_banner(ConnState c) {
  switch (c) {
    case CONN_CONNECTING: return "Connecting...";
    case CONN_NEED_LOGIN: return "Sign in again on your phone";
    case CONN_NEED_CODE: return "Enter code on your phone";
    case CONN_RELAY_DOWN: return "Can't reach Bambu";
    case CONN_TFA_UNSUPPORTED: return "2FA app not supported";
    case CONN_NO_PRINTER: return "No printer on account";
    default: return NULL;
  }
}

static void draw_dots(GContext *ctx, GRect b) {
  int dot_x = b.origin.x + b.size.w - 8;
  int cy = b.origin.y + b.size.h / 2;
  int n = page_count();
  int top = cy - (n - 1) * 5;
  for (int i = 0; i < n; i++) {
    graphics_context_set_fill_color(ctx, i == s_page ? GColorWhite : GColorDarkGray);
    graphics_fill_rect(ctx, GRect(dot_x, top + i * 10 - 2, 5, 5), 3, GCornersAll);
  }
}

static void draw(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, b, 0, GCornerNone);
  if (!g_state.has_status && g_state.conn != CONN_OK) { ui_draw_conn(ctx, b, g_state.conn); return; }
  if (s_page >= page_count()) s_page = page_count() - 1;
  switch (s_page) {
    case 1:
      layout_details_draw(ctx, b, &g_state);
      break;
    default:
      if (s_page >= 2) { layout_filament_draw(ctx, b, &g_state, s_page - 2); break; }
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
      break;
  }
  draw_dots(ctx, b);
  const char *banner = s_toast[0] ? s_toast : conn_banner(g_state.conn);
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

static void show_toast_now(const char *text) {
  strncpy(s_toast, text, sizeof s_toast - 1);
  s_toast[sizeof s_toast - 1] = '\0';
  if (s_toast_timer) app_timer_cancel(s_toast_timer);
  s_toast_timer = app_timer_register(3000, clear_toast, NULL);
  if (s_canvas) layer_mark_dirty(s_canvas);
}

void status_window_toast(const char *text) {
  /* If the status window isn't on top (an ActionMenu, confirm or code window is), its 3s timer
     would run unseen and the banner could expire before it's ever shown. Hold it and show it (and
     start the timer) once the status window is back on top; see `appear()`. */
  if (window_stack_get_top_window() != s_window) {
    strncpy(s_pending_toast, text, sizeof s_pending_toast - 1);
    s_pending_toast[sizeof s_pending_toast - 1] = '\0';
    s_has_pending_toast = true;
    return;
  }
  show_toast_now(text);
}

static void select_click(ClickRecognizerRef r, void *ctx) {
  if (g_state.conn == CONN_NEED_CODE) code_window_open();
  else control_menu_open(g_state.stage);
}

static void page_click(int delta) {
  if (!g_state.has_status && g_state.conn != CONN_OK) return;
  int n = page_count();
  s_page = (s_page + delta + n) % n;
  if (s_canvas) layer_mark_dirty(s_canvas);
}

static void up_click(ClickRecognizerRef r, void *ctx) { page_click(-1); }
static void down_click(ClickRecognizerRef r, void *ctx) { page_click(1); }

static void click_config(void *ctx) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click);
  window_single_click_subscribe(BUTTON_ID_UP, up_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_click);
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

static void appear(Window *w) {
  if (s_has_pending_toast) {
    s_has_pending_toast = false;
    show_toast_now(s_pending_toast);
  }
}

Window *status_window_create(void) {
  s_window = window_create();
  window_set_background_color(s_window, GColorBlack);
  window_set_click_config_provider(s_window, click_config);
  window_set_window_handlers(s_window, (WindowHandlers){.load = load, .unload = unload, .appear = appear});
  return s_window;
}

void status_window_refresh(void) { if (s_canvas) layer_mark_dirty(s_canvas); }
