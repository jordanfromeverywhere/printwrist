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

// Maps ams.tray_now to what's feeding: a regular AMS unit + slot, an HT unit, the external
// spool, or none. Shared by ams() (the one-line label) and units() (the per-unit active slot).
function feedTarget(now) {
  if (now === '254') return {kind: 'ext'};
  var n = num(now);
  if (n === null) return null;
  if (n >= 0 && n <= 15) return {kind: 'ams', id: Math.floor(n / 4), slot: n % 4};
  if (n >= 128 && n <= 135) return {kind: 'ht', id: n};
  if (n >= 16 && n <= 23) return {kind: 'ht', id: 128 + (n - 16)};
  return null;
}

function findUnit(units, id) {
  var i;
  for (i = 0; i < (units || []).length; i++) { if (num(units[i].id) === id) return units[i]; }
  return null;
}

function findTray(unit, slot) {
  var arr = (unit && unit.tray) || [], i;
  for (i = 0; i < arr.length; i++) { if (num(arr[i].id) === slot) return arr[i]; }
  return null;
}

function ams(p) {
  var a = p.ams || {}, now = String(a.tray_now === undefined ? '255' : a.tray_now);
  var target = feedTarget(now), tray, unit, t;
  if (!target) return null;
  if (target.kind === 'ext') {
    tray = external(p);
    return {slot: 'Ext', type: tray.tray_type || '', color: color(tray.tray_color)};
  }
  if (target.kind === 'ht') {
    unit = findUnit(a.ams, target.id);
    t = findTray(unit, 0);
    return {slot: 'HT' + (target.id - 127), type: t ? (t.tray_type || '') : '', color: t ? color(t.tray_color) : null};
  }
  unit = findUnit(a.ams, target.id);
  t = findTray(unit, target.slot);
  return {slot: 'AMS' + (target.id + 1) + '-' + (target.slot + 1), type: t ? (t.tray_type || '') : '', color: t ? color(t.tray_color) : null};
}

function fanPct(v) {
  var n = num(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100 / 15)));
}

function speed(v) { var n = num(v); return n !== null && n >= 1 && n <= 4 ? n : null; }

function light(p) {
  var l = p.lights_report, i;
  if (!Array.isArray(l)) return null;
  for (i = 0; i < l.length; i++) {
    if (l[i] && l[i].node === 'chamber_light') return l[i].mode === 'off' ? 'off' : 'on';
  }
  return null;
}

function spool(t) {
  if (!t || typeof t !== 'object' || !t.tray_type) return null;
  return {type: t.tray_type, color: color(t.tray_color)};
}

function unitTrays(unit, count) {
  var out = [], arr = (unit && unit.tray) || [], i, id;
  for (i = 0; i < count; i++) out.push(null);
  for (i = 0; i < arr.length; i++) {
    id = num(arr[i].id);
    if (id !== null && id >= 0 && id < count) out[id] = spool(arr[i]);
  }
  return out;
}

function units(p) {
  var a = p.ams || {}, list = a.ams || [], regular = [], ht = [], i, u, id;
  var feed = feedTarget(String(a.tray_now === undefined ? '255' : a.tray_now));
  for (i = 0; i < list.length; i++) {
    u = list[i];
    id = num(u.id);
    if (id === null) continue;
    if (id >= 0 && id <= 3) regular.push(u);
    else if (id >= 128 && id <= 135) ht.push(u);
  }
  regular.sort(function (x, y) { return num(x.id) - num(y.id); });
  ht.sort(function (x, y) { return num(x.id) - num(y.id); });
  var out = [], rid;
  for (i = 0; i < regular.length && out.length < 12; i++) {
    rid = num(regular[i].id);
    out.push({kind: 'ams', n: rid + 1, trays: unitTrays(regular[i], 4),
              active: (feed && feed.kind === 'ams' && feed.id === rid) ? feed.slot : null});
  }
  for (i = 0; i < ht.length && out.length < 12; i++) {
    rid = num(ht[i].id);
    out.push({kind: 'ht', n: rid - 127, trays: unitTrays(ht[i], 1),
              active: (feed && feed.kind === 'ht' && feed.id === rid) ? 0 : null});
  }
  return out;
}

function extActive(p) {
  return String(((p.ams || {}).tray_now === undefined) ? '255' : p.ams.tray_now) === '254';
}

function empty() {
  return {stage: 'offline', progress: null, remaining_min: null, nozzle: null, bed: null, chamber: null,
          layer: null, total_layers: null, job: null, error_code: null, ams: null,
          nozzle_target: null, bed_target: null, fan_part: null, fan_aux: null, fan_chamber: null,
          speed: null, light: null, units: [], ext_active: false, ext: null};
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
    ams: ams(p),
    nozzle_target: num(p.nozzle_target_temper),
    bed_target: num(p.bed_target_temper),
    fan_part: fanPct(p.cooling_fan_speed),
    fan_aux: fanPct(p.big_fan1_speed),
    fan_chamber: fanPct(p.big_fan2_speed),
    speed: speed(p.spd_lvl),
    light: light(p),
    units: units(p),
    ext_active: extActive(p),
    ext: spool(external(p))
  };
}

module.exports = {normalize: normalize, STAGES: STAGES};
