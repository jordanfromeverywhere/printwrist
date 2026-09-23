#pragma once
#include <stdbool.h>
#include <stddef.h>

void format_remaining(int minutes, char *buf, size_t n);
void format_clock(int hour, int minute, bool clock24, char *buf, size_t n);
void format_finish(int now_hour, int now_min, int remaining_min, bool clock24, char *buf, size_t n);
void format_temp(int t, char *buf, size_t n);
const char *stage_label(int stage);
int clamp_progress(int p);
