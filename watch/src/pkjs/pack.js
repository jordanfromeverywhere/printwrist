var C = require('./constants.js');

function int(v, dflt) { return typeof v === 'number' && isFinite(v) ? Math.round(v) : dflt; }
function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
function hex(c) { return typeof c === 'string' && /^[0-9A-Fa-f]{6}$/.test(c) ? parseInt(c, 16) : -1; }

function statusToMessage(s) {
  s = s || {};
  var ams = s.ams || null;
  var m = {
    STAGE: C.STAGE_CODES.hasOwnProperty(s.stage) ? C.STAGE_CODES[s.stage] : C.STAGE_CODES.offline,
    PROGRESS: Math.max(0, Math.min(100, int(s.progress, 0))),
    REMAINING_MIN: int(s.remaining_min, 0),
    NOZZLE: int(s.nozzle, C.TEMP_NONE),
    BED: int(s.bed, C.TEMP_NONE),
    CHAMBER: int(s.chamber, C.TEMP_NONE),
    LAYER: int(s.layer, 0),
    TOTAL_LAYERS: int(s.total_layers, 0),
    JOB: str(s.job, 31),
    AMS_LABEL: ams ? str((ams.slot + ' ' + (ams.type || '')).trim(), 19) : '',
    AMS_COLOR: ams && /^[0-9A-Fa-f]{6}$/.test(ams.color || '') ? parseInt(ams.color, 16) : -1,
    ERROR_CODE: str(s.error_code, 11)
  };
  var trays = Array.isArray(s.trays) ? s.trays : [], i, t;
  m.NOZZLE_TARGET = int(s.nozzle_target, C.TEMP_NONE);
  m.BED_TARGET = int(s.bed_target, C.TEMP_NONE);
  m.FAN_PART = int(s.fan_part, -1);
  m.FAN_AUX = int(s.fan_aux, -1);
  m.FAN_CHAMBER = int(s.fan_chamber, -1);
  m.SPEED_LEVEL = int(s.speed, 0);
  m.LIGHT = s.light === 'on' ? 1 : (s.light === 'off' ? 0 : -1);
  m.TRAY_ACTIVE = int(s.tray_active, -1);
  for (i = 0; i < 4; i++) {
    t = trays[i] || null;
    m['TRAY' + i + '_TYPE'] = t ? str(t.type, 7) : '';
    m['TRAY' + i + '_COLOR'] = t ? hex(t.color) : -1;
  }
  m.EXT_TYPE = s.ext ? str(s.ext.type, 7) : '';
  m.EXT_COLOR = s.ext ? hex(s.ext.color) : -1;
  return m;
}

function configMessage(settings, conn, printerName) {
  return {LAYOUT: C.LAYOUT_CODES[settings.layout], CONN_STATE: conn, PRINTER_NAME: str(printerName, 23)};
}

module.exports = {statusToMessage: statusToMessage, configMessage: configMessage};
