#include <pebble.h>
#include "c/messaging.h"

static Window *s_win;
static TextLayer *s_text;

static void win_load(Window *w) {
  Layer *root = window_get_root_layer(w);
  s_text = text_layer_create(layer_get_bounds(root));
  text_layer_set_text(s_text, "waiting");
  layer_add_child(root, text_layer_get_layer(s_text));
}

int main(void) {
  s_win = window_create();
  window_set_window_handlers(s_win, (WindowHandlers){.load = win_load});
  window_stack_push(s_win, true);
  messaging_init(NULL, NULL, NULL);
  app_event_loop();
  text_layer_destroy(s_text);
  window_destroy(s_win);
}
