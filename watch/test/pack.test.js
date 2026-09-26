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

test('statusToMessage details', function () {
  var m = P.statusToMessage({stage: 'printing', nozzle_target: 240, bed_target: null, fan_part: 100, fan_aux: null,
    fan_chamber: 0, speed: 3, light: 'on', ext_active: true, ext: {type: 'TPU', color: '9B9EA0'}});
  assert.deepStrictEqual([m.NOZZLE_TARGET, m.BED_TARGET, m.FAN_PART, m.FAN_AUX, m.FAN_CHAMBER], [240, -1000, 100, -1, 0]);
  assert.deepStrictEqual([m.SPEED_LEVEL, m.LIGHT, m.EXT_ACTIVE], [3, 1, 1]);
  assert.deepStrictEqual([m.EXT_TYPE, m.EXT_COLOR], ['TPU', 0x9B9EA0]);
  var o = P.statusToMessage({stage: 'offline'});
  assert.deepStrictEqual([o.SPEED_LEVEL, o.LIGHT, o.EXT_ACTIVE, o.EXT_COLOR, o.AMS_UNITS], [0, -1, 0, -1, '']);
});

test('statusToMessage AMS_UNITS: mixed units, empty trays, missing colour, 7-char cap, separator stripping', function () {
  var m = P.statusToMessage({stage: 'printing', units: [
    {kind: 'ams', active: 3, trays: [{type: 'PLA', color: 'FF0000'}, {type: 'PETG', color: '0000FF'},
                                      null, {type: 'ABS', color: 'FFFF00'}]},
    {kind: 'ht', active: null, trays: [{type: 'PA', color: '202020'}]}]});
  assert.strictEqual(m.AMS_UNITS, 'A3|PLA,FF0000|PETG,0000FF||ABS,FFFF00;H-|PA,202020');

  var missingColour = P.statusToMessage({stage: 'printing', units: [
    {kind: 'ams', active: null, trays: [{type: 'PLA', color: null}, null, null, null]}]});
  assert.strictEqual(missingColour.AMS_UNITS, 'A-|PLA,|||');

  var stripped = P.statusToMessage({stage: 'printing', units: [
    {kind: 'ht', active: 0, trays: [{type: 'PLA-CF|;,LONG', color: 'FF0000'}]}]});
  assert.strictEqual(stripped.AMS_UNITS, 'H0|PLA-CFL,FF0000');

  assert.strictEqual(P.statusToMessage({stage: 'printing', units: []}).AMS_UNITS, '');
});
