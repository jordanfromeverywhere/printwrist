#include <pebble.h>

static Window *s_win;
static TextLayer *s_text;
static char s_buf[64];

static void inbox(DictionaryIterator *it, void *ctx) {
  Tuple *st = dict_find(it, MESSAGE_KEY_STAGE);
  Tuple *cn = dict_find(it, MESSAGE_KEY_CONN_STATE);
  Tuple *pr = dict_find(it, MESSAGE_KEY_PROGRESS);
  snprintf(s_buf, sizeof(s_buf), "stage %d\nconn %d\nprogress %d",
           st ? (int)st->value->int32 : -1, cn ? (int)cn->value->int32 : -1, pr ? (int)pr->value->int32 : -1);
  text_layer_set_text(s_text, s_buf);
}

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
  app_message_register_inbox_received(inbox);
  app_message_open(1024, 128);
  app_event_loop();
  text_layer_destroy(s_text);
  window_destroy(s_win);
}
