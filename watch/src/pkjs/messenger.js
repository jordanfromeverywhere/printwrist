function Messenger(sendFn, defer) {
  this.q = [];
  this.busy = false;
  this.sendFn = sendFn;
  this.defer = defer || function (fn) { setTimeout(fn, 500); };
}

Messenger.prototype.push = function (msg) {
  this.q.push({msg: msg, tries: 0});
  this.pump();
};

Messenger.prototype.pump = function () {
  if (this.busy || !this.q.length) return;
  var self = this, item = this.q[0];
  this.busy = true;
  this.sendFn(item.msg, function () {
    self.q.shift();
    self.busy = false;
    self.pump();
  }, function () {
    item.tries++;
    if (item.tries >= 2) self.q.shift();
    self.busy = false;
    self.defer(function () { self.pump(); });
  });
};

module.exports = Messenger;
