var API = 'https://api.bambulab.com';

function interpretLogin(res) {
  var j = (res && res.json) || {};
  if (res && res.status === 200 && j.accessToken) {
    return {state: 'ok', token: j.accessToken, refresh: j.refreshToken || null,
            expiresAt: Date.now() + (j.expiresIn || 3600) * 1000};
  }
  if (j.loginType === 'verifyCode') return {state: 'need_code'};
  if (j.loginType === 'tfa') return {state: 'tfa_unsupported'};
  return {state: 'error', message: j.message || j.error || ('HTTP ' + (res ? res.status : '?'))};
}

function post(http, path, body, cb) {
  http('POST', API + path, body, null, function (err, res) {
    if (err) return cb({state: 'error', message: 'Could not reach Bambu Lab'});
    cb(interpretLogin(res));
  });
}

function login(http, email, password, cb) { post(http, '/v1/user-service/user/login', {account: email, password: password}, cb); }
function loginWithCode(http, email, code, cb) { post(http, '/v1/user-service/user/login', {account: email, code: code}, cb); }
function refresh(http, refreshToken, cb) { post(http, '/v1/user-service/user/refreshtoken', {refreshToken: refreshToken}, cb); }

function sendCode(http, email, cb) {
  http('POST', API + '/v1/user-service/user/sendemail/code', {email: email, type: 'codeLogin'}, null,
    function (err, res) { cb(!err && res.status === 200); });
}

module.exports = {login: login, loginWithCode: loginWithCode, refresh: refresh, sendCode: sendCode,
                  interpretLogin: interpretLogin, API: API};
