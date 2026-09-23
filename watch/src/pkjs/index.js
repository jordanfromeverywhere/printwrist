var C = require('./constants.js');
var S = require('./settings.js');
var A = require('./alerts.js');
var P = require('./pack.js');
var auth = require('./bambu_auth.js');
var devices = require('./bambu_devices.js');
var relay = require('./relay_client.js');
var http = require('./xhr_http.js');
var Messenger = require('./messenger.js');

var AUTH_KEY = 'pw_auth';        // {token, refresh, expiresAt, email}
var PENDING_KEY = 'pw_pending';  // {email} while waiting for an email code
var PRINTER_KEY = 'pw_printer';  // {serial, name}

var settings, lastStage = null, pollTimer = null, conn = C.CONN.connecting, notice = '', printers = [];
var messenger = new Messenger(function (msg, ok, fail) { Pebble.sendAppMessage(msg, ok, fail); });

function getJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function setJSON(k, v) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }
function printer() { return getJSON(PRINTER_KEY) || {}; }

function setConn(c) {
  conn = c;
  messenger.push(P.configMessage(settings, conn, printer().name || ''));
}

function withToken(cb) {
  var a = getJSON(AUTH_KEY);
  if (!a || !a.token) return cb(null);
  if (a.expiresAt - Date.now() > 5 * 60 * 1000 || !a.refresh) return cb(a.token);
  auth.refresh(http, a.refresh, function (r) {
    if (r.state !== 'ok') return cb(a.token);
    setJSON(AUTH_KEY, {token: r.token, refresh: r.refresh || a.refresh, expiresAt: r.expiresAt, email: a.email});
    cb(r.token);
  });
}

function signedOut(showAlert) {
  stopPolling();
  setJSON(AUTH_KEY, null);
  setConn(C.CONN.needLogin);
  if (showAlert) {
    var m = P.statusToMessage({stage: lastStage || 'offline'});
    m.ALERT_KIND = C.ALERT_CODES.reconnect;
    m.VIBRATE = 1;
    messenger.push(m);
  }
}

function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }
function schedule(ms) { stopPolling(); pollTimer = setTimeout(poll, ms); }

function poll() {
  var p = printer();
  if (!p.serial) return ensurePrinter();
  withToken(function (token) {
    if (!token) return signedOut(false);
    relay.fetchStatus(http, S.relayBase(settings), token, p.serial, function (err, status) {
      if (err && err.kind === 'auth') {
        return auth.refresh(http, (getJSON(AUTH_KEY) || {}).refresh, function (r) {
          if (r.state !== 'ok') return signedOut(true);
          var a = getJSON(AUTH_KEY) || {};
          setJSON(AUTH_KEY, {token: r.token, refresh: r.refresh || a.refresh, expiresAt: r.expiresAt, email: a.email});
          schedule(1000);
        });
      }
      if (err) {
        if (err.kind !== 'rate' && conn !== C.CONN.relayDown) setConn(C.CONN.relayDown);
        return schedule(30000);
      }
      if (conn !== C.CONN.ok) setConn(C.CONN.ok);
      var msg = P.statusToMessage(status);
      var kind = A.detectAlert(lastStage, status.stage);
      if (kind && A.alertEnabled(kind, settings)) {
        msg.ALERT_KIND = C.ALERT_CODES[kind];
        msg.VIBRATE = A.shouldVibrate(kind, new Date(), settings) ? 1 : 0;
      }
      lastStage = status.stage;
      messenger.push(msg);
      schedule(A.nextPollDelayMs(status));
    });
  });
}

function ensurePrinter() {
  withToken(function (token) {
    if (!token) return signedOut(false);
    devices.listDevices(http, token, function (err, list) {
      if (err && err.kind === 'auth') return signedOut(true);
      if (err) { setConn(C.CONN.relayDown); return schedule(30000); }
      printers = list;
      if (!list.length) return setConn(C.CONN.noPrinter);
      var saved = printer();
      var keep = list.filter(function (d) { return d.serial === saved.serial; })[0] || list[0];
      setJSON(PRINTER_KEY, {serial: keep.serial, name: keep.name});
      setConn(C.CONN.connecting);
      poll();
    });
  });
}

function onLoginResult(r, email) {
  if (r.state === 'ok') {
    setJSON(PENDING_KEY, null);
    setJSON(AUTH_KEY, {token: r.token, refresh: r.refresh, expiresAt: r.expiresAt, email: email});
    notice = '';
    setConn(C.CONN.connecting);
    return ensurePrinter();
  }
  if (r.state === 'need_code') {
    return auth.sendCode(http, email, function () {
      setJSON(PENDING_KEY, {email: email});
      notice = '';
      setConn(C.CONN.needCode);
    });
  }
  if (r.state === 'tfa_unsupported') {
    notice = "Accounts that use an authenticator app aren't supported yet.";
    return setConn(C.CONN.tfaUnsupported);
  }
  notice = r.message || 'Sign in failed.';
  setConn(C.CONN.needLogin);
}

function configState() {
  var a = getJSON(AUTH_KEY), pend = getJSON(PENDING_KEY);
  return {signedIn: !!(a && a.token), email: (a && a.email) || (pend && pend.email) || '',
          awaitingCode: !!pend && !(a && a.token), notice: notice, printers: printers,
          serial: printer().serial || '', settings: settings};
}

Pebble.addEventListener('showConfiguration', function () {
  Pebble.openURL(S.relayBase(settings) + '/config/#' + encodeURIComponent(JSON.stringify(configState())));
});

Pebble.addEventListener('webviewclosed', function (e) {
  var r;
  try { r = JSON.parse(decodeURIComponent(e.response || '')); } catch (err) { return; }
  if (!r || !r.action) return;
  if (r.action === 'login') return auth.login(http, r.email, r.password, function (res) { onLoginResult(res, r.email); });
  if (r.action === 'code') {
    var pend = getJSON(PENDING_KEY);
    if (!pend) return setConn(C.CONN.needLogin);
    return auth.loginWithCode(http, pend.email, r.code, function (res) { onLoginResult(res, pend.email); });
  }
  if (r.action === 'signout') { setJSON(PRINTER_KEY, null); return signedOut(false); }
  if (r.action === 'save') {
    settings = S.merge(r.settings);
    S.save(localStorage, settings);
    var chosen = printers.filter(function (d) { return d.serial === r.serial; })[0];
    if (chosen) setJSON(PRINTER_KEY, {serial: chosen.serial, name: chosen.name});
    setConn(conn);
    schedule(500);
  }
});

Pebble.addEventListener('appmessage', function (e) {
  var code = e.payload.CONTROL_ACTION;
  var action = C.CONTROL_ACTIONS[code];
  if (!action || !settings.controlEnabled) return;
  withToken(function (token) {
    if (!token) return signedOut(true);
    relay.sendControl(http, S.relayBase(settings), token, printer().serial, action, function (err, result) {
      var out = err ? C.CONTROL_RESULT.failed
        : (result === 'rejected' ? C.CONTROL_RESULT.rejected : C.CONTROL_RESULT.ok);
      messenger.push({CONTROL_RESULT: out});
      schedule(1500);
    });
  });
});

Pebble.addEventListener('ready', function () {
  settings = S.load(localStorage);
  var a = getJSON(AUTH_KEY);
  if (a && a.token) { setConn(C.CONN.connecting); ensurePrinter(); }
  else if (getJSON(PENDING_KEY)) setConn(C.CONN.needCode);
  else setConn(C.CONN.needLogin);
});
