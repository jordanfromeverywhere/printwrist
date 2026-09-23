var test = require('node:test');
var assert = require('node:assert');
var C = require('../../docs/config/config.js');

test('parseState decodes hash and fills defaults', function () {
  var s = C.parseState('#' + encodeURIComponent(JSON.stringify({signedIn: true, email: 'a@b.c'})));
  assert.strictEqual(s.signedIn, true);
  assert.strictEqual(s.settings.layout, 'arc');
  assert.strictEqual(s.settings.controlEnabled, false);
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

test('settings no longer carry a relay URL', function () {
  var s = C.parseState('#' + encodeURIComponent(JSON.stringify({settings: {relayUrl: 'https://x.example'}})));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(s.settings, 'relayUrl'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(C.DEFAULT_SETTINGS, 'relayUrl'), false);
});
