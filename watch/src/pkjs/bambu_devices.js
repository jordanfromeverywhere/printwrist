var API = require('./bambu_auth.js').API;

function listDevices(http, token, cb) {
  http('GET', API + '/v1/iot-service/api/user/bind', null, token, function (err, res) {
    if (err) return cb({kind: 'network'});
    if (res.status === 401 || res.status === 403) return cb({kind: 'auth'});
    if (res.status !== 200 || !res.json) return cb({kind: 'server'});
    var list = (res.json.devices || []).map(function (d) {
      return {serial: d.dev_id, name: d.name || d.dev_product_name || d.dev_id, online: !!d.online};
    });
    cb(null, list);
  });
}
module.exports = {listDevices: listDevices};
