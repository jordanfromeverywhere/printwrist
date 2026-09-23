var C = require('./constants.js');
var KEY = 'pw_settings';
var DEFAULTS = {layout: 'arc', controlEnabled: false, alerts: {done: true, failed: true, paused: true},
                quiet: {on: false, start: '22:00', end: '07:00'}, relayUrl: ''};

function validTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

function merge(s) {
  var out = JSON.parse(JSON.stringify(DEFAULTS));
  s = s || {};
  if (s.layout === 'arc' || s.layout === 'big' || s.layout === 'dense') out.layout = s.layout;
  if (typeof s.controlEnabled === 'boolean') out.controlEnabled = s.controlEnabled;
  ['done', 'failed', 'paused'].forEach(function (k) {
    if (s.alerts && typeof s.alerts[k] === 'boolean') out.alerts[k] = s.alerts[k];
  });
  if (s.quiet) {
    if (typeof s.quiet.on === 'boolean') out.quiet.on = s.quiet.on;
    if (validTime(s.quiet.start)) out.quiet.start = s.quiet.start;
    if (validTime(s.quiet.end)) out.quiet.end = s.quiet.end;
  }
  if (typeof s.relayUrl === 'string') {
    var trimmed = s.relayUrl.trim();
    out.relayUrl = trimmed === '' || /^https:\/\/[^\s]+$/.test(trimmed) ? trimmed : '';
  }
  return out;
}

function load(storage) {
  try { return merge(JSON.parse(storage.getItem(KEY))); } catch (e) { return merge(null); }
}
function save(storage, s) { storage.setItem(KEY, JSON.stringify(merge(s))); }
function relayBase(s) { return (s.relayUrl || C.DEFAULT_RELAY).replace(/\/+$/, ''); }

module.exports = {DEFAULTS: DEFAULTS, merge: merge, load: load, save: save, relayBase: relayBase};
