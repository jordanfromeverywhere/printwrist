#include <pebble.h>
#include "messaging.h"
#include "status_window.h"
#include "alert_window.h"

static void on_state(void) { status_window_refresh(); }
static void on_alert(AlertKind kind, bool vibrate) { alert_window_show(kind, vibrate); }
static void on_control(int result) {
  status_window_toast(result == 0 ? "Command sent" : (result == 1 ? "Printer refused" : "Couldn't send"));
  if (result == 0) vibes_short_pulse();
}

int main(void) {
  Window *w = status_window_create();
  window_stack_push(w, true);
  messaging_init(on_state, on_alert, on_control);
  app_event_loop();
  window_destroy(w);
}
