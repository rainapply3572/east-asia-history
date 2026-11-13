/* 多人連線：房主星形拓撲，經 PeerJS 公共伺服器交換訊號，資料通道直連房主。 */
(function () {
  "use strict";

  const PEER_PREFIX = "eayg-tw-";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LEN = 6;
  const MAX_PLAYERS = 8;
  const NICK_MAX = 12;
  const TIME_OPTIONS = [0, 30, 60, 90];
  const PLAYER_COLORS = [
    "#9e2b1f", "#3d5a80", "#2b6b62", "#b07a1a", "#7a5c8a",
    "#5a6b3d", "#8c4a3a", "#4a5d7a", "#9e4b6e", "#4a3b2f"
  ];
  const NICK_KEY = "eastAsiaYearGuess.nick";

  const mp = {
    mode: "solo",
    phase: "idle",
    role: null,
    roomCode: "",
    peer: null,
    selfId: "",
    nick: "",
    timeLimit: 0,
    players: [],
    conns: {},
    hostConn: null,
    answers: {},
    endsAt: 0,
    timerId: 0,
    tickId: 0,
    lastReveal: null,
    lastFinal: null,
    started: false,
    connectBtnMode: "create",
    maxPlayers: 4,
    listed: false,
    beat: 0
  };

  const ROOM_TOPIC = "east-asia-history/guess/rooms/v1";
  const ROOM_BROKER = "wss://broker.hivemq.com:8884/mqtt";
  const SEARCHING = "正在搜尋公開房間...";
  const directory = { socket: null, connecting: null, ok: false, rooms: {}, open: false, sweep: 0 };

  const ui = {};

  function Y() {
    return window.YearGuess;
  }

  function state() {
    return Y().getState();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function isActive() {
    return mp.mode === "host" || mp.mode === "join"
      ? !!(mp.peer || mp.phase === "connecting" || mp.phase === "lobby" || mp.phase === "playing" || mp.phase === "reveal" || mp.phase === "result")
      : false;
  }

  function inRoom() {
    return !!(mp.peer && (mp.phase === "lobby" || mp.phase === "playing" || mp.phase === "reveal" || mp.phase === "result" || mp.phase === "connecting"));
  }

  function isHost() {
    return mp.role === "host";
  }

  function iceConfig() {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "turn:0.peerjs.com:3478", username: "peerjs", credential: "peerjsp" }
      ]
    };
  }

  function peerOptions() {
    const q = new URLSearchParams(location.search);
    const global = window.YEAR_GUESS_PEER || {};
    const host = q.get("peerHost") || global.host;
    const base = { debug: 0, config: iceConfig() };
    if (!host) return base;
    const secureRaw = q.get("peerSecure");
    const secure = secureRaw != null ? secureRaw === "true" : (global.secure !== undefined ? !!global.secure : false);
    return Object.assign(base, {
      host: host,
      port: Number(q.get("peerPort") || global.port || 9000),
      path: q.get("peerPath") || global.path || "/",
      key: q.get("peerKey") || global.key || "peerjs",
      secure: secure
    });
  }

  function relayUrl() {
    const q = new URLSearchParams(location.search);
    const global = window.YEAR_GUESS_PEER || {};
    return q.get("peerRelay") || global.relay || "";
  }

  function connectRelaySocket() {
    const url = relayUrl();
    if (!url) return Promise.reject(new Error("no relay"));
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch (e) {}
        reject(new Error("無法連上訊息中繼伺服器，請檢查網路後再試。"));
      }, 8000);
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ws);
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("無法連上訊息中繼伺服器，請檢查網路後再試。"));
      };
    });
  }

  function makeRelayConn(peerId) {
    const conn = {
      peer: peerId,
      open: true,
      send: function (payload) {
        if (!mp.relayWs || mp.relayWs.readyState !== 1) return;
        let data = payload;
        if (typeof payload === "string") {
          try { data = JSON.parse(payload); } catch (e) {}
        }
        mp.relayWs.send(JSON.stringify({ type: "data", to: peerId, data: data }));
      },
      close: function () {}
    };
    mp.conns[peerId] = conn;
    return conn;
  }

  function randomCode() {
    let s = "";
    const buf = new Uint8Array(CODE_LEN);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[buf[i] % CODE_CHARS.length];
    return s;
  }

  function normalizeCode(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  }

  function normalizeNick(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().slice(0, NICK_MAX);
  }

  function peerIdForCode(code) {
    return PEER_PREFIX + code;
  }

  function now() {
    return Date.now();
  }

  function send(conn, obj) {
    if (!conn || !conn.open) return false;
    try {
      conn.send(JSON.stringify(obj));
      return true;
    } catch (err) {
      return false;
    }
  }

  function parseMsg(data) {
    if (data == null) return null;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch (e) { return null; }
    }
    if (typeof data === "object") return data;
    return null;
  }

  function broadcast(obj, exceptId) {
    Object.keys(mp.conns).forEach((id) => {
      if (exceptId && id === exceptId) return;
      send(mp.conns[id], obj);
    });
  }

  function setError(msg) {
    if (!ui.mpError) return;
    if (!msg) {
      ui.mpError.hidden = true;
      ui.mpError.textContent = "";
      return;
    }
    ui.mpError.hidden = false;
    ui.mpError.textContent = msg;
  }

  function setStatus(msg) {
    if (ui.mpStatus) ui.mpStatus.textContent = msg || "";
  }

  function saveNick(nick) {
    try { localStorage.setItem(NICK_KEY, nick); } catch (e) {}
  }

  function loadNick() {
    try { return localStorage.getItem(NICK_KEY) || ""; } catch (e) { return ""; }
  }

  function playerColor(index) {
    return PLAYER_COLORS[index % PLAYER_COLORS.length];
  }

  function collectSettings() {
    const st = state();
    const categories = [...st.categories];
    const allCats = categories.length === 0 || categories.length === Y().CATEGORIES.length;
    return {
      regions: [...st.regions],
      start: st.start,
      end: st.end,
      presetId: st.presetId,
      categories: allCats ? [] : categories,
      allCategories: allCats,
      rounds: st.rounds,
      showMap: !!(ui.showMap ? ui.showMap.checked : st.showMap),
      curriculumOnly: !!(ui.curriculumOnly ? ui.curriculumOnly.checked : st.curriculumOnly),
      timeLimit: mp.timeLimit,
      schemeId: st.schemeId
    };
  }

  function applySettings(s) {
    if (!s) return;
    const st = state();
    st.regions = new Set(s.regions && s.regions.length ? s.regions : Y().REGIONS);
    st.start = s.start;
    st.end = s.end;
    st.presetId = s.presetId || "custom";
    if (s.allCategories || !s.categories || !s.categories.length) {
      st.categories = new Set(Y().CATEGORIES);
    } else {
      st.categories = new Set(s.categories);
    }
    st.rounds = s.rounds;
    st.showMap = !!s.showMap;
    st.curriculumOnly = !!s.curriculumOnly;
    st.schemeId = s.schemeId || st.schemeId;
    mp.timeLimit = Number(s.timeLimit) || 0;
    if (ui.showMap) ui.showMap.checked = st.showMap;
    if (ui.curriculumOnly) ui.curriculumOnly.checked = st.curriculumOnly;
    if (Y().renderRegionChips) Y().renderRegionChips();
    if (Y().renderCategoryChips) Y().renderCategoryChips();
    if (Y().renderPresetChips) Y().renderPresetChips();
    if (Y().renderRoundChips) Y().renderRoundChips();
    if (Y().updateRangeUi) Y().updateRangeUi();
    renderTimeLimitChips();
    renderSettingsSummary(s);
  }

  function formatSettings(s) {
    if (!s) return "";
    const yg = Y();
    const regions = (s.regions || []).join("、") || "—";
    const cats = s.allCategories || !s.categories || !s.categories.length ? "全部" : s.categories.join("、");
    const time = s.timeLimit ? s.timeLimit + " 秒" : "不限時";
    return (
      "<p><strong>地區</strong>　" + yg.escapeHtml(regions) + "</p>" +
      "<p><strong>年代</strong>　" + yg.escapeHtml(yg.formatYear(s.start) + " 至 " + yg.formatYear(s.end)) + "</p>" +
      "<p><strong>類型</strong>　" + yg.escapeHtml(cats) + "</p>" +
      "<p><strong>僅課內題</strong>　" + (s.curriculumOnly ? "開" : "關") +
      "　<strong>回合</strong>　" + s.rounds +
      "　<strong>時限</strong>　" + time +
      "　<strong>地圖</strong>　" + (s.showMap ? "開" : "關") + "</p>"
    );
  }

  function renderSettingsSummary(s) {
    if (!ui.mpSettingsSummary) return;
    const show = mp.mode === "join" && !!s;
    ui.mpSettingsSummary.hidden = !show;
    if (show) ui.mpSettingsSummary.innerHTML = formatSettings(s);
  }

  function renderPlayers() {
    if (!ui.mpPlayerList) return;
    ui.mpPlayerList.innerHTML = "";
    mp.players.forEach((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = p.nick;
      li.appendChild(name);
      if (p.isHost) {
        const tag = document.createElement("span");
        tag.className = "mp-host-tag";
        tag.textContent = "房主";
        li.appendChild(tag);
      }
      if (p.id === mp.selfId) {
        const tag = document.createElement("span");
        tag.className = "mp-you-tag";
        tag.textContent = "你";
        li.appendChild(tag);
      }
      ui.mpPlayerList.appendChild(li);
    });
    if (ui.mpPlayerCount) {
      ui.mpPlayerCount.textContent = mp.players.length + " / " + roomCap();
    if (isHost() && mp.listed && mp.phase === "lobby") publishRoom("waiting");
    }
  }

  function renderTimeLimitChips() {
    const box = ui.timeLimitFilters;
    if (!box) return;
    box.innerHTML = "";
    TIME_OPTIONS.forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (mp.timeLimit === n ? " is-on" : "");
      btn.textContent = n === 0 ? "不限時" : n + " 秒";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", mp.timeLimit === n ? "true" : "false");
      btn.addEventListener("click", () => {
        if (!isHost() && mp.phase !== "idle") return;
        mp.timeLimit = n;
        renderTimeLimitChips();
        onSettingsChanged();
      });
      box.appendChild(btn);
    });
  }

  function setMode(mode) {
    mp.mode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      const on = btn.id === "mode" + mode.charAt(0).toUpperCase() + mode.slice(1) ||
        (mode === "solo" && btn.id === "modeSolo") ||
        (mode === "host" && btn.id === "modeHost") ||
        (mode === "join" && btn.id === "modeJoin");
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.body.classList.toggle("mp-host", mode === "host");
    document.body.classList.toggle("mp-guest", mode === "join");
    document.body.classList.toggle("mp-active", mode !== "solo");
    if (ui.mpPanel) ui.mpPanel.hidden = mode === "solo";
    if (ui.mpPublic) ui.mpPublic.hidden = mode !== "join";
    if (mode === "join") {
      ensureBroker();
      startSweep();
      renderPublicRooms();
    }
    if (ui.timeLimitGroup) ui.timeLimitGroup.hidden = mode !== "host";
    if (ui.mpCodeField) ui.mpCodeField.hidden = mode !== "join";
    if (ui.mpConnectBtn) {
      ui.mpConnectBtn.textContent = mode === "join" ? "加入房間" : "建立房間";
      mp.connectBtnMode = mode === "join" ? "join" : "create";
    }
    if (ui.startBtn) {
      ui.startBtn.textContent = mode === "host" ? "開始對戰" : "開始遊戲";
    }
    const inLobby = mp.phase === "lobby" || mp.phase === "connecting" || mp.phase === "playing" || mp.phase === "reveal" || mp.phase === "result";
    if (ui.mpConnectBox) ui.mpConnectBox.hidden = mode === "solo" ? true : inLobby && !!mp.peer;
    if (ui.mpRoom) ui.mpRoom.hidden = !(mode !== "solo" && (mp.peer || mp.roomCode));
    renderSettingsSummary(mode === "join" ? collectSettings() : null);
    if (mode === "solo") setError("");
  }

  function showRoomUi() {
    document.body.classList.add("mp-in-room");
    const box = ui.mpConnectBox || document.getElementById("mpConnectBox");
    const room = ui.mpRoom || document.getElementById("mpRoom");
    if (box) box.hidden = true;
    if (room) room.hidden = false;
    if (ui.mpCodeDisplay) ui.mpCodeDisplay.textContent = mp.roomCode || "——";
    renderPlayers();
  }

  function destroyPeer() {
    stopTimer();
    const peer = mp.peer;
    const ws = mp.relayWs;
    mp.peer = null;
    mp.relayWs = null;
    mp.hostConn = null;
    mp.conns = {};
    if (peer) {
      try { peer.destroy(); } catch (e) {}
    }
    if (ws) {
      try { ws.close(); } catch (e) {}
    }
  }

  function resetRoom(keepMode) {
    stopRoomBeats(true);
    mp.listed = false;
    destroyPeer();
    mp.phase = "idle";
    mp.role = keepMode === "host" || keepMode === "join" ? (keepMode === "host" ? "host" : "guest") : null;
    mp.roomCode = "";
    mp.selfId = "";
    mp.players = [];
    mp.answers = {};
    mp.endsAt = 0;
    mp.lastReveal = null;
    mp.lastFinal = null;
    mp.started = false;
    document.body.classList.remove("mp-active");
    document.body.classList.remove("mp-in-room");
    if (!keepMode || keepMode === "solo") {
      setMode("solo");
    } else {
      setMode(keepMode);
      if (ui.mpConnectBox) ui.mpConnectBox.hidden = false;
      if (ui.mpRoom) ui.mpRoom.hidden = true;
    }
    if (ui.mpAnswerStatus) ui.mpAnswerStatus.hidden = true;
    if (ui.mpTimerWrap) ui.mpTimerWrap.hidden = true;
    if (ui.mpLeaderboard) ui.mpLeaderboard.hidden = true;
    if (ui.mpStandings) ui.mpStandings.hidden = true;
    if (ui.mpWaitHint) ui.mpWaitHint.hidden = true;
    if (ui.nextBtn) ui.nextBtn.style.display = "";
    setStatus("");
  }

  function uniqueNick(desired, exceptId) {
    const base = normalizeNick(desired) || "玩家";
    const taken = (name) => mp.players.some((p) => p.id !== exceptId && p.nick === name);
    if (!taken(base)) return base;
    for (let i = 2; i <= MAX_PLAYERS + 5; i++) {
      const n = (base + i).slice(0, NICK_MAX);
      if (!taken(n)) return n;
    }
    return base + String(now() % 100);
  }

  function findPlayer(id) {
    return mp.players.find((p) => p.id === id) || null;
  }

  function lobbyPayload() {
    return {
      type: "lobby",
      players: mp.players,
      settings: collectSettings(),
      phase: mp.phase === "connecting" ? "lobby" : mp.phase
    };
  }

  function attachHostConnection(conn) {
    conn.on("data", (data) => onHostMessage(conn, parseMsg(data)));
    conn.on("close", () => onGuestDisconnected(conn.peer));
    conn.on("error", () => onGuestDisconnected(conn.peer));
  }

  function onGuestDisconnected(peerId) {
    if (!isHost()) return;
    if (!mp.conns[peerId] && !findPlayer(peerId)) return;
    delete mp.conns[peerId];
    const was = findPlayer(peerId);
    mp.players = mp.players.filter((p) => p.id !== peerId);
    delete mp.answers[peerId];
    renderPlayers();
    if (was) setStatus(was.nick + " 已離開房間。");
    if (mp.phase === "lobby") {
      broadcast(lobbyPayload());
    } else if (mp.phase === "playing") {
      broadcastAnswerStatus();
      maybeEndRound();
    } else if (mp.phase === "reveal" || mp.phase === "result") {
      broadcast(lobbyPayload());
    }
  }

  function onHostMessage(conn, msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "hello") {
      if (mp.phase !== "lobby") {
        send(conn, { type: "join-error", reason: "in-progress", message: "遊戲已經開始，請等下一局再開。" });
        try { conn.close(); } catch (e) {}
        return;
      }
      if (mp.players.length >= roomCap()) {
        send(conn, { type: "join-error", reason: "room-full", message: "房間已滿" });
        try { conn.close(); } catch (e) {}
        return;
      }
      const wanted = normalizeNick(msg.nick);
      if (!wanted) {
        send(conn, { type: "join-error", reason: "bad-nick", message: "請輸入暱稱。" });
        try { conn.close(); } catch (e) {}
        return;
      }
      if (mp.players.some((p) => p.nick === wanted)) {
        send(conn, { type: "join-error", reason: "duplicate-nick", message: "這個暱稱已有人使用，請換一個。" });
        try { conn.close(); } catch (e) {}
        return;
      }
      mp.conns[conn.peer] = conn;
      const player = { id: conn.peer, nick: wanted, isHost: false };
      mp.players.push(player);
      send(conn, {
        type: "welcome",
        playerId: player.id,
        nick: player.nick,
        roomCode: mp.roomCode,
        players: mp.players,
        settings: collectSettings(),
        phase: "lobby"
      });
      broadcast(lobbyPayload(), conn.peer);
      renderPlayers();
      setStatus(player.nick + " 已加入。");
      return;
    }
    if (msg.type === "guess") {
      const pid = conn.peer;
      if (mp.phase !== "playing") return;
      if (msg.index !== state().index) return;
      if (mp.answers[pid] && mp.answers[pid].answered) return;
      const year = Number(msg.year);
      if (!Number.isFinite(year)) return;
      recordAnswer(pid, year);
    }
  }

  function createPeer(id) {
    if (typeof Peer === "undefined") {
      return Promise.reject(new Error("找不到 PeerJS 程式庫，請確認 vendor/peerjs.min.js 與本頁放在同一資料夾。"));
    }
    return new Promise((resolve, reject) => {
      const opts = peerOptions();
      const peer = id ? new Peer(id, opts) : new Peer(opts);
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { peer.destroy(); } catch (e) {}
        reject(new Error("無法在時限內連上配對伺服器，請檢查網路後再試。"));
      }, 15000);
      peer.on("open", (openId) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ peer: peer, id: openId });
      });
      peer.on("error", (err) => {
        if (settled) return;
        const type = err && err.type;
        if (type === "unavailable-id") {
          settled = true;
          clearTimeout(timer);
          try { peer.destroy(); } catch (e) {}
          reject(Object.assign(new Error("unavailable-id"), { type: type }));
          return;
        }
        settled = true;
        clearTimeout(timer);
        try { peer.destroy(); } catch (e) {}
        reject(new Error(peerErrorMessage(type, err)));
      });
    });
  }

  function peerErrorMessage(type, err) {
    if (type === "peer-unavailable" || type === "peerunavailable") return "找不到這個房間，請確認代碼，或請房主重新建立。";
    if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
      return "無法連上配對伺服器，請檢查網路後再試。";
    }
    if (type === "unavailable-id") return "這個房間代碼剛被占用，請再試一次。";
    return (err && err.message) || "連線失敗，請稍後再試。";
  }

  function roomCap() {
    var n = Number(mp.maxPlayers);
    if (Number.isInteger(n) && n >= 2 && n <= MAX_PLAYERS) return n;
    return 4;
  }

  function readMaxPlayers() {
    var n = Number(ui.mpMaxPlayers && ui.mpMaxPlayers.value);
    if (!Number.isInteger(n) || n < 2 || n > MAX_PLAYERS) return 4;
    return n;
  }

  function isPublicChoice() {
    var on = document.querySelector("#mpVisibility .chip.is-on");
    return !on || on.getAttribute("data-vis") !== "private";
  }

  function cleanText(value, max) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function roomSummary() {
    var st = state();
    var regions = st && st.regions ? Array.from(st.regions).join("、") : "";
    var range = $("rangeText") ? $("rangeText").textContent : "";
    return cleanText((regions || "各地") + " · " + (range || ""), 80);
  }

  function publishRoom(status) {
    if (!directory.socket || !directory.socket.alive || !mp.roomCode) return;
    var payload = {
      v: 1,
      code: mp.roomCode,
      nick: cleanText(mp.nick, 16),
      players: mp.players.length,
      max: roomCap(),
      summary: roomSummary(),
      status: status === "closed" ? "closed" : "waiting"
    };
    try { directory.socket.publish(ROOM_TOPIC, JSON.stringify(payload)); } catch (err) {}
  }

  function stopRoomBeats(remove) {
    if (mp.beat) {
      clearInterval(mp.beat);
      mp.beat = 0;
    }
    if (remove) publishRoom("closed");
  }

  function startRoomBeats() {
    stopRoomBeats(false);
    if (!mp.listed || !isHost() || mp.phase !== "lobby" || !mp.roomCode) return;
    ensureBroker();
    publishRoom("waiting");
    mp.beat = setInterval(function () {
      if (!mp.listed || mp.phase !== "lobby") {
        stopRoomBeats(false);
        return;
      }
      publishRoom("waiting");
    }, 5000);
  }

  function acceptRoom(data) {
    if (!data || typeof data !== "object") return;
    var code = cleanText(data.code, 8).toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) return;
    if (data.status === "closed") {
      delete directory.rooms[code];
      renderPublicRooms();
      return;
    }
    if (data.status !== "waiting") return;
    var max = Number(data.max);
    var players = Number(data.players);
    if (!Number.isInteger(max) || max < 2 || max > MAX_PLAYERS) return;
    if (!Number.isInteger(players) || players < 1 || players > max) return;
    var nick = cleanText(data.nick, 16);
    var summary = cleanText(data.summary, 80);
    if (!nick) return;
    directory.rooms[code] = { code: code, nick: nick, players: players, max: max, summary: summary, seen: Date.now() };
    renderPublicRooms();
  }

  function renderPublicRooms() {
    if (!ui.mpPublicLabel || !ui.mpPublicList) return;
    var now = Date.now();
    var rooms = Object.keys(directory.rooms).map(function (key) { return directory.rooms[key]; }).filter(function (room) {
      return now - room.seen < 15000;
    }).sort(function (a, b) { return a.code < b.code ? -1 : 1; });
    var searching = !directory.ok || !rooms.length;
    ui.mpPublicLabel.textContent = searching ? SEARCHING : rooms.length + " 個房間等待中";
    if (ui.mpPublicToggle) ui.mpPublicToggle.classList.toggle("is-searching", searching);
    var hint = $("mpPublicHint");
    if (hint) hint.textContent = directory.open ? "收合" : "點擊展開";
    if (ui.mpPublicEmpty) {
      ui.mpPublicEmpty.hidden = !searching;
      ui.mpPublicEmpty.textContent = SEARCHING;
    }
    ui.mpPublicList.textContent = "";
    if (searching) return;
    rooms.forEach(function (room) {
      var li = document.createElement("li");
      li.className = "public-item";
      var info = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = room.nick + " · " + room.code;
      var meta = document.createElement("p");
      meta.textContent = room.players + " / " + room.max + "　" + room.summary;
      info.appendChild(title);
      info.appendChild(meta);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ghost";
      var full = room.players >= room.max;
      btn.textContent = full ? "已滿" : "加入";
      btn.disabled = full;
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        if (ui.mpCodeInput) ui.mpCodeInput.value = room.code;
        joinRoom(room.code).catch(function () {});
      });
      li.appendChild(info);
      li.appendChild(btn);
      ui.mpPublicList.appendChild(li);
    });
  }

  function ensureBroker() {
    if (directory.socket && directory.socket.alive) return;
    if (directory.connecting) return;
    if (typeof GuessMqtt === "undefined") {
      directory.ok = false;
      renderPublicRooms();
      return;
    }
    directory.ok = false;
    directory.connecting = GuessMqtt.connect(ROOM_BROKER).then(function (socket) {
      directory.socket = socket;
      directory.ok = true;
      directory.connecting = null;
      socket.onMessage = function (topic, text) {
        if (topic !== ROOM_TOPIC) return;
        var data;
        try { data = JSON.parse(text); } catch (err) { return; }
        acceptRoom(data);
      };
      socket.onClose = function () {
        directory.ok = false;
        directory.socket = null;
        renderPublicRooms();
        setTimeout(ensureBroker, 8000);
      };
      socket.subscribe(ROOM_TOPIC);
      renderPublicRooms();
      if (mp.listed && mp.phase === "lobby") publishRoom("waiting");
    }).catch(function () {
      directory.connecting = null;
      directory.ok = false;
      renderPublicRooms();
      setTimeout(ensureBroker, 8000);
    });
  }

  function startSweep() {
    if (directory.sweep) return;
    directory.sweep = setInterval(function () {
      var now = Date.now();
      Object.keys(directory.rooms).forEach(function (key) {
        if (now - directory.rooms[key].seen >= 15000) delete directory.rooms[key];
      });
      renderPublicRooms();
    }, 2000);
  }

  function createRoom(nick) {
    const n = normalizeNick(nick || (ui.mpNick && ui.mpNick.value) || "");
    if (!n) {
      setError("請先填寫暱稱。");
      return Promise.reject(new Error("nick"));
    }
    if (mp.peer) resetRoom("host");
    setError("");
    setStatus("正在建立房間…");
    mp.mode = "host";
    mp.role = "host";
    mp.phase = "connecting";
    mp.nick = n;
    mp.maxPlayers = readMaxPlayers();
    mp.listed = isPublicChoice();
    saveNick(n);
    setMode("host");
    if (ui.mpNick) ui.mpNick.value = n;

    if (relayUrl()) {
      return connectRelaySocket().then((ws) => {
        const code = randomCode();
        const id = peerIdForCode(code);
        mp.relayWs = ws;
        mp.selfId = id;
        mp.roomCode = code;
        mp.peer = { id: id, destroyed: false, destroy: function () { try { ws.close(); } catch (e) {} } };
        mp.phase = "lobby";
        mp.players = [{ id: id, nick: n, isHost: true }];
        ws.onmessage = (ev) => {
          let msg;
          try { msg = JSON.parse(ev.data); } catch (e) { return; }
          if (!msg || !msg.type) return;
          if (msg.type === "error") {
            setError(msg.message || "中繼伺服器傳回錯誤。");
            return;
          }
          if (msg.type === "data" && msg.from) {
            const conn = mp.conns[msg.from] || makeRelayConn(msg.from);
            onHostMessage(conn, msg.data);
          }
          if (msg.type === "peer-leave" && msg.id) onGuestDisconnected(msg.id);
        };
        ws.onclose = () => {
          if (mp.relayWs === ws && mp.phase !== "idle") {
            setError("與中繼伺服器的連線中斷。");
          }
        };
        ws.send(JSON.stringify({ type: "host", room: code, id: id }));
        showRoomUi();
        setStatus("房間已建立，把代碼傳給朋友即可加入。");
        setError("");
        startRoomBeats();
        return code;
      }).catch((err) => {
        mp.listed = false;
        mp.phase = "idle";
        setError(err.message || "無法建立房間。");
        setStatus("");
        throw err;
      });
    }

    function attempt(triesLeft) {
      const code = randomCode();
      const id = peerIdForCode(code);
      return createPeer(id).then((res) => {
        mp.peer = res.peer;
        mp.selfId = res.id;
        mp.roomCode = code;
        mp.phase = "lobby";
        mp.players = [{ id: mp.selfId, nick: n, isHost: true }];
        mp.peer.on("connection", (conn) => {
          conn.on("open", () => attachHostConnection(conn));
          if (conn.open) attachHostConnection(conn);
        });
        mp.peer.on("disconnected", () => {
          if (mp.peer && !mp.peer.destroyed) {
            try { mp.peer.reconnect(); } catch (e) {}
          }
        });
        mp.peer.on("error", (err) => {
          if (err && err.type === "network") setError("與配對伺服器的連線不穩，正在嘗試恢復…");
        });
        showRoomUi();
        setStatus("房間已建立，把代碼傳給朋友即可加入。");
        setError("");
        startRoomBeats();
        return code;
      }).catch((err) => {
        if (err && err.type === "unavailable-id" && triesLeft > 0) return attempt(triesLeft - 1);
        mp.listed = false;
        mp.phase = "idle";
        setError(err.message || "無法建立房間。");
        setStatus("");
        throw err;
      });
    }
    return attempt(6);
  }

  function joinRoom(code, nick) {
    const n = normalizeNick(nick || (ui.mpNick && ui.mpNick.value) || "");
    const c = normalizeCode(code || (ui.mpCodeInput && ui.mpCodeInput.value) || "");
    if (!n) {
      setError("請先填寫暱稱。");
      return Promise.reject(new Error("nick"));
    }
    if (c.length < 4) {
      setError("請輸入完整的房間代碼。");
      return Promise.reject(new Error("code"));
    }
    if (mp.peer) resetRoom("join");
    setError("");
    setStatus("正在加入房間…");
    mp.mode = "join";
    mp.role = "guest";
    mp.phase = "connecting";
    mp.nick = n;
    mp.roomCode = c;
    saveNick(n);
    setMode("join");
    if (ui.mpNick) ui.mpNick.value = n;
    if (ui.mpCodeInput) ui.mpCodeInput.value = c;

    if (relayUrl()) {
      return connectRelaySocket().then((ws) => {
        const id = "g-" + randomCode() + String(now()).slice(-4);
        mp.relayWs = ws;
        mp.selfId = id;
        mp.peer = { id: id, destroyed: false, destroy: function () { try { ws.close(); } catch (e) {} } };
        return new Promise((resolve, reject) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error("連線逾時，請確認代碼與網路，或請房主重新建立房間。"));
            }
          }, 10000);
          const fail = (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err instanceof Error ? err : new Error(String(err)));
          };
          ws.onmessage = (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (!msg || !msg.type) return;
            if (msg.type === "error") {
              fail(new Error(msg.message || "無法加入房間。"));
              return;
            }
            if (msg.type === "ok" && !mp.hostConn) {
              const conn = {
                peer: peerIdForCode(c),
                open: true,
                send: function (payload) {
                  if (!mp.relayWs || mp.relayWs.readyState !== 1) return;
                  let data = payload;
                  if (typeof payload === "string") {
                    try { data = JSON.parse(payload); } catch (e) {}
                  }
                  mp.relayWs.send(JSON.stringify({ type: "data", data: data }));
                },
                close: function () {}
              };
              mp.hostConn = conn;
              send(conn, { type: "hello", nick: n });
              return;
            }
            if (msg.type === "data") {
              const payload = msg.data;
              if (!settled && payload && (payload.type === "welcome" || payload.type === "join-error")) {
                settled = true;
                clearTimeout(timer);
                if (payload.type === "join-error") {
                  fail(new Error(payload.message || "無法加入房間。"));
                  return;
                }
                onGuestMessage(payload);
                resolve(mp.roomCode);
                return;
              }
              onGuestMessage(payload);
            }
            if (msg.type === "host-left" || msg.type === "peer-leave" && mp.phase !== "idle") {
              if (!settled) fail(new Error("找不到這個房間，請確認代碼，或請房主重新建立。"));
              else onHostLost();
            }
          };
          ws.onclose = () => {
            if (!settled) fail(new Error("與中繼伺服器的連線中斷。"));
            else if (mp.phase !== "idle") onHostLost();
          };
          ws.send(JSON.stringify({ type: "join", room: c, id: id }));
        });
      }).then((room) => {
        showRoomUi();
        setStatus("已加入房間，等待房主開始遊戲。");
        setError("");
        return room;
      }).catch((err) => {
        destroyPeer();
        mp.phase = "idle";
        setError(err.message || "無法加入房間。");
        setStatus("");
        if (ui.mpConnectBox) ui.mpConnectBox.hidden = false;
        throw err;
      });
    }

    return createPeer().then((res) => {
      mp.peer = res.peer;
      mp.selfId = res.id;
      return new Promise((resolve, reject) => {
        const conn = mp.peer.connect(peerIdForCode(c), { reliable: true });
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("連線逾時，請確認代碼與網路，或請房主重新建立房間。"));
        }, 15000);
        const fail = (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(peerErrorMessage(err && err.type, err)));
        };
        conn.on("open", () => {
          mp.hostConn = conn;
          send(conn, { type: "hello", nick: n });
        });
        conn.on("data", (data) => {
          const msg = parseMsg(data);
          if (!msg) return;
          if (!settled && (msg.type === "welcome" || msg.type === "join-error")) {
            settled = true;
            clearTimeout(timer);
            if (msg.type === "join-error") {
              fail(new Error(msg.message || "無法加入房間。"));
              return;
            }
            onGuestMessage(msg);
            resolve(mp.roomCode);
            return;
          }
          onGuestMessage(msg);
        });
        conn.on("close", () => {
          if (!settled) {
            fail(new Error("找不到這個房間，請確認代碼，或請房主重新建立。"));
            return;
          }
          if (mp.phase === "idle") return;
          onHostLost();
        });
        conn.on("error", (err) => {
          if (!settled) fail(err);
          else onHostLost();
        });
        mp.peer.on("error", (err) => {
          if (!settled) fail(err);
        });
      });
    }).then((room) => {
      showRoomUi();
      setStatus("已加入房間，等待房主開始遊戲。");
      setError("");
      return room;
    }).catch((err) => {
      destroyPeer();
      mp.phase = "idle";
      setError(err.message || "無法加入房間。");
      setStatus("");
      if (ui.mpConnectBox) ui.mpConnectBox.hidden = false;
      throw err;
    });
  }

  function onGuestMessage(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "welcome" || msg.type === "lobby" || msg.type === "return-lobby") {
      if (msg.playerId) mp.selfId = msg.playerId;
      if (msg.nick) mp.nick = msg.nick;
      if (msg.roomCode) mp.roomCode = msg.roomCode;
      if (msg.players) mp.players = msg.players;
      if (msg.settings) applySettings(msg.settings);
      mp.phase = msg.phase === "playing" || msg.phase === "reveal" || msg.phase === "result" ? msg.phase : "lobby";
      if (mp.phase === "lobby") {
        Y().showScreen("start");
        showRoomUi();
        setStatus("已加入房間，等待房主開始遊戲。");
      }
      renderPlayers();
      return;
    }
    if (msg.type === "settings") {
      applySettings(msg.settings);
      return;
    }
    if (msg.type === "question") {
      beginGuestRound(msg);
      return;
    }
    if (msg.type === "answer-status") {
      renderAnswerStatus(msg.answered, msg.waiting, msg.endsAt);
      if (msg.endsAt) mp.endsAt = msg.endsAt;
      return;
    }
    if (msg.type === "reveal") {
      showGuestReveal(msg);
      return;
    }
    if (msg.type === "final") {
      showGuestFinal(msg);
      return;
    }
    if (msg.type === "host-left") {
      onHostLost(msg.message || "房主已離開，連線中斷。");
    }
  }

  function onHostLost(message) {
    const text = message || "房主已離開，連線中斷。";
    const stay = mp.mode;
    resetRoom(stay === "join" ? "join" : "solo");
    Y().showScreen("start");
    setError(text);
    setStatus("");
  }

  function onSettingsChanged() {
    if (!isHost() || mp.phase !== "lobby") return;
    broadcast({ type: "settings", settings: collectSettings() });
  }

  function startMatch() {
    if (!isHost() || !mp.peer) {
      setError("請先建立房間。");
      return true;
    }
    if (mp.phase !== "lobby" && mp.phase !== "result") {
      return true;
    }
    const st = state();
    st.showMap = !!(ui.showMap && ui.showMap.checked);
    st.curriculumOnly = !!(ui.curriculumOnly && ui.curriculumOnly.checked);
    const pool = Y().filteredEvents();
    if (pool.length < st.rounds) {
      Y().updateMatchCount();
      setError("符合的事件少於 " + st.rounds + " 則，請放寬條件或改選較少回合。");
      return true;
    }
    setError("");
    st.pool = pool;
    st.queue = Y().pickBalancedQueue(pool, st.rounds);
    st.index = 0;
    st.score = 0;
    st.streak = 0;
    st.bestStreak = 0;
    st.history = [];
    st.revealed = false;
    mp.started = true;
    mp.players.forEach((p) => {
      p.score = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.exacts = 0;
      p.history = [];
    });
    Y().ensureScheme();
    hostBeginRound();
    return true;
  }

  function quizPayload(event, index, endsAt) {
    const st = state();
    return {
      type: "question",
      index: index,
      total: st.rounds,
      start: st.start,
      end: st.end,
      showMap: st.showMap,
      schemeId: st.schemeId,
      timeLimit: mp.timeLimit,
      endsAt: endsAt,
      category: event.category,
      region: event.region,
      quizTitle: event.quizTitle || "",
      quizText: event.quizText || "",
      quizLocation: event.quizLocation || event.location || "",
      lat: event.lat,
      lng: event.lng
    };
  }

  function hostBeginRound() {
    stopRoomBeats(true);
    const st = state();
    const event = st.queue[st.index];
    mp.phase = "playing";
    mp.answers = {};
    mp.players.forEach((p) => {
      mp.answers[p.id] = { id: p.id, nick: p.nick, answered: false, guess: null };
    });
    mp.endsAt = mp.timeLimit ? now() + mp.timeLimit * 1000 : 0;
    Y().showScreen("play");
    Y().enterPlayRound(event);
    broadcast(quizPayload(event, st.index, mp.endsAt));
    broadcastAnswerStatus();
    startTimer(mp.endsAt);
  }

  function beginGuestRound(q) {
    const st = state();
    st.start = q.start;
    st.end = q.end;
    st.rounds = q.total;
    st.index = q.index;
    st.showMap = !!q.showMap;
    st.schemeId = q.schemeId || st.schemeId;
    st.revealed = false;
    st.current = {
      quizTitle: q.quizTitle,
      quizText: q.quizText,
      quizLocation: q.quizLocation,
      category: q.category,
      region: q.region,
      lat: q.lat,
      lng: q.lng
    };
    mp.phase = "playing";
    mp.endsAt = q.endsAt || 0;
    mp.lastReveal = null;
    Y().ensureScheme();
    Y().showScreen("play");
    Y().enterPlayRound(st.current);
    startTimer(mp.endsAt);
    if (ui.mpWaitHint) ui.mpWaitHint.hidden = true;
  }

  function recordAnswer(playerId, year) {
    const st = state();
    if (mp.phase !== "playing") return;
    const slot = mp.answers[playerId];
    if (!slot || slot.answered) return;
    const clamped = Math.min(st.end, Math.max(st.start, Math.round(year)));
    slot.answered = true;
    slot.guess = clamped;
    broadcastAnswerStatus();
    renderAnswerStatusFromLocal();
    if (playerId === mp.selfId) lockGuessInput("已提交，等待其他玩家…");
    maybeEndRound();
  }

  function lockGuessInput(msg) {
    if (Y().els.submitBtn) Y().els.submitBtn.disabled = true;
    if (msg) setPlayHint(msg);
  }

  function setPlayHint(msg) {
    if (ui.mpAnswerStatus && msg) {
      /* status list already visible */
    }
  }

  function livePlayers() {
    return mp.players.slice();
  }

  function maybeEndRound() {
    if (!isHost() || mp.phase !== "playing") return;
    const living = livePlayers();
    const allIn = living.every((p) => mp.answers[p.id] && mp.answers[p.id].answered);
    const timedOut = mp.endsAt && now() >= mp.endsAt;
    if (allIn || timedOut) hostReveal();
  }

  function broadcastAnswerStatus() {
    const answered = [];
    const waiting = [];
    livePlayers().forEach((p) => {
      const a = mp.answers[p.id];
      const row = { id: p.id, nick: p.nick };
      if (a && a.answered) answered.push(row);
      else waiting.push(row);
    });
    const msg = { type: "answer-status", index: state().index, answered: answered, waiting: waiting, endsAt: mp.endsAt };
    broadcast(msg);
    renderAnswerStatus(answered, waiting, mp.endsAt);
  }

  function renderAnswerStatusFromLocal() {
    const answered = [];
    const waiting = [];
    livePlayers().forEach((p) => {
      const a = mp.answers[p.id];
      if (a && a.answered) answered.push({ id: p.id, nick: p.nick });
      else waiting.push({ id: p.id, nick: p.nick });
    });
    renderAnswerStatus(answered, waiting, mp.endsAt);
  }

  function renderAnswerStatus(answered, waiting, endsAt) {
    if (!ui.mpAnswerStatus || !ui.mpAnswerList) return;
    ui.mpAnswerStatus.hidden = false;
    ui.mpAnswerList.innerHTML = "";
    (answered || []).forEach((p) => {
      const li = document.createElement("li");
      li.className = "done" + (p.id === mp.selfId ? " self" : "");
      li.textContent = p.nick + " 已作答";
      ui.mpAnswerList.appendChild(li);
    });
    (waiting || []).forEach((p) => {
      const li = document.createElement("li");
      if (p.id === mp.selfId) li.className = "self";
      li.textContent = p.nick + " 作答中";
      ui.mpAnswerList.appendChild(li);
    });
    if (endsAt) mp.endsAt = endsAt;
    updateTimerLabel();
  }

  function startTimer(endsAt) {
    stopTimer();
    mp.endsAt = endsAt || 0;
    if (ui.mpTimerWrap) ui.mpTimerWrap.hidden = !mp.endsAt;
    if (!mp.endsAt) return;
    updateTimerLabel();
    mp.tickId = setInterval(updateTimerLabel, 200);
    if (isHost()) {
      const remain = Math.max(0, mp.endsAt - now());
      mp.timerId = setTimeout(() => maybeEndRound(), remain + 30);
    }
  }

  function stopTimer() {
    if (mp.timerId) { clearTimeout(mp.timerId); mp.timerId = 0; }
    if (mp.tickId) { clearInterval(mp.tickId); mp.tickId = 0; }
  }

  function updateTimerLabel() {
    if (!ui.mpTimer || !ui.mpTimerWrap) return;
    if (!mp.endsAt) {
      ui.mpTimerWrap.hidden = true;
      return;
    }
    ui.mpTimerWrap.hidden = false;
    const remain = Math.max(0, Math.ceil((mp.endsAt - now()) / 1000));
    ui.mpTimer.textContent = remain + " 秒";
    ui.mpTimer.classList.toggle("is-low", remain <= 10);
    if (remain <= 0 && isHost()) maybeEndRound();
  }

  function hostReveal() {
    if (mp.phase !== "playing") return;
    stopTimer();
    const st = state();
    const event = st.queue[st.index];
    const actual = event.year;
    const guesses = livePlayers().map((p, i) => {
      const a = mp.answers[p.id] || {};
      const answered = !!a.answered;
      const guess = answered ? a.guess : null;
      const diff = answered ? Math.abs(guess - actual) : null;
      const points = answered ? Y().scoreForDiff(diff, event, guess) : 0;
      if (answered) {
        p.score = (p.score || 0) + points;
        if (diff === 0) {
          p.streak = (p.streak || 0) + 1;
          p.exacts = (p.exacts || 0) + 1;
          if (p.streak > (p.bestStreak || 0)) p.bestStreak = p.streak;
        } else {
          p.streak = 0;
        }
        p.history = (p.history || []).concat([{
          title: event.title,
          guess: guess,
          actual: actual,
          diff: diff,
          points: points
        }]);
      } else {
        p.streak = 0;
        p.history = (p.history || []).concat([{
          title: event.title,
          guess: null,
          actual: actual,
          diff: null,
          points: 0,
          unanswered: true
        }]);
      }
      return {
        id: p.id,
        nick: p.nick,
        guess: guess,
        points: points,
        diff: diff,
        answered: answered,
        isSelf: p.id === mp.selfId,
        color: playerColor(i)
      };
    });
    const leaderboard = livePlayers()
      .map((p, i) => ({
        id: p.id,
        nick: p.nick,
        score: p.score || 0,
        streak: p.streak || 0,
        bestStreak: p.bestStreak || 0,
        exacts: p.exacts || 0,
        isSelf: p.id === mp.selfId,
        color: playerColor(i)
      }))
      .sort((a, b) => b.score - a.score || b.exacts - a.exacts || a.nick.localeCompare(b.nick, "zh-Hant"));

    const payload = {
      type: "reveal",
      index: st.index,
      total: st.rounds,
      actual: actual,
      official: {
        title: event.title,
        description: event.description,
        location: event.location,
        unit: event.unit || "",
        year: event.year,
        category: event.category,
        region: event.region,
        regions: event.regions || [event.region],
        lat: event.lat,
        lng: event.lng
      },
      guesses: guesses,
      leaderboard: leaderboard
    };
    mp.phase = "reveal";
    mp.lastReveal = payload;
    broadcast(payload);
    applyReveal(payload, true);
  }

  function showGuestReveal(msg) {
    mp.phase = "reveal";
    mp.lastReveal = msg;
    stopTimer();
    applyReveal(msg, false);
  }

  function applyReveal(msg, fromHost) {
    const st = state();
    st.index = msg.index;
    st.rounds = msg.total;
    st.revealed = true;
    const official = msg.official;
    st.current = Object.assign({}, st.current || {}, official, { year: official.year });
    const mine = (msg.guesses || []).find((g) => g.id === mp.selfId) || (msg.guesses || []).find((g) => g.isSelf);
    const guess = mine && mine.answered ? mine.guess : (fromHost && mine ? mine.guess : null);
    const points = mine ? mine.points : 0;
    const diff = mine && mine.answered ? mine.diff : null;
    if (mine && mine.answered) {
      st.score = (msg.leaderboard.find((r) => r.id === mp.selfId) || {}).score || st.score + points;
      st.history.push({
        event: st.current,
        guess: guess,
        actual: official.year,
        diff: diff,
        points: points
      });
      const meBoard = msg.leaderboard.find((r) => r.id === mp.selfId);
      if (meBoard) {
        st.streak = meBoard.streak;
        st.bestStreak = meBoard.bestStreak;
      }
    } else {
      const meBoard = msg.leaderboard.find((r) => r.id === mp.selfId);
      if (meBoard) st.score = meBoard.score;
      st.streak = 0;
      st.history.push({
        event: st.current,
        guess: null,
        actual: official.year,
        diff: null,
        points: 0
      });
    }
    Y().els.liveScore.textContent = Y().formatNumber(st.score);
    Y().els.liveStreak.textContent = String(st.streak || 0);
    Y().els.guessInput.hidden = true;
    Y().els.revealPanel.hidden = false;
    Y().showOfficialPrompt(st.current);
    Y().renderRevealBands();
    const verdict = Y().els.revealVerdict;
    const pts = Y().els.revealPoints;
    if (!mine || !mine.answered) {
      verdict.textContent = "未作答";
      verdict.className = "reveal-verdict";
      pts.innerHTML = "本題 <strong>0</strong> 分";
    } else if (diff === 0) {
      verdict.textContent = "完全正確！";
      verdict.className = "reveal-verdict perfect";
      pts.innerHTML = "相差 0 年 · <strong>" + Y().formatNumber(points) + "</strong> 分";
    } else {
      const late = guess > official.year;
      verdict.textContent = (late ? "晚了 " : "早了 ") + Y().formatNumber(diff) + " 年";
      verdict.className = "reveal-verdict";
      const eraNote = Y().prehistoryEraNote(st.current, guess);
      pts.innerHTML = "正確是 " + Y().formatYear(official.year) +
        (eraNote ? " · " + eraNote : "") +
        " · <strong>" + Y().formatNumber(points) + "</strong> 分";
    }
    const meterPts = mine && mine.answered ? points : 0;
    Y().els.scoreMeterFill.style.width = "0%";
    Y().els.scoreMeterLabel.textContent = "0 / 5,000";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Y().els.scoreMeterFill.style.width = (meterPts / Y().MAX_POINTS) * 100 + "%";
        Y().els.scoreMeterLabel.textContent = Y().formatNumber(meterPts) + " / 5,000";
      });
    });
    const markerGuesses = (msg.guesses || []).map((g, i) => Object.assign({}, g, {
      isSelf: g.id === mp.selfId,
      color: g.color || playerColor(i)
    }));
    Y().placeMultiplayerMarkers(markerGuesses, official.year);
    renderLeaderboard(msg.leaderboard, "目前排名");
    const last = msg.index >= msg.total - 1;
    if (isHost()) {
      if (ui.nextBtn) {
        ui.nextBtn.style.display = "";
        ui.nextBtn.textContent = last ? "查看總結" : "下一題";
        ui.nextBtn.disabled = false;
        ui.nextBtn.focus();
      }
      if (ui.mpWaitHint) ui.mpWaitHint.hidden = true;
    } else {
      if (ui.nextBtn) ui.nextBtn.style.display = "none";
      if (ui.mpWaitHint) {
        ui.mpWaitHint.hidden = false;
        ui.mpWaitHint.textContent = last ? "等待房主公布總成績…" : "等待房主進入下一題…";
      }
    }
  }

  function renderLeaderboard(rows, title) {
    if (!ui.mpLeaderboard) return;
    if (!rows || !rows.length) {
      ui.mpLeaderboard.hidden = true;
      return;
    }
    ui.mpLeaderboard.hidden = false;
    const yg = Y();
    let html = "<h3>" + yg.escapeHtml(title) + "</h3><ol>";
    rows.forEach((r) => {
      html += "<li class='" + (r.id === mp.selfId ? "is-self" : "") + "'>";
      html += "<span>" + yg.escapeHtml(r.nick) + (r.id === mp.selfId ? "（你）" : "") + "</span>";
      html += "<span class='mp-pts'>" + yg.formatNumber(r.score) + " 分</span>";
      html += "<span class='mp-delta'>連對 " + (r.streak || 0) + "</span>";
      html += "</li>";
    });
    html += "</ol>";
    ui.mpLeaderboard.innerHTML = html;
  }

  function renderStandings(msg) {
    if (!ui.mpStandings) return;
    const rows = (msg && msg.standings) || [];
    if (!rows.length) {
      ui.mpStandings.hidden = true;
      return;
    }
    ui.mpStandings.hidden = false;
    const yg = Y();
    let html = "<h2>最終排名</h2><ol>";
    rows.forEach((r, i) => {
      html += "<li class='" + (r.id === mp.selfId ? "is-self" : "") + "'>";
      html += "<span>" + (i + 1) + "　" + yg.escapeHtml(r.nick) + (r.id === mp.selfId ? "（你）" : "") + "</span>";
      html += "<span class='mp-pts'>" + yg.formatNumber(r.score) + " 分</span>";
      html += "<span class='mp-delta'>全對 " + (r.exacts || 0) + "</span>";
      html += "</li>";
    });
    html += "</ol>";
    ui.mpStandings.innerHTML = html;
  }

  function hostFinal() {
    const standings = livePlayers()
      .map((p, i) => ({
        id: p.id,
        nick: p.nick,
        score: p.score || 0,
        exacts: p.exacts || 0,
        bestStreak: p.bestStreak || 0,
        history: p.history || [],
        isSelf: p.id === mp.selfId,
        color: playerColor(i)
      }))
      .sort((a, b) => b.score - a.score || b.exacts - a.exacts || a.nick.localeCompare(b.nick, "zh-Hant"));
    const payload = { type: "final", standings: standings, rounds: state().rounds };
    mp.phase = "result";
    mp.lastFinal = payload;
    mp.lastReveal = null;
    broadcast(payload);
    applyFinal(payload);
  }

  function showGuestFinal(msg) {
    mp.phase = "result";
    mp.lastFinal = msg;
    applyFinal(msg);
  }

  function applyFinal(msg) {
    const mine = (msg.standings || []).find((r) => r.id === mp.selfId);
    const st = state();
    if (mine) {
      st.score = mine.score;
      st.bestStreak = mine.bestStreak;
      if (mine.history && mine.history.length && (!st.history.length || st.history.length < mine.history.length)) {
        st.history = mine.history.map((h) => ({
          event: { title: h.title, year: h.actual },
          guess: h.guess,
          actual: h.actual,
          diff: h.diff == null ? "—" : h.diff,
          points: h.points
        }));
      }
    }
    Y().els.resultRecord.hidden = true;
    if (ui.mpWaitHint) ui.mpWaitHint.hidden = true;
    if (isHost()) {
      if (ui.playAgainBtn) {
        ui.playAgainBtn.disabled = false;
        ui.playAgainBtn.textContent = "再玩一輪";
      }
      if (ui.adjustBtn) ui.adjustBtn.hidden = false;
    } else {
      if (ui.playAgainBtn) {
        ui.playAgainBtn.disabled = true;
        ui.playAgainBtn.textContent = "等待房主再玩一輪";
      }
      if (ui.adjustBtn) ui.adjustBtn.hidden = true;
    }
    renderStandings(msg);
    /* finishGame fills personal table then calls onFinishScreen */
    const alreadyResult = !Y().els.screenResult.hidden;
    if (!alreadyResult) {
      /* Build a compatible history for the personal table */
      if (st.history && st.history.length) {
        st.history = st.history.map((h) => {
          if (h.diff === "—" || h.diff == null) return Object.assign({}, h, { diff: 0, unanswered: true, points: h.points || 0, guess: h.guess == null ? st.start : h.guess });
          return h;
        });
      }
    }
    /* Always show result screen with current personal stats */
    const total = st.score;
    const max = st.rounds * Y().MAX_POINTS;
    const exacts = (mine && mine.exacts) || st.history.filter((h) => h.diff === 0 && h.guess != null).length;
    const answeredRows = st.history.filter((h) => !h.unanswered && h.guess != null);
    const avg = answeredRows.length ? Math.round(answeredRows.reduce((s, h) => s + (h.points || 0), 0) / Math.max(1, st.history.length)) : 0;
    Y().els.resultTotal.textContent = Y().formatNumber(total);
    Y().els.resultMax.textContent = "滿分 " + Y().formatNumber(max);
    Y().els.resultRecord.hidden = true;
    Y().els.resultStreak.textContent = String(st.bestStreak || 0);
    Y().els.resultAverage.textContent = Y().formatNumber(avg);
    Y().els.resultExact.textContent = exacts + " / " + st.rounds;
    Y().els.resultBody.innerHTML = "";
    st.history.forEach((row, i) => {
      const tr = document.createElement("tr");
      const unanswered = row.unanswered || row.guess == null;
      if (!unanswered && row.diff === 0) tr.className = "exact";
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td>" + Y().escapeHtml((row.event && row.event.title) || "") + "</td>" +
        "<td>" + (unanswered ? "未作答" : Y().formatYear(row.guess)) + "</td>" +
        "<td>" + Y().formatYear(row.actual) + "</td>" +
        "<td>" + (unanswered ? "—" : Y().formatNumber(row.diff)) + "</td>" +
        "<td>" + Y().formatNumber(row.points || 0) + "</td>";
      Y().els.resultBody.appendChild(tr);
    });
    Y().showScreen("result");
    renderStandings(msg);
  }

  function returnToLobby() {
    mp.phase = "lobby";
    mp.answers = {};
    mp.lastReveal = null;
    mp.lastFinal = null;
    stopTimer();
    if (ui.mpStandings) ui.mpStandings.hidden = true;
    if (ui.mpLeaderboard) ui.mpLeaderboard.hidden = true;
    if (ui.playAgainBtn) {
      ui.playAgainBtn.disabled = false;
      ui.playAgainBtn.textContent = "再玩一輪";
    }
    if (ui.adjustBtn) ui.adjustBtn.hidden = false;
    Y().showScreen("start");
    showRoomUi();
    setStatus(isHost() ? "可調整設定後再開始下一局。" : "等待房主開始下一局。");
    if (isHost()) broadcast({ type: "return-lobby", players: mp.players, settings: collectSettings(), phase: "lobby" });
    if (isHost()) startRoomBeats();
  }

  function interceptStart() {
    if (mp.mode === "solo") return false;
    if (mp.mode === "join") {
      setError(mp.peer ? "請等待房主開始遊戲。" : "請先加入房間。");
      return true;
    }
    if (mp.mode === "host") {
      if (!mp.peer || mp.phase === "idle" || mp.phase === "connecting") {
        setError("請先建立房間，再開始對戰。");
        return true;
      }
      startMatch();
      return true;
    }
    return false;
  }

  function interceptSubmit() {
    if (!isActive() || (mp.phase !== "playing" && mp.mode === "solo")) return false;
    if (mp.phase !== "playing") return true;
    const year = Y().currentGuessValue();
    if (isHost()) {
      recordAnswer(mp.selfId, year);
      return true;
    }
    if (!mp.hostConn) return true;
    send(mp.hostConn, { type: "guess", index: state().index, year: year });
    /* Optimistic lock */
    lockGuessInput("已提交，等待其他玩家…");
    if (ui.mpAnswerList) {
      /* mark self as submitted visually */
      const existing = mp.players.map((p) => ({ id: p.id, nick: p.nick }));
      const answered = existing.filter((p) => p.id === mp.selfId);
      const waiting = existing.filter((p) => p.id !== mp.selfId);
      /* keep previous answered if listed */
      const lis = ui.mpAnswerList.querySelectorAll("li.done");
      const already = new Set();
      lis.forEach((li) => already.add(li.textContent.replace(" 已作答", "")));
      const ans = mp.players.filter((p) => p.id === mp.selfId || already.has(p.nick)).map((p) => ({ id: p.id, nick: p.nick }));
      const wait = mp.players.filter((p) => !ans.some((a) => a.id === p.id)).map((p) => ({ id: p.id, nick: p.nick }));
      renderAnswerStatus(ans, wait, mp.endsAt);
    }
    return true;
  }

  function interceptNext() {
    if (!isActive() || (mp.phase !== "reveal" && mp.phase !== "result")) {
      if (mp.mode === "solo") return false;
    }
    if (!isHost()) return true;
    if (mp.phase !== "reveal") return true;
    const st = state();
    if (st.index >= st.rounds - 1) {
      hostFinal();
      return true;
    }
    st.index += 1;
    hostBeginRound();
    return true;
  }

  function interceptQuit() {
    if (!isActive() || mp.phase === "idle") return false;
    if (isHost()) {
      if (mp.phase === "playing" || mp.phase === "reveal") {
        if (mp.phase === "playing") hostReveal();
        if (state().index >= state().rounds - 1 || (state().history && state().history.length)) {
          hostFinal();
          return true;
        }
      }
      broadcast({ type: "host-left", message: "房主已結束房間。" });
      leaveRoom();
      return true;
    }
    leaveRoom();
    return true;
  }

  function interceptAdjust() {
    if (!isActive()) return false;
    if (isHost()) {
      returnToLobby();
      return true;
    }
    return true;
  }

  function onEnterPlayRound() {
    if (!isActive()) {
      if (ui.mpAnswerStatus) ui.mpAnswerStatus.hidden = true;
      if (ui.mpTimerWrap) ui.mpTimerWrap.hidden = true;
      if (ui.mpLeaderboard) ui.mpLeaderboard.hidden = true;
      return;
    }
    if (ui.mpLeaderboard) ui.mpLeaderboard.hidden = true;
    if (mp.phase === "playing") renderAnswerStatusFromLocal();
  }

  function onFinishScreen() {
    if (!isActive()) {
      if (ui.mpStandings) ui.mpStandings.hidden = true;
      return;
    }
    if (mp.lastFinal) renderStandings(mp.lastFinal);
    if (isHost()) {
      if (ui.playAgainBtn) {
        ui.playAgainBtn.disabled = false;
        ui.playAgainBtn.textContent = "再玩一輪";
      }
    } else {
      if (ui.playAgainBtn) {
        ui.playAgainBtn.disabled = true;
        ui.playAgainBtn.textContent = "等待房主再玩一輪";
      }
    }
  }

  function relayoutMarkers() {
    if (!isActive() || !mp.lastReveal || mp.phase !== "reveal") return false;
    const msg = mp.lastReveal;
    const guesses = (msg.guesses || []).map((g, i) => Object.assign({}, g, {
      isSelf: g.id === mp.selfId,
      color: g.color || playerColor(i)
    }));
    Y().placeMultiplayerMarkers(guesses, msg.actual);
    return true;
  }

  function leaveRoom() {
    if (isHost() && mp.peer) {
      broadcast({ type: "host-left", message: "房主已離開，連線中斷。" });
    }
    const mode = mp.mode;
    resetRoom(mode === "join" || mode === "host" ? mode : "solo");
    Y().showScreen("start");
    setStatus("");
  }

  function copyCode() {
    const code = mp.roomCode;
    if (!code) return;
    const done = () => setStatus("已複製房間代碼 " + code + "。");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
    } else {
      fallbackCopy(code, done);
    }
  }

  function fallbackCopy(code, done) {
    try {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch (e) {
      setStatus("請手動複製代碼：" + code);
    }
  }

  function bind() {
    ui.mpPanel = $("mpPanel");
    ui.mpConnectBox = $("mpConnectBox");
    ui.mpNick = $("mpNick");
    ui.mpCodeField = $("mpCodeField");
    ui.mpCodeInput = $("mpCodeInput");
    ui.mpConnectBtn = $("mpConnectBtn");
    ui.mpMaxPlayers = $("mpMaxPlayers");
    ui.mpPublic = $("mpPublic");
    ui.mpPublicToggle = $("mpPublicToggle");
    ui.mpPublicBody = $("mpPublicBody");
    ui.mpPublicLabel = $("mpPublicLabel");
    ui.mpPublicEmpty = $("mpPublicEmpty");
    ui.mpPublicList = $("mpPublicList");
    ui.mpRoom = $("mpRoom");
    ui.mpCodeDisplay = $("mpCodeDisplay");
    ui.mpCopyBtn = $("mpCopyBtn");
    ui.mpLeaveBtn = $("mpLeaveBtn");
    ui.mpStatus = $("mpStatus");
    ui.mpPlayerList = $("mpPlayerList");
    ui.mpPlayerCount = $("mpPlayerCount");
    ui.mpSettingsSummary = $("mpSettingsSummary");
    ui.mpError = $("mpError");
    ui.mpHint = $("mpHint");
    ui.timeLimitGroup = $("timeLimitGroup");
    ui.timeLimitFilters = $("timeLimitFilters");
    ui.showMap = $("showMap");
    ui.curriculumOnly = $("curriculumOnly");
    ui.startBtn = $("startBtn");
    ui.mpAnswerStatus = $("mpAnswerStatus");
    ui.mpAnswerList = $("mpAnswerList");
    ui.mpTimerWrap = $("mpTimerWrap");
    ui.mpTimer = $("mpTimer");
    ui.mpLeaderboard = $("mpLeaderboard");
    ui.mpStandings = $("mpStandings");
    ui.mpWaitHint = $("mpWaitHint");
    ui.nextBtn = $("nextBtn");
    ui.playAgainBtn = $("playAgainBtn");
    ui.adjustBtn = $("adjustBtn");

    if (ui.mpNick) ui.mpNick.value = loadNick();
    document.querySelectorAll("#mpVisibility .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#mpVisibility .chip").forEach((other) => {
          const on = other === btn;
          other.classList.toggle("is-on", on);
          other.setAttribute("aria-checked", on ? "true" : "false");
        });
      });
    });
    if (ui.mpPublicToggle) {
      ui.mpPublicToggle.addEventListener("click", () => {
        directory.open = !directory.open;
        ui.mpPublicToggle.setAttribute("aria-expanded", directory.open ? "true" : "false");
        if (ui.mpPublicBody) ui.mpPublicBody.hidden = !directory.open;
        renderPublicRooms();
      });
    }
    window.addEventListener("pagehide", () => {
      if (isHost() && mp.listed && mp.roomCode) publishRoom("closed");
    });

    $("modeSolo") && $("modeSolo").addEventListener("click", () => {
      if (inRoom() && mp.peer) {
        if (!confirm("離開目前房間，改回單人遊玩？")) return;
        leaveRoom();
      }
      resetRoom("solo");
      setMode("solo");
    });
    $("modeHost") && $("modeHost").addEventListener("click", () => {
      if (mp.mode === "join" && mp.peer) {
        if (!confirm("離開目前房間，改為開房間？")) return;
        leaveRoom();
      }
      if (mp.mode !== "host") {
        mp.role = "host";
        setMode("host");
        setError("");
        setStatus(mp.peer ? "" : "填寫暱稱後按「建立房間」，代碼會自動產生。");
      }
    });
    $("modeJoin") && $("modeJoin").addEventListener("click", () => {
      if (mp.mode === "host" && mp.peer) {
        if (!confirm("關閉目前房間，改為加入別人的房間？")) return;
        leaveRoom();
      }
      if (mp.mode !== "join") {
        mp.role = "guest";
        setMode("join");
        setError("");
        setStatus("輸入暱稱與房間代碼後加入。");
      }
    });

    if (ui.mpConnectBtn) {
      ui.mpConnectBtn.addEventListener("click", () => {
        if (mp.mode === "join") joinRoom().catch(() => {});
        else createRoom().catch(() => {});
      });
    }
    if (ui.mpCodeInput) {
      ui.mpCodeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          joinRoom().catch(() => {});
        }
      });
    }
    if (ui.mpNick) {
      ui.mpNick.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (mp.mode === "join") joinRoom().catch(() => {});
          else if (mp.mode === "host") createRoom().catch(() => {});
        }
      });
    }
    if (ui.mpCopyBtn) ui.mpCopyBtn.addEventListener("click", copyCode);
    if (ui.mpLeaveBtn) ui.mpLeaveBtn.addEventListener("click", () => leaveRoom());

    renderTimeLimitChips();

    window.addEventListener("beforeunload", () => {
      if (isHost() && mp.peer) broadcast({ type: "host-left", message: "房主已離開，連線中斷。" });
      destroyPeer();
    });
  }

  window.YearGuessMp = {
    isActive: function () {
      return mp.mode !== "solo" && !!mp.peer && mp.phase !== "idle";
    },
    isHost: isHost,
    interceptStart: interceptStart,
    interceptSubmit: interceptSubmit,
    interceptNext: interceptNext,
    interceptQuit: interceptQuit,
    interceptAdjust: interceptAdjust,
    onSettingsChanged: onSettingsChanged,
    onEnterPlayRound: onEnterPlayRound,
    onFinishScreen: onFinishScreen,
    relayoutMarkers: relayoutMarkers,
    createRoom: createRoom,
    joinRoom: joinRoom,
    startMatch: startMatch,
    leaveRoom: leaveRoom,
    setTimeLimit: function (s) {
      mp.timeLimit = TIME_OPTIONS.indexOf(s) >= 0 ? s : (s ? Number(s) : 0);
      renderTimeLimitChips();
      onSettingsChanged();
    },
    getRoomState: function () {
      return {
        mode: mp.mode,
        phase: mp.phase,
        role: mp.role,
        roomCode: mp.roomCode,
        selfId: mp.selfId,
        nick: mp.nick,
        timeLimit: mp.timeLimit,
        players: mp.players.slice(),
        answers: mp.answers,
        endsAt: mp.endsAt,
        lastReveal: mp.lastReveal,
        lastFinal: mp.lastFinal
      };
    },
    PEER_PREFIX: PEER_PREFIX
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
