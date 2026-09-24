#include <pebble.h>
#include "code_window.h"
#include "messaging.h"
#include "status_window.h"

#define CODE_LEN 6

static Window *s_win;
static StatusBarLayer *s_bar;
static Layer *s_canvas;
static int s_digits[CODE_LEN];
static int s_cur;

static void draw(Layer *layer, GContext *ctx) {
  GRect b = layer_get_bounds(layer);
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, b, 0, GCornerNone);

  graphics_context_set_text_color(ctx, GColorWhite);
  graphics_draw_text(ctx, "Code from email", fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD),
                     GRect(0, 20, b.size.w, 24), GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);

  int box_w = 24, box_h = 34, gap = 5;
  int total_w = CODE_LEN * box_w + (CODE_LEN - 1) * gap;
  int x = b.origin.x + (b.size.w - total_w) / 2;
  int y = 78;
  char digit[2] = {0};
  for (int i = 0; i < CODE_LEN; i++) {
    GRect box = GRect(x, y, box_w, box_h);
    bool cur = i == s_cur;
    graphics_context_set_stroke_color(ctx, cur ? GColorScreaminGreen : GColorDarkGray);
    graphics_context_set_stroke_width(ctx, cur ? 2 : 1);
    graphics_draw_round_rect(ctx, box, 5);
    digit[0] = '0' + s_digits[i];
    graphics_context_set_text_color(ctx, cur ? GColorScreaminGreen : GColorWhite);
    graphics_draw_text(ctx, digit, fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD),
                       GRect(x, y + 4, box_w, box_h), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
    x += box_w + gap;
  }

  graphics_context_set_text_color(ctx, GColorLightGray);
  graphics_draw_text(ctx, "Up/Down change \xc2\xb7 Select next", fonts_get_system_font(FONT_KEY_GOTHIC_14),
                     GRect(4, b.size.h - 34, b.size.w - 8, 34), GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}

static void close_window(void) { window_stack_remove(s_win, true); }

static void send_code(void) {
  char code[CODE_LEN + 1];
  for (int i = 0; i < CODE_LEN; i++) code[i] = '0' + s_digits[i];
  code[CODE_LEN] = '\0';
  bool ok = messaging_send_code(code);
  close_window();
  status_window_toast(ok ? "Code sent" : "Couldn't send");
  vibes_short_pulse();
}

static void up_click(ClickRecognizerRef r, void *ctx) {
  s_digits[s_cur] = (s_digits[s_cur] + 1) % 10;
  layer_mark_dirty(s_canvas);
}

static void down_click(ClickRecognizerRef r, void *ctx) {
  s_digits[s_cur] = (s_digits[s_cur] + 9) % 10;
  layer_mark_dirty(s_canvas);
}

static void select_click(ClickRecognizerRef r, void *ctx) {
  if (s_cur == CODE_LEN - 1) { send_code(); return; }
  s_cur++;
  layer_mark_dirty(s_canvas);
}

static void back_click(ClickRecognizerRef r, void *ctx) { close_window(); }

static void clicks(void *ctx) {
  window_single_click_subscribe(BUTTON_ID_UP, up_click);
  window_single_click_subscribe(BUTTON_ID_DOWN, down_click);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click);
  window_single_click_subscribe(BUTTON_ID_BACK, back_click);
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

void code_window_open(void) {
  if (s_win) return;
  for (int i = 0; i < CODE_LEN; i++) s_digits[i] = 0;
  s_cur = 0;
  s_win = window_create();
  window_set_background_color(s_win, GColorBlack);
  window_set_click_config_provider(s_win, clicks);
  window_set_window_handlers(s_win, (WindowHandlers){.load = load, .unload = unload});
  window_stack_push(s_win, true);
}
