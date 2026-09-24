#include <pebble.h>
#include "control_menu.h"
#include "messaging.h"
#include "status_window.h"
#include "confirm_window.h"

static ActionMenuLevel *s_root, *s_speed;
static char s_speed_labels[4][16];

static void send_action(int action) {
  if (!messaging_send_control(action)) {
    status_window_toast("Couldn't send");
    vibes_short_pulse();
  }
}

/* Resume, Light, Refresh and every speed choice send right away. */
static void perform_direct(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  send_action((int)(uintptr_t)action_menu_item_get_action_data(item));
}

/* Pause and Stop don't send here; did_close reads the action back off the
   item and opens the confirm window once the ActionMenu has finished
   closing itself. */
static void perform_confirm(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
}

static void add_speed_item(int index, const char *name, int speed_level, int action) {
  if (speed_level == g_state.speed_level) snprintf(s_speed_labels[index], sizeof s_speed_labels[index], "%s (now)", name);
  else snprintf(s_speed_labels[index], sizeof s_speed_labels[index], "%s", name);
  action_menu_level_add_action(s_speed, s_speed_labels[index], perform_direct, (void *)(uintptr_t)action);
}

static void did_close(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  int action = item ? (int)(uintptr_t)action_menu_item_get_action_data(item) : 0;
  action_menu_hierarchy_destroy(s_root, NULL, NULL);
  s_root = s_speed = NULL;

  if (action != CONTROL_PAUSE && action != CONTROL_STOP) return;
  char detail[48];
  snprintf(detail, sizeof detail, "%s \xc2\xb7 %d%%", g_state.job[0] ? g_state.job : "Print", g_state.progress);
  confirm_window_open(action == CONTROL_PAUSE ? "Pause this print?" : "Stop this print?", detail, action);
}

void control_menu_open(Stage stage) {
  if (s_root) return;
  if (stage != STAGE_PRINTING && stage != STAGE_PAUSED) return;

  s_root = action_menu_level_create(5);
  if (stage == STAGE_PRINTING) action_menu_level_add_action(s_root, "Pause", perform_confirm, (void *)(uintptr_t)CONTROL_PAUSE);
  else action_menu_level_add_action(s_root, "Resume", perform_direct, (void *)(uintptr_t)CONTROL_RESUME);
  action_menu_level_add_action(s_root, "Stop print", perform_confirm, (void *)(uintptr_t)CONTROL_STOP);
  bool light_on = g_state.light == 1;
  action_menu_level_add_action(s_root, light_on ? "Light off" : "Light on", perform_direct,
                                (void *)(uintptr_t)(light_on ? CONTROL_LIGHT_OFF : CONTROL_LIGHT_ON));
  action_menu_level_add_action(s_root, "Refresh now", perform_direct, (void *)(uintptr_t)CONTROL_REFRESH);

  s_speed = action_menu_level_create(4);
  add_speed_item(0, "Silent", 1, CONTROL_SPEED_SILENT);
  add_speed_item(1, "Standard", 2, CONTROL_SPEED_STANDARD);
  add_speed_item(2, "Sport", 3, CONTROL_SPEED_SPORT);
  add_speed_item(3, "Ludicrous", 4, CONTROL_SPEED_LUDICROUS);
  action_menu_level_add_child(s_root, s_speed, "Print speed");

  ActionMenuConfig cfg = {
    .root_level = s_root,
    .colors = {.background = GColorChromeYellow, .foreground = GColorBlack},
    .align = ActionMenuAlignCenter,
    .did_close = did_close,
  };
  action_menu_open(&cfg);
}
