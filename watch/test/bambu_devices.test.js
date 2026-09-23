var test = require('node:test');
var assert = require('node:assert');
var devices = require('../src/pkjs/bambu_devices.js');

function http(res) { return function (m, u, b, t, cb) { if (res instanceof Error) cb(res); else cb(null, res); }; }

test('getUsername maps uid and errors', function () {
  var out = [];
  devices.getUsername(http({status: 200, json: {uid: 42}}), 'T', function (e, u) { out.push([e, u]); });
  devices.getUsername(http({status: 401, json: {}}), 'T', function (e) { out.push(e.kind); });
  devices.getUsername(http({status: 403, json: {}}), 'T', function (e) { out.push(e.kind); });
  devices.getUsername(http({status: 200, json: {}}), 'T', function (e) { out.push(e.kind); });
  devices.getUsername(http(new Error('x')), 'T', function (e) { out.push(e.kind); });
  assert.deepStrictEqual(out, [[null, 'u_42'], 'auth', 'server', 'server', 'network']);
});
