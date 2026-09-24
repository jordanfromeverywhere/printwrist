#pragma once

/* A one-question confirm screen used before Pause and Stop. Select sends
   `action` via messaging_send_control and pops; Down or Back pops without
   sending. `question` and `detail` are copied, so the caller's buffers do
   not need to outlive the call. */
void confirm_window_open(const char *question, const char *detail, int action);
