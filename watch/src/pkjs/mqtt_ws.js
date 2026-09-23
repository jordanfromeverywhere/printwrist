// Minimal MQTT 3.1.1 client over WebSocket for PebbleKit JS (ES5), qos 0 only.
// Bambu's broker needs the "mqtt" subprotocol and binary frames. Always send
// Uint8Array views: the Pebble emulator sends an empty frame for a bare ArrayBuffer.

function utf8Encode(str) {
  var out = [], i, c, c2;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      c2 = str.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function utf8Decode(bytes, start, end) {
  var s = '', i = start, c, cp, chunk = [];
  function flush() { s += String.fromCharCode.apply(null, chunk); chunk = []; }
  while (i < end) {
    c = bytes[i++];
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (bytes[i++] & 63);
    else if (c < 0xf0) { cp = ((c & 15) << 12) | ((bytes[i] & 63) << 6) | (bytes[i + 1] & 63); i += 2; }
    else { cp = ((c & 7) << 18) | ((bytes[i] & 63) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    if (cp >= 0x10000) { cp -= 0x10000; chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
    else chunk.push(cp);
    if (chunk.length > 4096) flush();
  }
  flush();
  return s;
}

function encodeLength(n) {
  var out = [], b;
  do {
    b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

// {value, bytes}, or null when more bytes are needed.
function decodeLength(buf, pos) {
  var mult = 1, value = 0, i = 0, b;
  do {
    if (pos + i >= buf.length) return null;
    b = buf[pos + i];
    value += (b & 127) * mult;
    mult *= 128;
    i++;
    if (i > 4) throw new Error('bad remaining length');
  } while (b & 0x80);
  return {value: value, bytes: i};
}

function strField(str) {
  var b = utf8Encode(str);
  return [b.length >> 8, b.length & 255].concat(b);
}

function packet(header, body) {
  return [header].concat(encodeLength(body.length), body);
}

function MqttWs(opts, handlers) {
  this.opts = opts;
  this.h = handlers || {};
  this.WS = opts.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
  this.ws = null;
  this.rx = [];
  this.pingTimer = null;
  this.packetId = 1;
  this.closedByUs = false;
  this.failed = false;
}

MqttWs.prototype.log = function (s) { if (this.opts.debug) console.log('[mqtt] ' + s); };

MqttWs.prototype.connect = function () {
  var self = this;
  try {
    this.ws = new this.WS(this.opts.url, ['mqtt']);
  } catch (e) {
    this.fail('network', 'constructor: ' + e);
    return;
  }
  try { this.ws.binaryType = 'arraybuffer'; } catch (e2) { this.log('binaryType: ' + e2); }
  this.ws.onopen = function () { self.sendConnect(); };
  this.ws.onmessage = function (ev) { self.onFrame(ev.data); };
  this.ws.onerror = function () { self.fail('network', 'socket error'); };
  this.ws.onclose = function (ev) {
    self.stopPing();
    if (self.h.onClose) self.h.onClose(ev && ev.code, self.closedByUs);
  };
};

MqttWs.prototype.fail = function (kind, detail) {
  if (this.failed) return;
  this.failed = true;
  this.log('fail ' + kind + ': ' + detail);
  this.stopPing();
  if (this.h.onError) this.h.onError(kind, detail);
  if (this.ws && this.ws.readyState <= 1) {
    try { this.ws.close(); } catch (e) { this.log('close: ' + e); }
  }
};

MqttWs.prototype.sendBytes = function (bytes) {
  if (!this.ws || this.ws.readyState !== 1) return false;
  var u8 = new Uint8Array(bytes.length), i;
  for (i = 0; i < bytes.length; i++) u8[i] = bytes[i];
  try {
    this.ws.send(u8);
    return true;
  } catch (e) {
    this.fail('network', 'send: ' + e);
    return false;
  }
};

MqttWs.prototype.sendConnect = function () {
  var o = this.opts, flags = 0x02, payload = strField(o.clientId);
  if (o.username) { flags |= 0x80; payload = payload.concat(strField(o.username)); }
  if (o.password) { flags |= 0x40; payload = payload.concat(strField(o.password)); }
  var ka = o.keepalive || 30;
  this.sendBytes(packet(0x10, strField('MQTT').concat([4, flags, ka >> 8, ka & 255], payload)));
};

MqttWs.prototype.subscribe = function (topic) {
  var id = this.packetId++;
  return this.sendBytes(packet(0x82, [id >> 8, id & 255].concat(strField(topic), [0])));
};

MqttWs.prototype.publish = function (topic, message) {
  return this.sendBytes(packet(0x30, strField(topic).concat(utf8Encode(message))));
};

MqttWs.prototype.disconnect = function () {
  this.stopPing();
  this.closedByUs = true;
  if (this.ws && this.ws.readyState === 1) {
    this.sendBytes([0xe0, 0x00]);
    try { this.ws.close(); } catch (e) { this.log('close: ' + e); }
  }
};

MqttWs.prototype.startPing = function () {
  var self = this, ms = (this.opts.keepalive || 30) * 750;
  this.stopPing();
  this.pingTimer = setInterval(function () { self.sendBytes([0xc0, 0x00]); }, ms);
};

MqttWs.prototype.stopPing = function () {
  if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
};

MqttWs.prototype.onFrame = function (data) {
  var i, u8;
  if (typeof data === 'string') {
    for (i = 0; i < data.length; i++) this.rx.push(data.charCodeAt(i) & 255);
  } else if (data && typeof data.byteLength === 'number') {
    u8 = new Uint8Array(data);
    for (i = 0; i < u8.length; i++) this.rx.push(u8[i]);
  } else {
    this.log('ignored frame of type ' + Object.prototype.toString.call(data));
    return;
  }
  this.drain();
};

MqttWs.prototype.drain = function () {
  var len, total, pkt;
  while (this.rx.length >= 2) {
    try { len = decodeLength(this.rx, 1); } catch (e) { this.fail('protocol', 'length'); return; }
    if (!len) return;
    total = 1 + len.bytes + len.value;
    if (this.rx.length < total) return;
    pkt = this.rx.slice(0, total);
    this.rx = this.rx.slice(total);
    this.handlePacket(pkt[0], pkt, 1 + len.bytes, total);
  }
};

MqttWs.prototype.handlePacket = function (hdr, p, start, end) {
  var type = hdr >> 4, rc, qos, tlen, pos;
  if (type === 2) {
    rc = p[start + 1];
    if (rc === 0) {
      this.startPing();
      if (this.h.onConnect) this.h.onConnect();
    } else {
      this.fail(rc === 4 || rc === 5 ? 'auth' : 'protocol', 'CONNACK ' + rc);
    }
  } else if (type === 9) {
    if (this.h.onSubAck) this.h.onSubAck(p.slice(start + 2, end));
  } else if (type === 3) {
    qos = (hdr >> 1) & 3;
    tlen = (p[start] << 8) | p[start + 1];
    pos = start + 2 + tlen + (qos > 0 ? 2 : 0);
    if (this.h.onMessage) this.h.onMessage(utf8Decode(p, start + 2, start + 2 + tlen), utf8Decode(p, pos, end));
  }
};

MqttWs._util = {utf8Encode: utf8Encode, utf8Decode: utf8Decode, encodeLength: encodeLength, decodeLength: decodeLength};
module.exports = MqttWs;
