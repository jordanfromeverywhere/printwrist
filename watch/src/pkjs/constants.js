module.exports = {
  CONFIG_URL: 'https://jordanfromeverywhere.github.io/printwrist/config/',
  STAGE_CODES: {idle: 0, printing: 1, paused: 2, done: 3, failed: 4, offline: 5},
  ALERT_CODES: {done: 1, failed: 2, paused: 3, reconnect: 4},
  LAYOUT_CODES: {arc: 0, big: 1, dense: 2},
  CONN: {ok: 0, connecting: 1, needLogin: 2, needCode: 3, relayDown: 4, tfaUnsupported: 5, noPrinter: 6},
  CONTROL_ACTIONS: {1: 'pause', 2: 'resume', 3: 'stop'},
  CONTROL_RESULT: {ok: 0, rejected: 1, failed: 2},
  TEMP_NONE: -1000
};
