function detectAlert(prev, next) {
  if (!prev || prev === next) return null;
  if (next === 'done' || next === 'failed' || next === 'paused') return next;
  return null;
}

function toMin(t) { var p = t.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }

function inQuietHours(date, quiet) {
  if (!quiet || !quiet.on) return false;
  var m = date.getHours() * 60 + date.getMinutes(), s = toMin(quiet.start), e = toMin(quiet.end);
  if (s === e) return false;
  return s < e ? (m >= s && m < e) : (m >= s || m < e);
}

function shouldVibrate(kind, date, settings) {
  if (kind === 'failed' || kind === 'reconnect') return true;
  return !inQuietHours(date, settings.quiet);
}

function alertEnabled(kind, settings) { return kind === 'reconnect' || !!settings.alerts[kind]; }

function nextPollDelayMs(status) {
  return status && status.stage === 'printing' && status.progress >= 98 ? 10000 : 30000;
}

module.exports = {detectAlert: detectAlert, inQuietHours: inQuietHours, shouldVibrate: shouldVibrate,
                  alertEnabled: alertEnabled, nextPollDelayMs: nextPollDelayMs};
