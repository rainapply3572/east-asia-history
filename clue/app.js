(function () {
  "use strict";

  var REGIONS = ["中國", "日本", "朝鮮半島", "臺灣", "蒙古", "越南"];
  var POINTS = [5000, 4000, 3000, 2000, 1000];
  var CLUE_TITLES = ["地區與大約的世紀", "準確年份", "地圖上的位置", "相關的人或關鍵詞", "遮住關鍵詞的敘述"];
  var STORAGE_KEY = "eastAsiaClue.bestScores";

  var state = {
    regions: new Set(REGIONS),
    presetId: "all",
    start: -1046,
    end: 1999,
    rounds: 5,
    curriculumOnly: false,
    hard: false,
    queue: [],
    index: 0,
    score: 0,
    clueIndex: 0,
    options: [],
    tried: {},
    locked: false,
    revealed: false,
    history: [],
    dataMin: -1046,
    dataMax: 1999
  };

  var map = null;
  var marker = null;

  function $(id) { return document.getElementById(id); }

  function events() {
    return Array.isArray(window.EVENTS) ? window.EVENTS : [];
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function formatYear(year) {
    var n = Number(year);
    if (!Number.isFinite(n)) return "—";
    if (n < 0) return "西元前 " + Math.abs(n) + " 年";
    if (n === 0) return "西元前後";
    return "西元 " + n + " 年";
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("zh-Hant-TW");
  }

  function centuryText(year) {
    var n = Number(year);
    if (!Number.isFinite(n) || n === 0) return "西元前後";
    if (n < 0) return "西元前 " + Math.ceil(Math.abs(n) / 100) + " 世紀前後";
    return Math.ceil(n / 100) + " 世紀前後";
  }

  function bounds() {
    var min = -1046;
    var max = 1999;
    events().forEach(function (event) {
      if (!Number.isFinite(event.year)) return;
      if (event.year < min) min = event.year;
      if (event.year > max) max = event.year;
    });
    return { min: min, max: max };
  }

  function presets() {
    return [
      { id: "all", label: "全時期", start: state.dataMin, end: state.dataMax },
      { id: "ancient", label: "古代", start: state.dataMin, end: 589 },
      { id: "medieval", label: "中古", start: 590, end: 1367 },
      { id: "earlyModern", label: "近世", start: 1368, end: 1839 },
      { id: "modern", label: "近現代", start: 1840, end: state.dataMax }
    ];
  }

  function pool() {
    return events().filter(function (event) {
      if (!event || !event.title || !Number.isFinite(event.year)) return false;
      if (event.year < state.start || event.year > state.end) return false;
      if (!state.regions.has(event.region)) return false;
      if (state.curriculumOnly && !event.curriculum) return false;
      return true;
    });
  }

  function settingsKey() {
    return [
      state.rounds,
      Array.from(state.regions).sort().join(","),
      state.start,
      state.end,
      state.curriculumOnly ? "1" : "0",
      state.hard ? "1" : "0"
    ].join("|");
  }

  function readBests() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch (err) { return {}; }
  }

  function bestScore() {
    var row = readBests()[settingsKey()];
    return row && Number.isFinite(row.score) ? row.score : null;
  }

  function saveBest(score) {
    try {
      var all = readBests();
      var prev = all[settingsKey()];
      var record = !prev || score > prev.score;
      if (record) all[settingsKey()] = { score: score, at: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return record;
    } catch (err) {
      return false;
    }
  }

  function show(id) {
    ["screenStart", "screenPlay", "screenResult"].forEach(function (name) {
      $(name).hidden = name !== id;
    });
  }

  function chip(label, on, onClick, radio) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = label;
    btn.setAttribute(radio ? "aria-checked" : "aria-pressed", on ? "true" : "false");
    if (radio) btn.setAttribute("role", "radio");
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderRegions() {
    var box = $("regionFilters");
    box.innerHTML = "";
    REGIONS.forEach(function (region) {
      box.appendChild(chip(region, state.regions.has(region), function () {
        if (state.regions.has(region)) {
          if (state.regions.size === 1) return;
          state.regions.delete(region);
        } else {
          state.regions.add(region);
        }
        renderRegions();
        refreshSetup();
      }));
    });
  }

  function renderPresets() {
    var box = $("presetFilters");
    box.innerHTML = "";
    presets().forEach(function (preset) {
      box.appendChild(chip(preset.label, state.presetId === preset.id, function () {
        state.presetId = preset.id;
        state.start = preset.start;
        state.end = preset.end;
        renderPresets();
        refreshSetup();
      }, true));
    });
  }

  function renderRounds() {
    var box = $("roundFilters");
    box.innerHTML = "";
    [5, 10].forEach(function (n) {
      box.appendChild(chip(n + " 題", state.rounds === n, function () {
        state.rounds = n;
        renderRounds();
        refreshSetup();
      }, true));
    });
  }

  function refreshSetup() {
    $("yearStart").value = String(state.start);
    $("yearEnd").value = String(state.end);
    $("rangeText").textContent = formatYear(state.start) + " 至 " + formatYear(state.end);
    var n = pool().length;
    $("matchCount").innerHTML = "符合事件：<strong>" + n + "</strong> 則";
    var best = bestScore();
    $("bestHint").textContent = best == null ? "" : "此設定的本機最高分：" + formatNumber(best);
    var error = "";
    if (n < state.rounds) error = "符合的事件少於回合數，請放寬地區、年代，或關閉「僅課內題」。";
    else if (!state.hard && n < 4) error = "選擇題至少需要 4 則事件。可以改開困難模式，或放寬範圍。";
    $("setupError").hidden = !error;
    $("setupError").textContent = error;
    $("startBtn").disabled = !!error;
  }

  function readCustomYears() {
    var a = Number($("yearStart").value);
    var b = Number($("yearEnd").value);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    if (a > b) {
      var t = a;
      a = b;
      b = t;
    }
    state.start = clamp(a, state.dataMin, state.dataMax);
    state.end = clamp(b, state.dataMin, state.dataMax);
    var match = presets().find(function (preset) {
      return preset.start === state.start && preset.end === state.end;
    });
    state.presetId = match ? match.id : "custom";
    renderPresets();
    refreshSetup();
  }

  function cluesFor(event) {
    var extra = (window.CLUES && window.CLUES[event.id]) || {};
    var keyword = extra.keyword || "（這題沒有另外的關鍵詞）";
    var masked = extra.masked || event.quizText || event.description || event.title;
    return [
      { kind: "text", text: "這件事發生在" + (event.region || "東亞") + "，大約在" + centuryText(event.year) + "。" },
      { kind: "text", text: "準確年份是" + formatYear(event.year) + "。" },
      { kind: "map", text: "地點就在這枚地圖釘上，圖上沒有寫地名。", lat: Number(event.lat), lng: Number(event.lng) },
      { kind: "text", text: "相關的人或關鍵詞：" + keyword },
      { kind: "text", text: masked }
    ];
  }

  function distractors(answer, source) {
    var rest = source.filter(function (event) { return event.id !== answer.id; });
    var windows = [80, 200, 500, 5000];
    var chosen = [];
    function take(list) {
      shuffle(list).forEach(function (event) {
        if (chosen.length >= 3) return;
        if (!chosen.some(function (item) { return item.id === event.id; })) chosen.push(event);
      });
    }
    windows.forEach(function (span) {
      if (chosen.length >= 3) return;
      take(rest.filter(function (event) {
        return event.region === answer.region && Math.abs(event.year - answer.year) <= span;
      }));
    });
    if (chosen.length < 3) take(rest.filter(function (event) { return event.region === answer.region; }));
    if (chosen.length < 3) take(rest);
    return chosen.slice(0, 3);
  }

  function ensureMap(lat, lng) {
    var slot = $("mapSlot");
    slot.hidden = false;
    if (typeof L === "undefined" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      slot.hidden = true;
      return;
    }
    if (!map) {
      map = L.map("clueMap", { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: "&copy; Esri"
      }).addTo(map);
      marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          html: '<div class="pin"></div>'
        })
      }).addTo(map);
    }
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], 6, { animate: false });
    setTimeout(function () { if (map) map.invalidateSize(); }, 60);
  }

  function hideMap() {
    $("mapSlot").hidden = true;
  }

  function currentEvent() {
    return state.queue[state.index];
  }

  function renderClue() {
    var event = currentEvent();
    var clues = cluesFor(event);
    var clue = clues[state.clueIndex];
    $("clueKicker").textContent = "第 " + (state.clueIndex + 1) + " / " + clues.length + " 條線索";
    $("clueTitle").textContent = CLUE_TITLES[state.clueIndex];
    $("clueText").textContent = clue.text;
    $("pointsLeft").textContent = "此刻猜中可得 " + formatNumber(POINTS[state.clueIndex]) + " 分";
    $("roundLabel").textContent = (state.index + 1) + " / " + state.rounds;
    $("liveScore").textContent = formatNumber(state.score);
    if (clue.kind === "map") ensureMap(clue.lat, clue.lng);
    else hideMap();
    $("clueCard").hidden = false;
    $("revealCard").hidden = true;
    $("choiceBox").hidden = state.hard;
    $("searchBox").hidden = !state.hard;
    $("searchError").hidden = true;
    if (state.hard) {
      $("searchInput").value = "";
      $("suggestList").hidden = true;
      $("searchInput").focus();
    }
  }

  function renderChoices() {
    var box = $("choices");
    box.innerHTML = "";
    state.options.forEach(function (event) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.textContent = event.quizTitle || event.title;
      btn.addEventListener("click", function () { guess(event.id, btn); });
      box.appendChild(btn);
    });
  }

  function guess(id, button) {
    if (state.locked || state.revealed || state.tried[id]) return;
    var event = currentEvent();
    if (id === event.id) {
      state.locked = true;
      if (button) button.classList.add("is-right");
      finishRound(true);
      return;
    }
    state.tried[id] = true;
    if (button) {
      button.classList.add("is-wrong");
      button.disabled = true;
    }
    if (state.clueIndex >= POINTS.length - 1) {
      state.locked = true;
      finishRound(false);
      return;
    }
    state.clueIndex += 1;
    state.locked = true;
    setTimeout(function () {
      state.locked = false;
      renderClue();
    }, 280);
  }

  function finishRound(correct) {
    state.revealed = true;
    state.locked = true;
    var event = currentEvent();
    var used = state.clueIndex + 1;
    var points = correct ? POINTS[state.clueIndex] : 0;
    state.score += points;
    state.history.push({
      id: event.id,
      title: event.title,
      correct: correct,
      clues: used,
      points: points
    });
    $("liveScore").textContent = formatNumber(state.score);
    $("clueCard").hidden = true;
    $("choiceBox").hidden = true;
    $("searchBox").hidden = true;
    $("revealCard").hidden = false;
    $("revealVerdict").textContent = correct ? "猜中了" : "線索用完了";
    $("revealTitle").textContent = event.title;
    $("revealMeta").textContent = formatYear(event.year) + "　" + (event.location || "") + "　" + (event.region || "");
    $("revealDesc").textContent = event.description || event.quizText || "";
    $("revealPoints").textContent = correct
      ? "用了 " + used + " 條線索，得到 " + formatNumber(points) + " 分"
      : "本題 0 分";
    $("nextBtn").textContent = state.index + 1 >= state.rounds ? "看結算" : "下一題";
    $("revealMapSlot").appendChild($("mapSlot"));
    ensureMap(Number(event.lat), Number(event.lng));
  }

  function nextRound() {
    if (state.index + 1 >= state.rounds) {
      showResult();
      return;
    }
    state.index += 1;
    beginRound();
  }

  function beginRound() {
    var event = currentEvent();
    state.clueIndex = 0;
    state.locked = false;
    state.revealed = false;
    state.tried = {};
    state.options = shuffle([event].concat(distractors(event, pool())));
    $("clueCard").appendChild($("mapSlot"));
    hideMap();
    renderClue();
    renderChoices();
  }

  function startGame() {
    var source = shuffle(pool());
    state.queue = source.slice(0, state.rounds);
    state.index = 0;
    state.score = 0;
    state.history = [];
    show("screenPlay");
    beginRound();
  }

  function emojiFor(entry) {
    if (!entry.correct) return "⬛";
    if (entry.clues <= 2) return "🟩";
    if (entry.clues <= 4) return "🟨";
    return "🟥";
  }

  function shareText() {
    var icons = state.history.map(emojiFor).join("");
    return "線索猜事件 " + state.rounds + " 題\n" + icons + "\n" + formatNumber(state.score) + " 分";
  }

  function showResult() {
    var max = state.rounds * POINTS[0];
    var record = saveBest(state.score);
    $("resultScore").textContent = formatNumber(state.score);
    $("resultMax").textContent = "滿分 " + formatNumber(max);
    $("resultRecord").hidden = false;
    $("resultRecord").textContent = record ? "新紀錄！已寫入這組設定的本機最高分" : ("本機最高分：" + formatNumber(bestScore() || state.score));
    $("shareEmojis").textContent = state.history.map(emojiFor).join("");
    $("shareText").textContent = shareText();
    $("copyHint").textContent = "";
    var list = $("resultList");
    list.innerHTML = "";
    state.history.forEach(function (entry) {
      var li = document.createElement("li");
      li.textContent = emojiFor(entry) + " " + entry.title + "　" + (entry.correct ? entry.clues + " 條線索，" + formatNumber(entry.points) + " 分" : "未猜中");
      list.appendChild(li);
    });
    show("screenResult");
  }

  function searchMatches(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return events().filter(function (event) {
      return (event.title || "").toLowerCase().indexOf(q) !== -1 ||
        (event.quizTitle || "").toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8);
  }

  function renderSuggest(query) {
    var list = $("suggestList");
    var matches = searchMatches(query);
    list.innerHTML = "";
    if (!matches.length) {
      list.hidden = true;
      return;
    }
    matches.forEach(function (event) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = event.title;
      btn.addEventListener("click", function () { guess(event.id, null); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    list.hidden = false;
  }

  function bind() {
    renderRegions();
    renderPresets();
    renderRounds();
    refreshSetup();
    $("yearStart").addEventListener("change", readCustomYears);
    $("yearEnd").addEventListener("change", readCustomYears);
    $("curriculumOnly").addEventListener("change", function () {
      state.curriculumOnly = $("curriculumOnly").checked;
      refreshSetup();
    });
    $("hardMode").addEventListener("change", function () {
      state.hard = $("hardMode").checked;
      refreshSetup();
    });
    $("setupForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if ($("startBtn").disabled) return;
      startGame();
    });
    $("quitBtn").addEventListener("click", function () {
      if (state.history.length) showResult();
      else show("screenStart");
    });
    $("nextBtn").addEventListener("click", nextRound);
    $("againBtn").addEventListener("click", startGame);
    $("backBtn").addEventListener("click", function () { show("screenStart"); refreshSetup(); });
    $("searchInput").addEventListener("input", function () { renderSuggest($("searchInput").value); });
    $("copyBtn").addEventListener("click", function () {
      var text = shareText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          $("copyHint").textContent = "已複製，貼到聊天或社群即可。內容不含事件名稱。";
        }).catch(function () {
          $("copyHint").textContent = "無法自動複製，請自行選取上方文字。";
        });
      } else {
        $("copyHint").textContent = "請自行選取上方文字。";
      }
    });
  }

  function init() {
    if (!events().length) {
      $("matchCount").textContent = "找不到題目。請確認與猜年遊戲放在同一個網站裡。";
      $("startBtn").disabled = true;
      return;
    }
    var span = bounds();
    state.dataMin = span.min;
    state.dataMax = span.max;
    state.start = span.min;
    state.end = span.max;
    bind();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
