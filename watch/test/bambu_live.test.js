var test = require('node:test');
var assert = require('node:assert');
var Live = require('../src/pkjs/bambu_live.js');

function Timers() { this.q = []; this.t = 0; }
Timers.prototype.set = function (fn, ms) { var e = {fn: fn, at: this.t + ms}; this.q.push(e); return e; };
Timers.prototype.clear = function (e) { var i = this.q.indexOf(e); if (i >= 0) this.q.splice(i, 1); };
Timers.prototype.advance = function (ms) {
  var end = this.t + ms, next;
  for (;;) {
    next = null;
    this.q.forEach(function (e) { if (e.at <= end && (!next || e.at < next.at)) next = e; });
    if (!next) break;
    this.q.splice(this.q.indexOf(next), 1);
    this.t = next.at;
    next.fn();
  }
  this.t = end;
};

var clients;
function FakeClient(opts, h) { clients.push(this); this.opts = opts; this.h = h; this.subs = []; this.pubs = []; this.disconnected = false; this.canPublish = true; }
FakeClient.prototype.connect = function () {};
FakeClient.prototype.subscribe = function (t) { this.subs.push(t); return true; };
FakeClient.prototype.publish = function (t, m) { if (!this.canPublish) return false; this.pubs.push([t, JSON.parse(m)]); return true; };
FakeClient.prototype.disconnect = function () { this.disconnected = true; };
function msg(c, print) { c.h.onMessage('device/S1/report', JSON.stringify({print: print})); }

function setup() {
  clients = [];
  var timers = new Timers(), statuses = [], states = [];
  var live = new Live({username: 'u_1', token: 'T', serial: 'S1', timers: timers, now: function () { return timers.t; },
                       makeClient: function (o, h) { return new FakeClient(o, h); }},
                      {onStatus: function (s) { statuses.push(s); }, onState: function (s) { states.push(s); }});
  live.start();
  return {live: live, timers: timers, statuses: statuses, states: states};
}

test('connect subscribes and requests full state', function () {
  var s = setup(), c = clients[0];
  assert.strictEqual(c.opts.url, 'wss://us.mqtt.bambulab.com:8084/mqtt');
  assert.strictEqual(c.opts.username, 'u_1');
  assert.strictEqual(c.opts.password, 'T');
  c.h.onConnect();
  assert.deepStrictEqual(c.subs, ['device/S1/report']);
  assert.deepStrictEqual(c.pubs[0], ['device/S1/request', {pushing: {sequence_id: '0', command: 'pushall', version: 1, push_target: 1}}]);
  assert.deepStrictEqual(s.states, ['connecting']);
});

test('first full state emits; deltas merge and are throttled; stage change is immediate', function () {
  var s = setup(), c = clients[0];
  c.h.onConnect();
  msg(c, {mc_percent: 5});
  assert.strictEqual(s.statuses.length, 0);
  msg(c, {gcode_state: 'RUNNING', mc_percent: 10, nozzle_temper: 220});
  assert.deepStrictEqual(s.states, ['connecting', 'live']);
  assert.strictEqual(s.statuses.length, 1);
  assert.strictEqual(s.statuses[0].progress, 10);
  s.timers.advance(1000);
  msg(c, {mc_percent: 11});
  assert.strictEqual(s.statuses.length, 1);
  s.timers.advance(4000);
  assert.strictEqual(s.statuses.length, 2);
  assert.strictEqual(s.statuses[1].progress, 11);
  assert.strictEqual(s.statuses[1].nozzle, 220);
  s.timers.advance(1000);
  msg(c, {gcode_state: 'FINISH', mc_percent: 100});
  assert.strictEqual(s.statuses.length, 3);
  assert.strictEqual(s.statuses[2].stage, 'done');
});

test('no reply to pushall within 10 s emits offline; stale report re-requests', function () {
  var s = setup(), c = clients[0];
  c.h.onConnect();
  s.timers.advance(10000);
  assert.strictEqual(s.statuses[0].stage, 'offline');
  msg(c, {gcode_state: 'IDLE'});
  var before = c.pubs.length;
  s.timers.advance(90000);
  assert.strictEqual(c.pubs.length, before + 1);
  assert.strictEqual(c.pubs[c.pubs.length - 1][1].pushing.command, 'pushall');
});

test('commands: ok, rejected, unconfirmed, offline', function () {
  var s = setup(), c = clients[0], out = [];
  c.h.onConnect();
  s.live.command('pause', function (r) { out.push(r); });
  var cmd = c.pubs[1][1].print;
  assert.deepStrictEqual([cmd.command, cmd.param], ['pause', '']);
  msg(c, {command: 'pause', sequence_id: cmd.sequence_id, result: 'success'});
  s.live.command('stop', function (r) { out.push(r); });
  msg(c, {command: 'stop', sequence_id: c.pubs[2][1].print.sequence_id, err_code: 123});
  s.live.command('resume', function (r) { out.push(r); });
  s.timers.advance(5000);
  c.canPublish = false;
  s.live.command('pause', function (r) { out.push(r); });
  assert.deepStrictEqual(out, ['ok', 'rejected', 'unconfirmed', 'offline']);
});

test('command reply under system resolves', function () {
  var s = setup(), c = clients[0], out = [];
  c.h.onConnect();
  s.live.command('stop', function (r) { out.push(r); });
  var seq = c.pubs[1][1].print.sequence_id;
  c.h.onMessage('device/S1/report', JSON.stringify({system: {command: 'stop', sequence_id: seq, result: 'success'}}));
  assert.deepStrictEqual(out, ['ok']);
});

test('auth error stops without retry', function () {
  var s = setup(), c = clients[0];
  c.h.onError('auth', 'CONNACK 5');
  c.h.onClose(1000, false);
  s.timers.advance(120000);
  assert.deepStrictEqual(s.states, ['connecting', 'auth']);
  assert.strictEqual(clients.length, 1);
});

test('socket drop reports down and reconnects with backoff', function () {
  var s = setup(), c = clients[0];
  c.h.onConnect();
  c.h.onClose(1006, false);
  assert.deepStrictEqual(s.states, ['connecting', 'down']);
  s.timers.advance(4999);
  assert.strictEqual(clients.length, 1);
  s.timers.advance(1);
  assert.strictEqual(clients.length, 2);
  clients[1].h.onClose(1006, false);
  s.timers.advance(14999);
  assert.strictEqual(clients.length, 2);
  s.timers.advance(1);
  assert.strictEqual(clients.length, 3);
});

test('stop disconnects, fails pending commands, and never reconnects', function () {
  var s = setup(), c = clients[0], out = [];
  c.h.onConnect();
  s.live.command('pause', function (r) { out.push(r); });
  s.live.stop();
  c.h.onClose(1000, true);
  s.timers.advance(120000);
  assert.ok(c.disconnected);
  assert.deepStrictEqual(out, ['offline']);
  assert.strictEqual(clients.length, 1);
});

test('a client that fails before opening reports down and retries', function () {
  clients = [];
  var timers = new Timers(), states = [];
  var live = new Live({username: 'u_1', token: 'T', serial: 'S1', timers: timers, now: function () { return timers.t; },
                       makeClient: function (o, h) {
                         var c = new FakeClient(o, h);
                         var origConnect = c.connect;
                         c.connect = function () {
                           h.onError('network', 'constructor failed');
                           h.onClose(0, false);
                         };
                         return c;
                       }},
                      {onStatus: function (s) {}, onState: function (s) { states.push(s); }});
  live.start();
  assert.deepStrictEqual(states, ['connecting', 'down']);
  timers.advance(4999);
  assert.strictEqual(clients.length, 1);
  timers.advance(1);
  assert.strictEqual(clients.length, 2);
});
