#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../src/c/format.h"

#define TEMP_NONE_FOR_TEST (-1000)
static char b[16];

int main(void) {
  format_remaining(134, b, sizeof b); assert(strcmp(b, "2h 14m") == 0);
  format_remaining(45, b, sizeof b);  assert(strcmp(b, "45m") == 0);
  format_remaining(0, b, sizeof b);   assert(strcmp(b, "0m") == 0);
  format_remaining(-5, b, sizeof b);  assert(strcmp(b, "0m") == 0);
  format_remaining(1500, b, sizeof b); assert(strcmp(b, "25h 0m") == 0);

  format_clock(16, 46, true, b, sizeof b);  assert(strcmp(b, "16:46") == 0);
  format_clock(16, 46, false, b, sizeof b); assert(strcmp(b, "4:46") == 0);
  format_clock(0, 5, false, b, sizeof b);   assert(strcmp(b, "12:05") == 0);

  format_finish(14, 32, 134, true, b, sizeof b); assert(strcmp(b, "16:46") == 0);
  format_finish(23, 30, 45, true, b, sizeof b);  assert(strcmp(b, "00:15") == 0);

  format_temp(238, b, sizeof b);       assert(strcmp(b, "238\xc2\xb0") == 0);
  format_temp(TEMP_NONE_FOR_TEST, b, sizeof b); assert(strcmp(b, "--") == 0);

  assert(strcmp(stage_label(1), "PRINTING") == 0);
  assert(strcmp(stage_label(3), "DONE") == 0);
  assert(strcmp(stage_label(99), "OFFLINE") == 0);
  assert(clamp_progress(-3) == 0 && clamp_progress(140) == 100 && clamp_progress(65) == 65);
  puts("format tests passed");
  return 0;
}
