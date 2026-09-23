#include <pebble.h>
#include "control_menu.h"
#include "messaging.h"

static ActionMenuLevel *s_root, *s_stop;

static void perform(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  messaging_send_control((int)(uintptr_t)action_menu_item_get_action_data(item));
}

static void did_close(ActionMenu *menu, const ActionMenuItem *item, void *ctx) {
  action_menu_hierarchy_destroy(s_root, NULL, NULL);
  s_root = s_stop = NULL;
}

void control_menu_open(Stage stage) {
  if (s_root) return;
  if (stage != STAGE_PRINTING && stage != STAGE_PAUSED) return;
  s_root = action_menu_level_create(2);
  if (stage == STAGE_PRINTING) action_menu_level_add_action(s_root, "Pause", perform, (void *)(uintptr_t)1);
  else action_menu_level_add_action(s_root, "Resume", perform, (void *)(uintptr_t)2);
  s_stop = action_menu_level_create(1);
  action_menu_level_add_action(s_stop, "Yes, stop print", perform, (void *)(uintptr_t)3);
  action_menu_level_add_child(s_root, s_stop, "Stop print");
  ActionMenuConfig cfg = {
    .root_level = s_root,
    .colors = {.background = GColorChromeYellow, .foreground = GColorBlack},
    .align = ActionMenuAlignCenter,
    .did_close = did_close,
  };
  action_menu_open(&cfg);
}
