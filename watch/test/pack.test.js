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
  var m = P.configMessage(S.merge({layout: 'dense'}), 3, 'Workshop');
  assert.deepStrictEqual(m, {LAYOUT: 2, CONN_STATE: 3, PRINTER_NAME: 'Workshop'});
});

test('statusToMessage details and trays', function () {
  var m = P.statusToMessage({stage: 'printing', nozzle_target: 240, bed_target: null, fan_part: 100, fan_aux: null,
    fan_chamber: 0, speed: 3, light: 'on', tray_active: 4,
    trays: [{type: 'PETG', color: '00FF00'}, null, {type: 'PLA-CF-LONG', color: 'zz'}, null],
    ext: {type: 'TPU', color: '9B9EA0'}});
  assert.deepStrictEqual([m.NOZZLE_TARGET, m.BED_TARGET, m.FAN_PART, m.FAN_AUX, m.FAN_CHAMBER], [240, -1000, 100, -1, 0]);
  assert.deepStrictEqual([m.SPEED_LEVEL, m.LIGHT, m.TRAY_ACTIVE], [3, 1, 4]);
  assert.deepStrictEqual([m.TRAY0_TYPE, m.TRAY0_COLOR, m.TRAY1_TYPE, m.TRAY1_COLOR], ['PETG', 0x00FF00, '', -1]);
  assert.deepStrictEqual([m.TRAY2_TYPE, m.TRAY2_COLOR], ['PLA-CF-', -1]);
  assert.deepStrictEqual([m.EXT_TYPE, m.EXT_COLOR], ['TPU', 0x9B9EA0]);
  var o = P.statusToMessage({stage: 'offline'});
  assert.deepStrictEqual([o.SPEED_LEVEL, o.LIGHT, o.TRAY_ACTIVE, o.TRAY3_TYPE, o.EXT_COLOR], [0, -1, -1, '', -1]);
});
