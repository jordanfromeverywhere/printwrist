#include <pebble.h>
#include "messaging.h"
#include "status_window.h"
#include "alert_window.h"

static void on_state(void) {
  static ConnState s_prev_conn = CONN_CONNECTING;
  if (g_state.conn == CONN_NEED_CODE && s_prev_conn != CONN_NEED_CODE) vibes_short_pulse();
  s_prev_conn = g_state.conn;
  status_window_refresh();
}
static void on_alert(AlertKind kind, bool vibrate) { alert_window_show(kind, vibrate); }

static const char *control_banner(int action, int result) {
  if (result == CONTROL_RESULT_REJECTED) return "Printer refused";
  if (result == CONTROL_RESULT_FAILED) return "Couldn't send";
  switch (action) {
    case CONTROL_PAUSE: return "Paused";
    case CONTROL_RESUME: return "Resumed";
    case CONTROL_STOP: return "Stopping";
    case CONTROL_LIGHT_ON: return "Light on";
    case CONTROL_LIGHT_OFF: return "Light off";
    case CONTROL_REFRESH: return "Refreshing";
    case CONTROL_SPEED_SILENT: return "Speed: Silent";
    case CONTROL_SPEED_STANDARD: return "Speed: Standard";
    case CONTROL_SPEED_SPORT: return "Speed: Sport";
    case CONTROL_SPEED_LUDICROUS: return "Speed: Ludicrous";
    default: return "Command sent";
  }
}

static void on_control(int result) {
  status_window_toast(control_banner(messaging_last_action(), result));
  vibes_short_pulse();
}

int main(void) {
  Window *w = status_window_create();
  window_stack_push(w, true);
  messaging_init(on_state, on_alert, on_control);
  app_event_loop();
  window_destroy(w);
}
