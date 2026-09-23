var test = require('node:test');
var assert = require('node:assert');
var C = require('../../docs/config/config.js');

test('parseState decodes hash and fills defaults', function () {
  var s = C.parseState('#' + encodeURIComponent(JSON.stringify({signedIn: true, email: 'a@b.c'})));
  assert.strictEqual(s.signedIn, true);
  assert.strictEqual(s.settings.layout, 'arc');
  assert.deepStrictEqual(s.settings.quiet, {on: false, start: '22:00', end: '07:00'});
});

test('parseState survives garbage', function () {
  assert.strictEqual(C.parseState('#%%%').signedIn, false);
});

test('results and close url', function () {
  assert.deepStrictEqual(C.codeResult(' 481 223 '), {action: 'code', code: '481223'});
  var url = C.closeUrl({action: 'signout'});
  assert.strictEqual(url, 'pebblejs://close#' + encodeURIComponent('{"action":"signout"}'));
});

test('closeUrl with returnTo parameter', function () {
  var url = C.closeUrl({action: 'signout'}, 'http://localhost:5000/close?');
  assert.strictEqual(url, 'http://localhost:5000/close?' + encodeURIComponent('{"action":"signout"}'));
});

test('returnToFromSearch parses return_to param', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=http%3A%2F%2Flocalhost%3A5000%2Fclose%3F'), 'http://localhost:5000/close?');
});

test('returnToFromSearch returns empty string for missing param', function () {
  assert.strictEqual(C.returnToFromSearch(''), '');
  assert.strictEqual(C.returnToFromSearch('?x=1'), '');
});

test('returnToFromSearch returns empty string for malformed encoding', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=%E0%A4%A'), '');
});

test('isValidTime', function () {
  assert.ok(C.isValidTime('07:00'));
  assert.ok(!C.isValidTime('7:00'));
  assert.ok(!C.isValidTime('24:00'));
});

test('returnToFromSearch rejects an https redirect to another origin', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=https%3A%2F%2Fevil.example%2F'), '');
});

test('returnToFromSearch keeps a localhost target with a port', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=http%3A%2F%2Flocalhost%3A5000%2Fclose%3F'), 'http://localhost:5000/close?');
});

test('returnToFromSearch keeps a 127.0.0.1 target', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=http%3A%2F%2F127.0.0.1%3A9%2Fclose%3F'), 'http://127.0.0.1:9/close?');
});

test('returnToFromSearch keeps a pebblejs target', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=pebblejs%3A%2F%2Fclose%23'), 'pebblejs://close#');
});

test('returnToFromSearch rejects a lookalike host', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=http%3A%2F%2Flocalhost.evil.example%2F'), '');
});

test('returnToFromSearch rejects a javascript: target', function () {
  assert.strictEqual(C.returnToFromSearch('?return_to=javascript%3Aalert(1)'), '');
});

test('settings no longer carry a relay URL', function () {
  var s = C.parseState('#' + encodeURIComponent(JSON.stringify({settings: {relayUrl: 'https://x.example'}})));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(s.settings, 'relayUrl'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(C.DEFAULT_SETTINGS, 'relayUrl'), false);
});

test('resendResult returns action: resend', function () {
  assert.deepStrictEqual(C.resendResult(), {action: 'resend'});
});

test('DEFAULT_SETTINGS has no controlEnabled', function () {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(C.DEFAULT_SETTINGS, 'controlEnabled'), false);
});

test('parseState settings have no controlEnabled', function () {
  var s = C.parseState('#' + encodeURIComponent(JSON.stringify({signedIn: true})));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(s.settings, 'controlEnabled'), false);
});
