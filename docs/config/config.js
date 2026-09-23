(function (root) {
  var DEFAULT_SETTINGS = {
    layout: 'arc', controlEnabled: false,
    alerts: {done: true, failed: true, paused: true},
    quiet: {on: false, start: '22:00', end: '07:00'}
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function mergeSettings(s) {
    var out = clone(DEFAULT_SETTINGS);
    s = s || {};
    if (s.layout === 'arc' || s.layout === 'big' || s.layout === 'dense') out.layout = s.layout;
    if (typeof s.controlEnabled === 'boolean') out.controlEnabled = s.controlEnabled;
    ['done', 'failed', 'paused'].forEach(function (k) {
      if (s.alerts && typeof s.alerts[k] === 'boolean') out.alerts[k] = s.alerts[k];
    });
    if (s.quiet) {
      if (typeof s.quiet.on === 'boolean') out.quiet.on = s.quiet.on;
      if (isValidTime(s.quiet.start)) out.quiet.start = s.quiet.start;
      if (isValidTime(s.quiet.end)) out.quiet.end = s.quiet.end;
    }
    return out;
  }

  function isValidTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

  function parseState(hash) {
    var raw = {};
    try { raw = JSON.parse(decodeURIComponent(String(hash || '').replace(/^#/, ''))) || {}; } catch (e) { raw = {}; }
    return {
      signedIn: raw.signedIn === true,
      email: typeof raw.email === 'string' ? raw.email : '',
      awaitingCode: raw.awaitingCode === true,
      notice: typeof raw.notice === 'string' ? raw.notice : '',
      printers: Array.isArray(raw.printers) ? raw.printers : [],
      serial: typeof raw.serial === 'string' ? raw.serial : '',
      settings: mergeSettings(raw.settings)
    };
  }

  function loginResult(email, password) { return {action: 'login', email: String(email).trim(), password: String(password)}; }
  function codeResult(code) { return {action: 'code', code: String(code).replace(/\D/g, '')}; }
  function saveResult(serial, settings) { return {action: 'save', serial: serial, settings: mergeSettings(settings)}; }

  function returnToFromSearch(search) {
    try {
      var query = String(search || '').replace(/^\?/, '');
      if (!query) return '';
      var pairs = query.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (pair[0] === 'return_to' && pair[1]) {
          return decodeURIComponent(pair[1]);
        }
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function closeUrl(result, returnTo) { return (returnTo || 'pebblejs://close#') + encodeURIComponent(JSON.stringify(result)); }

  var api = {parseState: parseState, loginResult: loginResult, codeResult: codeResult,
             saveResult: saveResult, closeUrl: closeUrl, returnToFromSearch: returnToFromSearch, isValidTime: isValidTime,
             mergeSettings: mergeSettings, DEFAULT_SETTINGS: DEFAULT_SETTINGS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PWConfig = api;
})(this);
