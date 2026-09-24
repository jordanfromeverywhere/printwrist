#include <pebble.h>
#include "control_menu.h"
#include "messaging.h"
#include "status_window.h"

/* Only the light and refresh are offered. Bambu firmware rejects unsigned pause, resume,
   stop and print_speed commands ("MQTT command verification failed"), so those stay in
   Bambu Handy. See Design Spec §15. */

static ActionMenuLevel *s_root;

static void perform(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  if (!messaging_send_control((int)(uintptr_t)action_menu_item_get_action_data(item))) {
    status_window_toast("Couldn't send");
    vibes_short_pulse();
  }
}

static void did_close(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  action_menu_hierarchy_destroy(s_root, NULL, NULL);
  s_root = NULL;
}

void control_menu_open(Stage stage) {
  (void)stage;
  if (s_root) return;

  s_root = action_menu_level_create(2);
  bool light_on = g_state.light == 1;
  action_menu_level_add_action(s_root, light_on ? "Light off" : "Light on", perform,
                                (void *)(uintptr_t)(light_on ? CONTROL_LIGHT_OFF : CONTROL_LIGHT_ON));
  action_menu_level_add_action(s_root, "Refresh now", perform, (void *)(uintptr_t)CONTROL_REFRESH);

  ActionMenuConfig cfg = {
    .root_level = s_root,
    .colors = {.background = GColorChromeYellow, .foreground = GColorBlack},
    .align = ActionMenuAlignCenter,
    .did_close = did_close,
  };
  action_menu_open(&cfg);
}
