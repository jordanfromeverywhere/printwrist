function errKind(res) {
  if (res.status === 401) return {kind: 'auth'};
  if (res.status === 429) return {kind: 'rate'};
  return {kind: 'server', status: res.status};
}

function fetchStatus(http, base, token, serial, cb) {
  http('POST', base + '/status', {serial: serial}, token, function (err, res) {
    if (err) return cb({kind: 'network'});
    if (res.status !== 200 || !res.json) return cb(errKind(res));
    cb(null, res.json);
  });
}

function sendControl(http, base, token, serial, action, cb) {
  http('POST', base + '/control', {serial: serial, action: action}, token, function (err, res) {
    if (err) return cb({kind: 'network'});
    if (res.status === 409) return cb(null, 'rejected');
    if (res.status !== 200 || !res.json) return cb(errKind(res));
    cb(null, res.json.result === 'ok' ? 'ok' : 'unconfirmed');
  });
}

module.exports = {fetchStatus: fetchStatus, sendControl: sendControl};
