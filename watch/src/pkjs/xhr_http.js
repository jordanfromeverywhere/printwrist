function xhrHttp(method, url, body, token, cb) {
  var done = false;
  function finish(err, res) { if (done) return; done = true; cb(err, res); }
  var req = new XMLHttpRequest();
  req.open(method, url, true);
  req.setRequestHeader('Content-Type', 'application/json');
  if (token) req.setRequestHeader('Authorization', 'Bearer ' + token);
  req.timeout = 20000;
  req.onload = function () {
    var json = null;
    try { json = JSON.parse(req.responseText); } catch (e) { json = null; }
    finish(null, {status: req.status, json: json});
  };
  req.onerror = function () { finish(new Error('network')); };
  req.ontimeout = function () { finish(new Error('timeout')); };
  req.send(body ? JSON.stringify(body) : null);
}
module.exports = xhrHttp;
