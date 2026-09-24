#include <pebble.h>
#include "confirm_window.h"
#include "messaging.h"
#include "status_window.h"
#include "icons.h"

static Window *s_win;
static StatusBarLayer *s_bar;
static Layer *s_canvas;
static char s_question[40];
static char s_detail[48];
static int s_action;

static void draw_hint(GContext *ctx, GRect b, int y, IconId icon, GColor color, const char *label) {
  icon_draw(ctx, icon, GPoint(b.size.w - 46, y), color);
  graphics_context_set_text_color(ctx, color);
  graphics_draw_text(ctx, label, fonts_get_system_font(FONT_KEY_GOTHIC_14_BOLD),
                     GRect(b.size.w - 30, y - 2, 30, 20), GTextOverflowModeTrailingEllipsis,
                     GTextAlignmentLeft, NULL);
}

static void draw(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, b, 0, GCornerNone);

  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, s_question, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
                     GRect(14, 14, b.size.w - 28, 64), GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);

  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, s_detail, fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(14, 82, b.size.w - 28, 40), GTextOverflowModeWordWrap, GTextAlignmentLeft, NULL);

  draw_hint(ctx, b, 104, ICON_CHECK, GColorScreaminGreen, "Yes");
  draw_hint(ctx, b, 172, ICON_X, GColorSunsetOrange, "No");
}

static void close_window(void) { window_stack_remove(s_win, true); }

static void select_click(ClickRecognizerRef r, void *ctx) {
  if (!messaging_send_control(s_action)) {
    status_window_toast("Couldn't send");
    vibes_short_pulse();
  }
  close_window();
}

static void no_click(ClickRecognizerRef r, void *ctx) { close_window(); }

static void clicks(void *ctx) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, no_click);
  window_single_click_subscribe(BUTTON_ID_BACK, no_click);
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
  status_bar_layer_destroy(s_bar); s_bar = NULL;
  window_destroy(s_win); s_win = NULL;
}

void confirm_window_open(const char *question, const char *detail, int action) {
  if (s_win) return;
  strncpy(s_question, question, sizeof s_question - 1); s_question[sizeof s_question - 1] = '\0';
  strncpy(s_detail, detail, sizeof s_detail - 1); s_detail[sizeof s_detail - 1] = '\0';
  s_action = action;
  s_win = window_create();
  window_set_background_color(s_win, GColorBlack);
  window_set_click_config_provider(s_win, clicks);
  window_set_window_handlers(s_win, (WindowHandlers){.load = load, .unload = unload});
  window_stack_push(s_win, true);
}
