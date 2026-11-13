/* 極小的 MQTT 3.1.1 用戶端，只走 WebSocket 子協定 "mqtt"。給公開房間清單用，不依賴打包工具。 */
(function (root) {
  "use strict";

  function encodeStr(text) {
    var bytes = new TextEncoder().encode(String(text));
    var out = new Uint8Array(2 + bytes.length);
    out[0] = bytes.length >> 8;
    out[1] = bytes.length & 255;
    out.set(bytes, 2);
    return out;
  }

  function concat(parts) {
    var len = 0;
    var i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var offset = 0;
    for (i = 0; i < parts.length; i++) {
      out.set(parts[i], offset);
      offset += parts[i].length;
    }
    return out;
  }

  function remainingBytes(n) {
    var bytes = [];
    do {
      var digit = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) digit |= 128;
      bytes.push(digit);
    } while (n > 0 && bytes.length < 4);
    return new Uint8Array(bytes);
  }

  function frame(type, body) {
    return concat([new Uint8Array([type]), remainingBytes(body.length), body]);
  }

  function MqttSocket(url) {
    this.url = url;
    this.ws = null;
    this.buffer = new Uint8Array(0);
    this.onMessage = null;
    this.onClose = null;
    this.alive = false;
  }

  MqttSocket.prototype._send = function (bytes) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(bytes);
  };

  MqttSocket.prototype.publish = function (topic, text) {
    var body = concat([encodeStr(topic), new TextEncoder().encode(String(text))]);
    this._send(frame(0x30, body));
  };

  MqttSocket.prototype.subscribe = function (topic) {
    var body = concat([new Uint8Array([0, 1]), encodeStr(topic), new Uint8Array([0])]);
    this._send(frame(0x82, body));
  };

  MqttSocket.prototype.close = function () {
    this.alive = false;
    if (this._ping) clearInterval(this._ping);
    try { if (this.ws) this.ws.close(); } catch (err) {}
  };

  MqttSocket.prototype._push = function (chunk) {
    var next = new Uint8Array(this.buffer.length + chunk.length);
    next.set(this.buffer, 0);
    next.set(chunk, this.buffer.length);
    this.buffer = next;
    this._drain();
  };

  MqttSocket.prototype._drain = function () {
    while (this.buffer.length >= 2) {
      var remaining = 0;
      var multiplier = 1;
      var i = 1;
      var digit;
      do {
        if (i >= this.buffer.length) return;
        digit = this.buffer[i];
        remaining += (digit & 127) * multiplier;
        multiplier *= 128;
        i += 1;
        if (i > 5) return;
      } while (digit & 128);
      if (this.buffer.length < i + remaining) return;
      var packet = this.buffer.slice(0, i + remaining);
      this.buffer = this.buffer.slice(i + remaining);
      this._handle(packet, i);
    }
  };

  MqttSocket.prototype._handle = function (packet, start) {
    var type = packet[0] >> 4;
    if (type !== 3 || !this.onMessage) return;
    if (start + 2 > packet.length) return;
    var topicLen = (packet[start] << 8) | packet[start + 1];
    var topicStart = start + 2;
    if (topicStart + topicLen > packet.length) return;
    var topic = new TextDecoder().decode(packet.slice(topicStart, topicStart + topicLen));
    var payload = new TextDecoder().decode(packet.slice(topicStart + topicLen));
    this.onMessage(topic, payload);
  };

  function connect(url) {
    return new Promise(function (resolve, reject) {
      var socket = new MqttSocket(url);
      var ws;
      try {
        ws = new WebSocket(url, ["mqtt"]);
      } catch (err) {
        reject(err);
        return;
      }
      socket.ws = ws;
      ws.binaryType = "arraybuffer";
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch (err) {}
        reject(new Error("timeout"));
      }, 8000);
      ws.onopen = function () {
        var clientId = "eayg" + Math.floor(Math.random() * 1e9).toString(36);
        var body = concat([
          encodeStr("MQTT"),
          new Uint8Array([4, 2, 0, 30]),
          encodeStr(clientId)
        ]);
        ws.send(frame(0x10, body));
      };
      ws.onmessage = function (ev) {
        var bytes = new Uint8Array(ev.data);
        if (!socket.alive && bytes.length >= 4 && (bytes[0] >> 4) === 2) {
          if (bytes[3] !== 0) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error("connack"));
            }
            try { ws.close(); } catch (err) {}
            return;
          }
          socket.alive = true;
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(socket);
          }
          socket._ping = setInterval(function () {
            socket._send(new Uint8Array([0xc0, 0x00]));
          }, 20000);
          return;
        }
        socket._push(bytes);
      };
      ws.onerror = function () {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("ws"));
        }
      };
      ws.onclose = function () {
        socket.alive = false;
        if (socket._ping) clearInterval(socket._ping);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("closed"));
        }
        if (socket.onClose) socket.onClose();
      };
    });
  }

  root.GuessMqtt = { connect: connect };
})(window);
