var C = require('./constants.js');
var S = require('./settings.js');
var A = require('./alerts.js');
var P = require('./pack.js');
var auth = require('./bambu_auth.js');
var devices = require('./bambu_devices.js');
var Live = require('./bambu_live.js');
var http = require('./xhr_http.js');
var Messenger = require('./messenger.js');

var AUTH_KEY = 'pw_auth';        // {token, refresh, expiresAt, email}
var PENDING_KEY = 'pw_pending';  // {email} while waiting for an email code
var PRINTER_KEY = 'pw_printer';  // {serial, name}

var settings = S.load(localStorage);
var conn = C.CONN.connecting, notice = '', printers = [];
var lastStage = null, live = null, retryTimer = null;
var reconnectAlerted = false, authFailures = 0, ensureGen = 0;
var messenger = new Messenger(function (msg, ok, fail) { Pebble.sendAppMessage(msg, ok, fail); });

function getJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function setJSON(k, v) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }
function printer() { return getJSON(PRINTER_KEY) || {}; }
function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

function configMsg() { return P.configMessage(settings, conn, printer().name || ''); }
function setConn(c) { conn = c; messenger.push(configMsg()); }

function stopLive() {
  ensureGen++;
  if (live) { live.stop(); live = null; }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
}

function retryLater(ms) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(function () { retryTimer = null; ensurePrinter(); }, ms);
}

function saveAuth(r, fallback) {
  var a = fallback || getJSON(AUTH_KEY) || {};
  setJSON(AUTH_KEY, {token: r.token, refresh: r.refresh || a.refresh || null, expiresAt: r.expiresAt, email: a.email});
}

function withToken(cb) {
  var a = getJSON(AUTH_KEY);
  if (!a || !a.token) return cb(null);
  if (a.expiresAt - Date.now() > 5 * 60 * 1000 || !a.refresh) return cb(a.token);
  auth.refresh(http, a.refresh, function (r) {
    if (r.state !== 'ok') return cb(a.token);
    saveAuth(r, a);
    cb(r.token);
  });
}

function signedOut(showAlert) {
  stopLive();
  setJSON(AUTH_KEY, null);
  setConn(C.CONN.needLogin);
  if (showAlert && !reconnectAlerted) {
    reconnectAlerted = true;
    var m = P.statusToMessage({stage: lastStage || 'offline'});
    m.ALERT_KIND = C.ALERT_CODES.reconnect;
    m.VIBRATE = 1;
    messenger.push(m);
  }
}

function handleAuthFailure() {
  stopLive();
  authFailures++;
  if (authFailures >= 2) return signedOut(true);
  var a = getJSON(AUTH_KEY) || {};
  auth.refresh(http, a.refresh, function (r) {
    if (r.state === 'ok') saveAuth(r, a);
    retryLater(r.state === 'ok' ? 1000 : 30000);
  });
}

function onStatus(status) {
  authFailures = 0;
  if (conn !== C.CONN.ok) conn = C.CONN.ok;
  var msg = merge(configMsg(), P.statusToMessage(status));
  var next = A.nextAlertState(lastStage, status.stage);
  lastStage = next.lastStage;
  if (next.kind && A.alertEnabled(next.kind, settings)) {
    msg.ALERT_KIND = C.ALERT_CODES[next.kind];
    msg.VIBRATE = A.shouldVibrate(next.kind, new Date(), settings) ? 1 : 0;
  }
  messenger.push(msg);
}

function onLiveState(state) {
  if (state === 'live') { authFailures = 0; if (conn !== C.CONN.ok) setConn(C.CONN.ok); }
  else if (state === 'down') { if (conn !== C.CONN.relayDown) setConn(C.CONN.relayDown); }
  else if (state === 'auth') { live = null; handleAuthFailure(); }
}

function ensurePrinter() {
  var gen = ++ensureGen;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  withToken(function (token) {
    if (gen !== ensureGen) return;
    if (!token) return signedOut(false);
    devices.getUsername(http, token, function (err, username) {
      if (gen !== ensureGen) return;
      if (err && err.kind === 'auth') return handleAuthFailure();
      if (err) { setConn(C.CONN.relayDown); return retryLater(30000); }
      devices.listDevices(http, token, function (err2, list) {
        if (gen !== ensureGen) return;
        if (err2 && err2.kind === 'auth') return handleAuthFailure();
        if (err2) { setConn(C.CONN.relayDown); return retryLater(30000); }
        printers = list;
        if (!list.length) { setConn(C.CONN.noPrinter); return retryLater(60000); }
        var saved = printer();
        var keep = list.filter(function (d) { return d.serial === saved.serial; })[0] || list[0];
        setJSON(PRINTER_KEY, {serial: keep.serial, name: keep.name});
        stopLive();
        setConn(C.CONN.connecting);
        live = new Live({username: username, token: token, serial: keep.serial},
                        {onStatus: onStatus, onState: onLiveState});
        live.start();
      });
    });
  });
}

function onLoginResult(r, email) {
  if (r.state === 'ok') {
    setJSON(PENDING_KEY, null);
    setJSON(AUTH_KEY, {token: r.token, refresh: r.refresh, expiresAt: r.expiresAt, email: email});
    notice = '';
    reconnectAlerted = false;
    authFailures = 0;
    setConn(C.CONN.connecting);
    return ensurePrinter();
  }
  if (r.state === 'need_code') {
    setJSON(PENDING_KEY, {email: email});
    notice = '';
    setConn(C.CONN.needCode);
    return showSettings();
  }
  if (r.state === 'tfa_unsupported') {
    notice = "Accounts that use an authenticator app aren't supported yet.";
    setConn(C.CONN.tfaUnsupported);
    return showSettings();
  }
  notice = r.message || 'Sign in failed.';
  setConn(C.CONN.needLogin);
  showSettings();
}

function submitCode(code) {
  var pend = getJSON(PENDING_KEY);
  if (!pend) return setConn(C.CONN.needLogin);
  auth.loginWithCode(http, pend.email, code, function (res) {
    if (res.state === 'error') {
      notice = "That code didn't work. Check the latest email or start over.";
      setConn(C.CONN.needCode);
      return showSettings();
    }
    onLoginResult(res, pend.email);
  });
}

function configState() {
  var a = getJSON(AUTH_KEY), pend = getJSON(PENDING_KEY);
  return {signedIn: !!(a && a.token), email: (a && a.email) || (pend && pend.email) || '',
          awaitingCode: !!pend && !(a && a.token), notice: notice, printers: printers,
          serial: printer().serial || '', settings: settings};
}

function showSettings() {
  try {
    Pebble.openURL(C.CONFIG_URL + '#' + encodeURIComponent(JSON.stringify(configState())));
  } catch (e) {
    console.log('PrintWrist: could not reopen settings');
  }
}

Pebble.addEventListener('showConfiguration', function () {
  showSettings();
});

Pebble.addEventListener('webviewclosed', function (e) {
  var r, pend;
  try { r = JSON.parse(decodeURIComponent(e.response || '')); } catch (err) { return; }
  if (!r || !r.action) return;
  if (r.action === 'login') {
    return auth.login(http, r.email, r.password, function (res) { onLoginResult(res, r.email); });
  }
  if (r.action === 'code') {
    return submitCode(r.code);
  }
  if (r.action === 'signout') {
    setJSON(PRINTER_KEY, null);
    setJSON(PENDING_KEY, null);
    notice = '';
    return signedOut(false);
  }
  if (r.action === 'resend') {
    pend = getJSON(PENDING_KEY);
    if (!pend) return setConn(C.CONN.needLogin);
    return auth.sendCode(http, pend.email, function (sent) {
      notice = sent ? 'We sent a new code.' : "Couldn't send the code email. Try again in a minute.";
      showSettings();
    });
  }
  if (r.action === 'save') {
    settings = S.merge(r.settings);
    S.save(localStorage, settings);
    var chosen = printers.filter(function (d) { return d.serial === r.serial; })[0];
    if (chosen && chosen.serial !== printer().serial) {
      setJSON(PRINTER_KEY, {serial: chosen.serial, name: chosen.name});
      lastStage = null;
      return ensurePrinter();
    }
    setConn(conn);
  }
});

Pebble.addEventListener('appmessage', function (e) {
  var p = e.payload || {};
  if (typeof p.CODE === 'string') {
    if (/^\d{6}$/.test(p.CODE)) submitCode(p.CODE);
    return;
  }
  if (p.CONTROL_ACTION === undefined) return;
  var code = p.CONTROL_ACTION;
  var action = C.CONTROL_ACTIONS[code];
  if (!action || !live) return messenger.push({CONTROL_RESULT: C.CONTROL_RESULT.failed, CONTROL_ACTION: code});
  live.command(action, function (result) {
    var out = result === 'rejected' ? C.CONTROL_RESULT.rejected
      : (result === 'offline' ? C.CONTROL_RESULT.failed : C.CONTROL_RESULT.ok);
    messenger.push({CONTROL_RESULT: out, CONTROL_ACTION: code});
  });
});

Pebble.addEventListener('ready', function () {
  settings = S.load(localStorage);
  var a = getJSON(AUTH_KEY);
  if (a && a.token) { setConn(C.CONN.connecting); ensurePrinter(); }
  else if (getJSON(PENDING_KEY)) setConn(C.CONN.needCode);
  else setConn(C.CONN.needLogin);
});
