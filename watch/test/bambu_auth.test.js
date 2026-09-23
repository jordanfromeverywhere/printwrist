var test = require('node:test');
var assert = require('node:assert');
var auth = require('../src/pkjs/bambu_auth.js');

function fakeHttp(responses, calls) {
  return function (method, url, body, token, cb) {
    calls.push({method: method, url: url, body: body, token: token});
    var r = responses.shift();
    if (r instanceof Error) return cb(r);
    cb(null, r);
  };
}

test('login ok', function () {
  var calls = [], got;
  var http = fakeHttp([{status: 200, json: {accessToken: 'A', refreshToken: 'R', expiresIn: 3600}}], calls);
  auth.login(http, 'a@b.c', 'pw', function (r) { got = r; });
  assert.strictEqual(got.state, 'ok');
  assert.strictEqual(got.token, 'A');
  assert.strictEqual(got.refresh, 'R');
  assert.ok(got.expiresAt > Date.now());
  assert.deepStrictEqual(calls[0].body, {account: 'a@b.c', password: 'pw'});
  assert.ok(/\/v1\/user-service\/user\/login$/.test(calls[0].url));
});

test('login needs code / tfa / error / network', function () {
  var calls = [], out = [];
  var http = fakeHttp([
    {status: 200, json: {loginType: 'verifyCode'}},
    {status: 200, json: {loginType: 'tfa', tfaKey: 'x'}},
    {status: 400, json: {message: 'Incorrect password'}},
    new Error('offline')
  ], calls);
  for (var i = 0; i < 4; i++) auth.login(http, 'a@b.c', 'pw', function (r) { out.push(r); });
  assert.strictEqual(out[0].state, 'need_code');
  assert.strictEqual(out[1].state, 'tfa_unsupported');
  assert.deepStrictEqual(out[2], {state: 'error', message: 'Incorrect password'});
  assert.strictEqual(out[3].state, 'error');
});

test('sendCode and loginWithCode', function () {
  var calls = [], sent, got;
  var http = fakeHttp([{status: 200, json: {}}, {status: 200, json: {accessToken: 'A2'}}], calls);
  auth.sendCode(http, 'a@b.c', function (ok) { sent = ok; });
  auth.loginWithCode(http, 'a@b.c', '481223', function (r) { got = r; });
  assert.strictEqual(sent, true);
  assert.deepStrictEqual(calls[0].body, {email: 'a@b.c', type: 'codeLogin'});
  assert.deepStrictEqual(calls[1].body, {account: 'a@b.c', code: '481223'});
  assert.strictEqual(got.token, 'A2');
});

test('refresh', function () {
  var calls = [], got;
  auth.refresh(fakeHttp([{status: 200, json: {accessToken: 'N', refreshToken: 'R2', expiresIn: 60}}], calls),
    'R', function (r) { got = r; });
  assert.deepStrictEqual(calls[0].body, {refreshToken: 'R'});
  assert.strictEqual(got.token, 'N');
});
