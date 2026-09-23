var test = require('node:test');
var assert = require('node:assert');
var MqttWs = require('../src/pkjs/mqtt_ws.js');
var U = MqttWs._util;

function FakeWS(url, protocols) {
  FakeWS.last = this;
  this.url = url; this.protocols = protocols; this.readyState = 0; this.sent = []; this.closed = false;
}
FakeWS.prototype.send = function (d) { assert.ok(d instanceof Uint8Array); this.sent.push(Array.prototype.slice.call(d)); };
FakeWS.prototype.close = function () {
  if (this.closed) return;
  this.closed = true; this.readyState = 3;
  if (this.onclose) this.onclose({code: 1000});
};
function open(ws) { ws.readyState = 1; ws.onopen(); }
function frame(ws, bytes) { ws.onmessage({data: new Uint8Array(bytes).buffer}); }
function pubPacket(topic, payload) {
  var t = U.utf8Encode(topic), p = U.utf8Encode(payload);
  var body = [t.length >> 8, t.length & 255].concat(t, p);
  return [0x30].concat(U.encodeLength(body.length), body);
}
function client(h) {
  var c = new MqttWs({url: 'wss://x/mqtt', username: 'u_1', password: 'tok', clientId: 'pw-x', keepalive: 30, WebSocket: FakeWS}, h || {});
  c.connect();
  return c;
}

test('connects with the mqtt subprotocol and sends CONNECT', function () {
  var c = client();
  var ws = FakeWS.last;
  assert.deepStrictEqual(ws.protocols, ['mqtt']);
  open(ws);
  var p = ws.sent[0];
  assert.strictEqual(p[0], 0x10);
  assert.strictEqual(p[1], 26);
  assert.deepStrictEqual(p.slice(2, 8), [0, 4, 77, 81, 84, 84]);
  assert.strictEqual(p[8], 4);
  assert.strictEqual(p[9], 0xC2);
  assert.deepStrictEqual(p.slice(10, 12), [0, 30]);
  c.disconnect();
});

test('CONNACK 0 calls onConnect; CONNACK 5 is an auth error and closes', function () {
  var events = [];
  var ok = client({onConnect: function () { events.push('connect'); }});
  open(FakeWS.last);
  frame(FakeWS.last, [0x20, 2, 0, 0]);
  assert.deepStrictEqual(events, ['connect']);
  ok.disconnect();

  var errs = [];
  client({onError: function (k, d) { errs.push(k); }, onClose: function (code, byUs) { errs.push('close'); }});
  var ws = FakeWS.last;
  open(ws);
  frame(ws, [0x20, 2, 0, 5]);
  assert.deepStrictEqual(errs, ['auth', 'close']);
  assert.ok(ws.closed);
});

test('CONNACK 4 is also an auth error', function () {
  var errs = [];
  client({onError: function (k, d) { errs.push(k); }, onClose: function (code, byUs) { errs.push('close'); }});
  var ws = FakeWS.last;
  open(ws);
  frame(ws, [0x20, 2, 0, 4]);
  assert.deepStrictEqual(errs, ['auth', 'close']);
  assert.ok(ws.closed);
});

test('subscribe and publish encode correctly; publish needs an open socket', function () {
  var c = client();
  assert.strictEqual(c.publish('t', 'x'), false);
  open(FakeWS.last);
  c.subscribe('ab');
  assert.deepStrictEqual(FakeWS.last.sent[1], [0x82, 7, 0, 1, 0, 2, 97, 98, 0]);
  assert.strictEqual(c.publish('ab', 'hi'), true);
  assert.deepStrictEqual(FakeWS.last.sent[2], [0x30, 6, 0, 2, 97, 98, 104, 105]);
});

test('inbound PUBLISH split across frames and packed in one frame', function () {
  var got = [];
  client({onMessage: function (t, p) { got.push([t, p]); }});
  var ws = FakeWS.last;
  open(ws);
  var a = pubPacket('device/S/report', '{"print":{"x":1}}');
  var b = pubPacket('device/S/report', '{"print":{"y":2}}');
  frame(ws, a.slice(0, 5));
  frame(ws, a.slice(5).concat(b));
  assert.deepStrictEqual(got, [['device/S/report', '{"print":{"x":1}}'], ['device/S/report', '{"print":{"y":2}}']]);
});

test('large payloads use multi-byte remaining length', function () {
  var big = new Array(20001).join('a');
  var got = null;
  client({onMessage: function (t, p) { got = p; }});
  open(FakeWS.last);
  var pkt = pubPacket('t', big);
  assert.strictEqual(pkt[1] & 0x80, 0x80);
  assert.strictEqual(pkt[2] & 0x80, 0x80);
  frame(FakeWS.last, pkt);
  assert.strictEqual(got.length, 20000);
});

test('string frames (latin1) are accepted', function () {
  var got = null;
  client({onMessage: function (t, p) { got = p; }});
  var ws = FakeWS.last;
  open(ws);
  var pkt = pubPacket('t', 'ok');
  ws.onmessage({data: String.fromCharCode.apply(null, pkt)});
  assert.strictEqual(got, 'ok');
});

test('inbound qos 1 PUBLISH skips the packet id', function () {
  var got = [];
  client({onMessage: function (t, p) { got.push([t, p]); }});
  var ws = FakeWS.last;
  open(ws);
  var t = U.utf8Encode('t'), p = U.utf8Encode('hi');
  var body = [t.length >> 8, t.length & 255].concat(t, [0, 7], p);
  var pkt = [0x32].concat(U.encodeLength(body.length), body);
  frame(ws, pkt);
  assert.deepStrictEqual(got, [['t', 'hi']]);
});

test('utf8 round trip', function () {
  var s = 'café ✓ 😀';
  var b = U.utf8Encode(s);
  assert.strictEqual(U.utf8Decode(b, 0, b.length), s);
  assert.deepStrictEqual(U.encodeLength(321), [0xC1, 0x02]);
  assert.deepStrictEqual(U.decodeLength([0, 0xC1, 0x02], 1), {value: 321, bytes: 2});
  assert.strictEqual(U.decodeLength([0, 0xC1], 1), null);
});

test('disconnect sends DISCONNECT and reports closedByUs', function () {
  var closes = [];
  var c = client({onClose: function (code, byUs) { closes.push(byUs); }});
  var ws = FakeWS.last;
  open(ws);
  c.disconnect();
  assert.deepStrictEqual(ws.sent[ws.sent.length - 1], [0xe0, 0x00]);
  assert.deepStrictEqual(closes, [true]);
});

test('constructor failure reports network error then close', function () {
  var events = [];
  var c = new MqttWs({url: 'wss://x/mqtt', username: 'u_1', password: 'tok', clientId: 'pw-x', keepalive: 30,
                       WebSocket: function () { throw new Error('constructor failed'); }},
                     {onError: function (k, d) { events.push(k); }, onClose: function (code, byUs) { events.push('close'); }});
  c.connect();
  assert.deepStrictEqual(events, ['network', 'close']);
});
