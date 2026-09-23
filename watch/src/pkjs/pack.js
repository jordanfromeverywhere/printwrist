var C = require('./constants.js');

function int(v, dflt) { return typeof v === 'number' && isFinite(v) ? Math.round(v) : dflt; }
function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

function statusToMessage(s) {
  s = s || {};
  var ams = s.ams || null;
  return {
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
}

function configMessage(settings, conn, printerName) {
  return {LAYOUT: C.LAYOUT_CODES[settings.layout], CONTROL_ENABLED: settings.controlEnabled ? 1 : 0,
          CONN_STATE: conn, PRINTER_NAME: str(printerName, 23)};
}

module.exports = {statusToMessage: statusToMessage, configMessage: configMessage};
