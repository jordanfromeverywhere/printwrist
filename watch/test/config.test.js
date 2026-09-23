var test = require('node:test');
var assert = require('node:assert');
var C = require('../../relay/app/static/config/config.js');

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

test('isValidTime', function () {
  assert.ok(C.isValidTime('07:00'));
  assert.ok(!C.isValidTime('7:00'));
  assert.ok(!C.isValidTime('24:00'));
});
