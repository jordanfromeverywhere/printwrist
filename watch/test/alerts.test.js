var test = require('node:test');
var assert = require('node:assert');
var A = require('../src/pkjs/alerts.js');
var S = require('../src/pkjs/settings.js');

test('detectAlert transitions', function () {
  assert.strictEqual(A.detectAlert(null, 'done'), null);
  assert.strictEqual(A.detectAlert('printing', 'printing'), null);
  assert.strictEqual(A.detectAlert('printing', 'done'), 'done');
  assert.strictEqual(A.detectAlert('printing', 'failed'), 'failed');
  assert.strictEqual(A.detectAlert('printing', 'paused'), 'paused');
  assert.strictEqual(A.detectAlert('paused', 'printing'), null);
  assert.strictEqual(A.detectAlert('printing', 'offline'), null);
});

function at(h, m) { var d = new Date(2026, 8, 23, h, m); return d; }

test('quiet hours across midnight and same-day', function () {
  var q = {on: true, start: '22:00', end: '07:00'};
  assert.ok(A.inQuietHours(at(23, 0), q));
  assert.ok(A.inQuietHours(at(6, 59), q));
  assert.ok(!A.inQuietHours(at(7, 0), q));
  assert.ok(!A.inQuietHours(at(12, 0), q));
  assert.ok(A.inQuietHours(at(13, 0), {on: true, start: '12:00', end: '14:00'}));
  assert.ok(!A.inQuietHours(at(23, 0), {on: false, start: '22:00', end: '07:00'}));
  assert.ok(!A.inQuietHours(at(23, 0), {on: true, start: '22:00', end: '22:00'}));
});

test('failed and reconnect always vibrate', function () {
  var s = S.merge({quiet: {on: true, start: '00:00', end: '23:59'}});
  assert.ok(A.shouldVibrate('failed', at(3, 0), s));
  assert.ok(A.shouldVibrate('reconnect', at(3, 0), s));
  assert.ok(!A.shouldVibrate('done', at(3, 0), s));
  assert.ok(!A.shouldVibrate('paused', at(3, 0), s));
});

test('alertEnabled honors settings, reconnect always on', function () {
  var s = S.merge({alerts: {done: false, failed: true, paused: true}});
  assert.ok(!A.alertEnabled('done', s));
  assert.ok(A.alertEnabled('reconnect', S.merge({alerts: {done: false, failed: false, paused: false}})));
});

test('settings defaults', function () {
  var s = S.merge(null);
  assert.strictEqual(s.layout, 'arc');
  assert.strictEqual(s.controlEnabled, false);
});

test('nextAlertState ignores offline blips', function () {
  assert.deepStrictEqual(A.nextAlertState(null, 'printing'), {kind: null, lastStage: 'printing'});
  assert.deepStrictEqual(A.nextAlertState('printing', 'offline'), {kind: null, lastStage: 'printing'});
  assert.deepStrictEqual(A.nextAlertState('printing', 'printing'), {kind: null, lastStage: 'printing'});
  var s1 = A.nextAlertState('printing', 'done');
  assert.deepStrictEqual(s1, {kind: 'done', lastStage: 'done'});
  var s2 = A.nextAlertState(s1.lastStage, 'offline');
  assert.deepStrictEqual(s2, {kind: null, lastStage: 'done'});
  var s3 = A.nextAlertState(s2.lastStage, 'done');
  assert.deepStrictEqual(s3, {kind: null, lastStage: 'done'});
});

test('settings have no relay URL', function () {
  var s = S.merge({relayUrl: 'https://x.example'});
  assert.strictEqual(Object.prototype.hasOwnProperty.call(s, 'relayUrl'), false);
  assert.strictEqual(typeof S.relayBase, 'undefined');
});
