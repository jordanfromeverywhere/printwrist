var test = require('node:test');
var assert = require('node:assert');
var Messenger = require('../src/pkjs/messenger.js');

function now(fn) { fn(); }

test('sends in order, one at a time', function () {
  var sent = [], pending = [];
  var m = new Messenger(function (msg, ok) { sent.push(msg.n); pending.push(ok); }, now);
  m.push({n: 1}); m.push({n: 2});
  assert.deepStrictEqual(sent, [1]);
  pending.shift()();
  assert.deepStrictEqual(sent, [1, 2]);
});

test('retries once then drops', function () {
  var tries = 0, sent = [];
  var m = new Messenger(function (msg, ok, fail) {
    if (msg.n === 1) { tries++; return fail(); }
    sent.push(msg.n); ok();
  }, now);
  m.push({n: 1}); m.push({n: 2});
  assert.strictEqual(tries, 2);
  assert.deepStrictEqual(sent, [2]);
});
