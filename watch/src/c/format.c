#include "format.h"
#include <stdio.h>

void format_remaining(int minutes, char *buf, size_t n) {
  if (minutes < 0) minutes = 0;
  if (minutes >= 60) snprintf(buf, n, "%dh %dm", minutes / 60, minutes % 60);
  else snprintf(buf, n, "%dm", minutes);
}

void format_clock(int hour, int minute, bool clock24, char *buf, size_t n) {
  if (clock24) { snprintf(buf, n, "%02d:%02d", hour, minute); return; }
  int h = hour % 12;
  snprintf(buf, n, "%d:%02d", h == 0 ? 12 : h, minute);
}

void format_finish(int now_hour, int now_min, int remaining_min, bool clock24, char *buf, size_t n) {
  if (remaining_min < 0) remaining_min = 0;
  int total = (now_hour * 60 + now_min + remaining_min) % (24 * 60);
  format_clock(total / 60, total % 60, clock24, buf, n);
}

void format_temp(int t, char *buf, size_t n) {
  if (t <= -1000) snprintf(buf, n, "--");
  else snprintf(buf, n, "%d\xc2\xb0", t);
}

const char *stage_label(int stage) {
  switch (stage) {
    case 0: return "IDLE";
    case 1: return "PRINTING";
    case 2: return "PAUSED";
    case 3: return "DONE";
    case 4: return "FAILED";
    default: return "OFFLINE";
  }
}

int clamp_progress(int p) { return p < 0 ? 0 : (p > 100 ? 100 : p); }
