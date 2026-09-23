var MqttWs = require('./mqtt_ws.js');
var normalize = require('./normalize.js').normalize;

var BROKER_URL = 'wss://us.mqtt.bambulab.com:8084/mqtt';
var EMIT_MS = 5000, STALE_MS = 90000, PUSHALL_WAIT_MS = 10000, COMMAND_MS = 5000;
var BACKOFF_MS = [5000, 15000, 30000, 60000];
var PUSHALL = JSON.stringify({pushing: {sequence_id: '0', command: 'pushall', version: 1, push_target: 1}});

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function deepMerge(dst, src) {
  var k;
  for (k in src) {
    if (!src.hasOwnProperty(k)) continue;
    if (isObj(src[k]) && isObj(dst[k])) deepMerge(dst[k], src[k]);
    else dst[k] = src[k];
  }
  return dst;
}

function classifyReply(p) {
  if (p.err_code) return 'rejected';
  return String(p.result === undefined ? 'success' : p.result).toLowerCase() === 'success' ? 'ok' : 'rejected';
}

function buildCommand(action, seq) {
  var m;
  if (action === 'pause' || action === 'resume' || action === 'stop') {
    return {body: {print: {sequence_id: seq, command: action, param: ''}}, reply: action};
  }
  if (action === 'light_on' || action === 'light_off') {
    return {body: {system: {sequence_id: seq, command: 'ledctrl', led_node: 'chamber_light',
                            led_mode: action === 'light_on' ? 'on' : 'off', led_on_time: 500,
                            led_off_time: 500, loop_times: 0, interval_time: 0}}, reply: 'ledctrl'};
  }
  m = /^speed_([1-4])$/.exec(action);
  if (m) return {body: {print: {sequence_id: seq, command: 'print_speed', param: m[1]}}, reply: 'print_speed'};
  return null;
}

function Live(opts, handlers) {
  this.o = opts;
  this.h = handlers;
  this.makeClient = opts.makeClient || function (mo, mh) { return new MqttWs(mo, mh); };
  this.timers = opts.timers || {set: function (fn, ms) { return setTimeout(fn, ms); }, clear: function (id) { clearTimeout(id); }};
  this.now = opts.now || function () { return Date.now(); };
  this.client = null;
  this.stopped = true;
  this.attempt = 0;
  this.seq = 1;
  this.pending = {};
  this.t = {emit: null, stale: null, pushall: null, retry: null};
  this.resetReport();
}

Live.prototype.resetReport = function () {
  this.report = {};
  this.hasState = false;
  this.lastStage = null;
  this.lastEmit = -Infinity;
  this.gotSinceRequest = false;
};

Live.prototype.clear = function (name) {
  if (this.t[name]) { this.timers.clear(this.t[name]); this.t[name] = null; }
};

Live.prototype.clearAll = function () {
  var k;
  for (k in this.t) if (this.t.hasOwnProperty(k)) this.clear(k);
};

Live.prototype.start = function () {
  this.stopped = false;
  this.open();
};

Live.prototype.stop = function () {
  var c = this.client;
  this.stopped = true;
  this.clearAll();
  this.client = null;
  if (c) c.disconnect();
  this.failPending('offline');
};

Live.prototype.open = function () {
  var self = this, client;
  this.resetReport();
  this.h.onState('connecting');
  client = this.makeClient({url: BROKER_URL, username: this.o.username, password: this.o.token,
                            clientId: 'pw-' + Math.floor(Math.random() * 1e9).toString(36), keepalive: 30,
                            WebSocket: this.o.WebSocket}, {
    onConnect: function () {
      if (client !== self.client) return;
      self.attempt = 0;
      client.subscribe('device/' + self.o.serial + '/report');
      self.requestFull();
    },
    onMessage: function (topic, payload) {
      if (client === self.client) self.onReport(payload);
    },
    onError: function (kind) {
      if (client !== self.client || kind !== 'auth') return;
      self.stopped = true;
      self.clearAll();
      self.client = null;
      self.failPending('offline');
      self.h.onState('auth');
    },
    onClose: function () {
      if (client !== self.client) return;
      self.client = null;
      self.clearAll();
      self.failPending('offline');
      if (!self.stopped) {
        self.h.onState('down');
        self.scheduleRetry();
      }
    }
  });
  this.client = client;
  client.connect();
};

Live.prototype.scheduleRetry = function () {
  var self = this, ms = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
  this.attempt++;
  this.clear('retry');
  this.t.retry = this.timers.set(function () {
    self.t.retry = null;
    if (!self.stopped) self.open();
  }, ms);
};

Live.prototype.requestFull = function () {
  var self = this;
  this.gotSinceRequest = false;
  if (this.client) this.client.publish('device/' + this.o.serial + '/request', PUSHALL);
  this.clear('pushall');
  this.t.pushall = this.timers.set(function () {
    self.t.pushall = null;
    if (!self.gotSinceRequest) self.emitOffline();
  }, PUSHALL_WAIT_MS);
  this.armStale();
};

Live.prototype.armStale = function () {
  var self = this;
  this.clear('stale');
  this.t.stale = this.timers.set(function () {
    self.t.stale = null;
    self.requestFull();
  }, STALE_MS);
};

Live.prototype.onReport = function (payload) {
  var msg, p;
  try { msg = JSON.parse(payload); } catch (e) { return; }
  if (msg && isObj(msg.system)) this.resolvePending(msg.system);
  p = msg && msg.print;
  if (!isObj(p)) return;
  this.gotSinceRequest = true;
  this.armStale();
  this.resolvePending(p);
  deepMerge(this.report, {print: p});
  if (p.gcode_state !== undefined && !this.hasState) {
    this.hasState = true;
    this.h.onState('live');
  }
  if (this.hasState) this.scheduleEmit();
};

Live.prototype.scheduleEmit = function () {
  var self = this, status = normalize(this.report), wait = this.lastEmit + EMIT_MS - this.now();
  if (status.stage !== this.lastStage || wait <= 0) {
    this.emit(status);
    return;
  }
  if (!this.t.emit) {
    this.t.emit = this.timers.set(function () {
      self.t.emit = null;
      self.emit(normalize(self.report));
    }, wait);
  }
};

Live.prototype.emit = function (status) {
  this.clear('emit');
  this.lastStage = status.stage;
  this.lastEmit = this.now();
  this.h.onStatus(status);
};

Live.prototype.emitOffline = function () {
  this.emit(normalize(null));
};

Live.prototype.command = function (action, cb) {
  var self = this, seq, cmd, entry;
  if (!this.client) { cb('offline'); return; }
  if (action === 'refresh') { this.requestFull(); cb('ok'); return; }
  seq = String(this.seq++);
  cmd = buildCommand(action, seq);
  if (!cmd) { cb('rejected'); return; }
  if (!this.client.publish('device/' + this.o.serial + '/request', JSON.stringify(cmd.body))) { cb('offline'); return; }
  entry = {action: cmd.reply, cb: cb};
  entry.timer = this.timers.set(function () { delete self.pending[seq]; cb('unconfirmed'); }, COMMAND_MS);
  this.pending[seq] = entry;
};

Live.prototype.resolvePending = function (p) {
  var seq = p.sequence_id === undefined ? null : String(p.sequence_id), e = seq !== null ? this.pending[seq] : null;
  if (!e || p.command !== e.action) return;
  this.timers.clear(e.timer);
  delete this.pending[seq];
  e.cb(classifyReply(p));
};

Live.prototype.failPending = function (result) {
  var k, e, list = this.pending;
  this.pending = {};
  for (k in list) {
    if (!list.hasOwnProperty(k)) continue;
    e = list[k];
    this.timers.clear(e.timer);
    e.cb(result);
  }
};

Live.BROKER_URL = BROKER_URL;
Live.EMIT_MS = EMIT_MS;
Live.STALE_MS = STALE_MS;
Live.PUSHALL_WAIT_MS = PUSHALL_WAIT_MS;
Live.COMMAND_MS = COMMAND_MS;
Live.BACKOFF_MS = BACKOFF_MS;
module.exports = Live;
