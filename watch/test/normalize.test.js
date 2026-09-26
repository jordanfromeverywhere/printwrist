var test = require('node:test');
var assert = require('node:assert');
var fs = require('node:fs');
var path = require('node:path');
var N = require('../src/pkjs/normalize.js');

var KEYS = ['ams','bed','bed_target','chamber','error_code','ext','ext_active','fan_aux','fan_chamber','fan_part','job','layer','light','nozzle','nozzle_target','progress','remaining_min','speed','stage','total_layers','units'];
function report(p) { return {print: p}; }
function keys(o) { return Object.keys(o).sort(); }

test('null is offline with all keys', function () {
  var out = N.normalize(null);
  assert.deepStrictEqual(keys(out), KEYS);
  assert.strictEqual(out.stage, 'offline');
  assert.strictEqual(out.progress, null);
});

test('stage mapping', function () {
  var cases = {RUNNING: 'printing', PREPARE: 'printing', SLICING: 'printing', PAUSE: 'paused',
               FINISH: 'done', FAILED: 'failed', IDLE: 'idle', SOMETHING_NEW: 'idle'};
  Object.keys(cases).forEach(function (raw) {
    assert.strictEqual(N.normalize(report({gcode_state: raw})).stage, cases[raw]);
  });
});

test('core fields', function () {
  var out = N.normalize(report({gcode_state: 'RUNNING', mc_percent: 65, mc_remaining_time: 134,
    nozzle_temper: 238.4, bed_temper: '60.0', chamber_temper: 42, layer_num: 184, total_layer_num: 280,
    subtask_name: 'benchy_v3'}));
  assert.deepStrictEqual([out.progress, out.remaining_min, out.nozzle, out.bed, out.chamber], [65, 134, 238, 60, 42]);
  assert.deepStrictEqual([out.layer, out.total_layers, out.job, out.error_code], [184, 280, 'benchy_v3', null]);
  assert.deepStrictEqual(keys(out), KEYS);
});

test('error code formatting', function () {
  assert.strictEqual(N.normalize(report({gcode_state: 'FAILED', print_error: 0x0300400C})).error_code, '0300-400C');
  assert.strictEqual(N.normalize(report({gcode_state: 'FAILED', print_error: 0})).error_code, null);
});

test('ams slot, external spool (vt_tray and vir_slot), none', function () {
  var ams = {tray_now: '1', ams: [{id: '0', tray: [{id: '0', tray_type: 'PETG', tray_color: '00FF00FF'},
                                                   {id: '1', tray_type: 'PLA', tray_color: 'FF0000FF'}]}]};
  assert.deepStrictEqual(N.normalize(report({gcode_state: 'RUNNING', ams: ams})).ams, {slot: 'AMS1-2', type: 'PLA', color: 'FF0000'});
  assert.deepStrictEqual(N.normalize(report({gcode_state: 'RUNNING', ams: {tray_now: '254'},
    vt_tray: {tray_type: 'TPU', tray_color: '000000FF'}})).ams, {slot: 'Ext', type: 'TPU', color: '000000'});
  assert.deepStrictEqual(N.normalize(report({gcode_state: 'RUNNING', ams: {tray_now: '254'},
    vir_slot: [{id: '255', tray_type: 'TPU', tray_color: '9B9EA0FF'}]})).ams, {slot: 'Ext', type: 'TPU', color: '9B9EA0'});
  assert.strictEqual(N.normalize(report({gcode_state: 'IDLE', ams: {tray_now: '255'}})).ams, null);
});

test('nested temperature fallbacks', function () {
  var dev = {extruder: {info: [{temp: 220}]}, bed: {info: {temp: 55}}, ctc: {info: {temp: 38}}};
  var out = N.normalize(report({gcode_state: 'RUNNING', device: dev}));
  assert.deepStrictEqual([out.nozzle, out.bed, out.chamber], [220, 55, 38]);
});

test('recorded P2S report', function () {
  var raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'report_p2s.json'), 'utf8'));
  var out = N.normalize(raw);
  assert.deepStrictEqual(keys(out), KEYS);
  assert.ok(['printing', 'paused', 'done', 'failed', 'idle'].indexOf(out.stage) >= 0);
  assert.ok(typeof out.nozzle === 'number' && out.nozzle >= 0 && out.nozzle < 400);
  assert.ok(typeof out.bed === 'number' && out.bed >= 0 && out.bed < 150);
});

test('details fields', function () {
  var out = N.normalize(report({gcode_state: 'RUNNING', nozzle_target_temper: 240, bed_target_temper: '60.0',
    cooling_fan_speed: '15', big_fan1_speed: '8', big_fan2_speed: '0', spd_lvl: 3,
    lights_report: [{node: 'work_light', mode: 'flashing'}, {node: 'chamber_light', mode: 'on'}]}));
  assert.deepStrictEqual([out.nozzle_target, out.bed_target], [240, 60]);
  assert.deepStrictEqual([out.fan_part, out.fan_aux, out.fan_chamber], [100, 53, 0]);
  assert.strictEqual(out.speed, 3);
  assert.strictEqual(out.light, 'on');
  assert.strictEqual(N.normalize(report({gcode_state: 'IDLE', spd_lvl: 9})).speed, null);
  assert.strictEqual(N.normalize(report({gcode_state: 'IDLE', lights_report: [{node: 'chamber_light', mode: 'off'}]})).light, 'off');
});

test('units: 0 units', function () {
  var out = N.normalize(report({gcode_state: 'IDLE', ams: {tray_now: '255'}}));
  assert.deepStrictEqual(out.units, []);
  assert.strictEqual(out.ext_active, false);
  assert.deepStrictEqual(N.normalize(null).units, []);
});

test('units: 1 regular unit with tray gaps', function () {
  var ams = {tray_now: '255', ams: [{id: '0', tray: [
    {id: '0', tray_type: 'PETG', tray_color: '00FF00FF'}, {id: '2', tray_type: 'PLA', tray_color: 'FF0000FF'}]}]};
  var out = N.normalize(report({gcode_state: 'IDLE', ams: ams}));
  assert.deepStrictEqual(out.units, [{kind: 'ams', n: 1, active: null, trays: [
    {type: 'PETG', color: '00FF00'}, null, {type: 'PLA', color: 'FF0000'}, null]}]);
});

test('units: 3 regular units, tray_now 9 activates unit 2 slot 1', function () {
  var ams = {tray_now: '9', ams: [
    {id: '0', tray: [{id: '0', tray_type: 'PLA', tray_color: 'FF0000FF'}]},
    {id: '2', tray: [{id: '1', tray_type: 'ABS', tray_color: '0000FFFF'}]},
    {id: '1', tray: [{id: '0', tray_type: 'PETG', tray_color: 'FFFFFFFF'}]}]};
  var out = N.normalize(report({gcode_state: 'RUNNING', ams: ams}));
  assert.deepStrictEqual(out.units.map(function (u) { return u.n; }), [1, 2, 3]);
  assert.strictEqual(out.units[0].active, null);
  assert.strictEqual(out.units[1].active, null);
  assert.strictEqual(out.units[2].active, 1);
  assert.deepStrictEqual(out.units[2].trays[1], {type: 'ABS', color: '0000FF'});
  assert.strictEqual(out.ext_active, false);
});

test('units: regular + HT, tray_now 128 and 16 both hit the HT unit', function () {
  var units = [{id: '0', tray: [{id: '0', tray_type: 'PLA', tray_color: 'FF0000FF'}]},
               {id: '128', tray: [{id: '0', tray_type: 'PA', tray_color: '202020FF'}]}];
  var out128 = N.normalize(report({gcode_state: 'RUNNING', ams: {tray_now: '128', ams: units}}));
  assert.deepStrictEqual(out128.units, [
    {kind: 'ams', n: 1, active: null, trays: [{type: 'PLA', color: 'FF0000'}, null, null, null]},
    {kind: 'ht', n: 1, active: 0, trays: [{type: 'PA', color: '202020'}]}]);
  var out16 = N.normalize(report({gcode_state: 'RUNNING', ams: {tray_now: '16', ams: units}}));
  assert.strictEqual(out16.units[1].active, 0);
});

test('units: tray_now 254 sets ext_active and activates no unit', function () {
  var ams = {tray_now: '254', ams: [{id: '0', tray: [{id: '0', tray_type: 'PLA', tray_color: 'FF0000FF'}]}]};
  var out = N.normalize(report({gcode_state: 'RUNNING', ams: ams}));
  assert.strictEqual(out.ext_active, true);
  assert.strictEqual(out.units[0].active, null);
});

test('ams(): HT label "HT1"', function () {
  var ams = {tray_now: '128', ams: [{id: '128', tray: [{id: '0', tray_type: 'PA', tray_color: '202020FF'}]}]};
  assert.deepStrictEqual(N.normalize(report({gcode_state: 'RUNNING', ams: ams})).ams,
    {slot: 'HT1', type: 'PA', color: '202020'});
  var viaGlobal = {tray_now: '16', ams: [{id: '128', tray: [{id: '0', tray_type: 'PA', tray_color: '202020FF'}]}]};
  assert.strictEqual(N.normalize(report({gcode_state: 'RUNNING', ams: viaGlobal})).ams.slot, 'HT1');
});

test('recorded P2S details', function () {
  var out = N.normalize(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'report_p2s.json'), 'utf8')));
  assert.strictEqual(out.speed, 2);
  assert.strictEqual(out.light, 'off');
  assert.strictEqual(out.units.length, 1);
  assert.deepStrictEqual(out.units[0].trays.map(function (t) { return t && t.type; }), ['PLA', 'PLA', 'PETG', 'PLA']);
  assert.strictEqual(out.units[0].trays[2].color, '002E96');
});
