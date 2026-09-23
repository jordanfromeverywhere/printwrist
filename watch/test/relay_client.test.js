var test = require('node:test');
var assert = require('node:assert');
var relay = require('../src/pkjs/relay_client.js');
var devices = require('../src/pkjs/bambu_devices.js');

function one(res) {
  var seen = {};
  return {seen: seen, http: function (m, u, b, t, cb) { seen.m = m; seen.u = u; seen.b = b; seen.t = t;
    if (res instanceof Error) cb(res); else cb(null, res); }};
}

test('fetchStatus maps responses', function () {
  var f = one({status: 200, json: {stage: 'printing'}}), out;
  relay.fetchStatus(f.http, 'https://r', 'TOK', 'ABC12345', function (e, s) { out = [e, s]; });
  assert.deepStrictEqual(out, [null, {stage: 'printing'}]);
  assert.deepStrictEqual([f.seen.m, f.seen.u, f.seen.t], ['POST', 'https://r/status', 'TOK']);
  assert.deepStrictEqual(f.seen.b, {serial: 'ABC12345'});
  [[401, 'auth'], [429, 'rate'], [502, 'server']].forEach(function (p) {
    relay.fetchStatus(one({status: p[0], json: {}}).http, 'https://r', 'T', 'S', function (e) { assert.strictEqual(e.kind, p[1]); });
  });
  relay.fetchStatus(one(new Error('x')).http, 'https://r', 'T', 'S', function (e) { assert.strictEqual(e.kind, 'network'); });
});

test('sendControl results', function () {
  var out = [];
  relay.sendControl(one({status: 200, json: {result: 'ok'}}).http, 'https://r', 'T', 'S', 'pause', function (e, r) { out.push(r); });
  relay.sendControl(one({status: 409, json: {detail: 'rejected'}}).http, 'https://r', 'T', 'S', 'stop', function (e, r) { out.push(r); });
  assert.deepStrictEqual(out, ['ok', 'rejected']);
});

test('listDevices', function () {
  var f = one({status: 200, json: {devices: [{dev_id: 'ABC12345', name: 'Workshop', online: true}]}}), out;
  devices.listDevices(f.http, 'TOK', function (e, list) { out = list; });
  assert.deepStrictEqual(out, [{serial: 'ABC12345', name: 'Workshop', online: true}]);
  assert.strictEqual(f.seen.m, 'GET');
});
