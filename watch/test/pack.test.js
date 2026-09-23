var test = require('node:test');
var assert = require('node:assert');
var P = require('../src/pkjs/pack.js');
var S = require('../src/pkjs/settings.js');

test('statusToMessage full', function () {
  var m = P.statusToMessage({stage: 'printing', progress: 65, remaining_min: 134, nozzle: 238, bed: 60,
    chamber: null, layer: 184, total_layers: 280, job: 'a_very_long_job_name_that_keeps_going_forever',
    error_code: null, ams: {slot: 'AMS1-1', type: 'PLA', color: 'FF0000'}});
  assert.strictEqual(m.STAGE, 1);
  assert.strictEqual(m.PROGRESS, 65);
  assert.strictEqual(m.CHAMBER, -1000);
  assert.strictEqual(m.JOB.length, 31);
  assert.strictEqual(m.AMS_LABEL, 'AMS1-1 PLA');
  assert.strictEqual(m.AMS_COLOR, 0xFF0000);
  assert.strictEqual(m.ERROR_CODE, '');
});

test('statusToMessage offline and no ams', function () {
  var m = P.statusToMessage({stage: 'offline'});
  assert.strictEqual(m.STAGE, 5);
  assert.strictEqual(m.AMS_COLOR, -1);
  assert.strictEqual(m.NOZZLE, -1000);
  assert.strictEqual(m.PROGRESS, 0);
});

test('configMessage', function () {
  var m = P.configMessage(S.merge({layout: 'dense', controlEnabled: true}), 3, 'Workshop');
  assert.deepStrictEqual(m, {LAYOUT: 2, CONTROL_ENABLED: 1, CONN_STATE: 3, PRINTER_NAME: 'Workshop'});
});
