var STAGES = {RUNNING: 'printing', PREPARE: 'printing', SLICING: 'printing',
              PAUSE: 'paused', FINISH: 'done', FAILED: 'failed', IDLE: 'idle'};

function num(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  var n = Number(v);
  return isFinite(n) ? Math.round(n) : null;
}

function deep(d) {
  var i, k;
  for (i = 1; i < arguments.length; i++) {
    k = arguments[i];
    if (d === null || d === undefined) return null;
    if (Array.isArray(d)) { if (typeof k !== 'number' || k < 0 || k >= d.length) return null; d = d[k]; }
    else if (typeof d === 'object') d = d[k];
    else return null;
  }
  return d === undefined ? null : d;
}

function first() {
  var i, n;
  for (i = 0; i < arguments.length; i++) { n = num(arguments[i]); if (n !== null) return n; }
  return null;
}

function color(c) { return typeof c === 'string' && c.length >= 6 ? c.slice(0, 6).toUpperCase() : null; }

function errorCode(v) {
  var n = num(v);
  if (!n) return null;
  var h = (n >>> 0).toString(16).toUpperCase();
  while (h.length < 8) h = '0' + h;
  return h.slice(0, 4) + '-' + h.slice(4);
}

function external(p) {
  if (p.vt_tray && typeof p.vt_tray === 'object' && !Array.isArray(p.vt_tray) && Object.keys(p.vt_tray).length) return p.vt_tray;
  if (Array.isArray(p.vir_slot) && p.vir_slot.length && p.vir_slot[0] && typeof p.vir_slot[0] === 'object') return p.vir_slot[0];
  return {};
}

function ams(p) {
  var a = p.ams || {}, now = String(a.tray_now === undefined ? '255' : a.tray_now), idx, unit, slot, i, j, u, t, tray;
  if (now === '255') return null;
  if (now === '254') {
    tray = external(p);
    return {slot: 'Ext', type: tray.tray_type || '', color: color(tray.tray_color)};
  }
  idx = num(now);
  if (idx === null) return null;
  unit = Math.floor(idx / 4);
  slot = idx % 4;
  for (i = 0; i < (a.ams || []).length; i++) {
    u = a.ams[i];
    if (num(u.id) !== unit) continue;
    for (j = 0; j < (u.tray || []).length; j++) {
      t = u.tray[j];
      if (num(t.id) === slot) return {slot: 'AMS' + (unit + 1) + '-' + (slot + 1), type: t.tray_type || '', color: color(t.tray_color)};
    }
  }
  return {slot: 'AMS' + (unit + 1) + '-' + (slot + 1), type: '', color: null};
}

function empty() {
  return {stage: 'offline', progress: null, remaining_min: null, nozzle: null, bed: null, chamber: null,
          layer: null, total_layers: null, job: null, error_code: null, ams: null};
}

function normalize(report) {
  if (!report || !report.print || typeof report.print !== 'object') return empty();
  var p = report.print, state = String(p.gcode_state === undefined ? '' : p.gcode_state).toUpperCase();
  return {
    stage: STAGES.hasOwnProperty(state) ? STAGES[state] : 'idle',
    progress: num(p.mc_percent),
    remaining_min: num(p.mc_remaining_time),
    nozzle: first(p.nozzle_temper, deep(p, 'device', 'extruder', 'info', 0, 'temp')),
    bed: first(p.bed_temper, deep(p, 'device', 'bed', 'info', 'temp')),
    chamber: first(p.chamber_temper, deep(p, 'device', 'ctc', 'info', 'temp')),
    layer: num(p.layer_num),
    total_layers: num(p.total_layer_num),
    job: p.subtask_name || null,
    error_code: errorCode(p.print_error),
    ams: ams(p)
  };
}

module.exports = {normalize: normalize, STAGES: STAGES};
