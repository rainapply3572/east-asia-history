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
    end: 2020,
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
    dataMax: 2020
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
    var max = 2020;
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
    else if (!state.hard && n < 6) error = "選擇題至少需要 6 則事件。可以改開困難模式，或放寬範圍。";
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

  var NEIGHBORS = {
    "中國": { "蒙古": 1, "朝鮮半島": 1, "越南": 1, "臺灣": 1, "日本": 1 },
    "日本": { "朝鮮半島": 1, "臺灣": 1, "中國": 1 },
    "朝鮮半島": { "中國": 1, "日本": 1, "蒙古": 1 },
    "臺灣": { "中國": 1, "日本": 1, "越南": 1 },
    "蒙古": { "中國": 1, "朝鮮半島": 1 },
    "越南": { "中國": 1, "臺灣": 1, "日本": 1 }
  };

  var PLACE_WORDS = {
    "北京": 1, "南京": 1, "上海": 1, "長安": 1, "洛陽": 1, "開封": 1, "杭州": 1, "廣州": 1,
    "成都": 1, "泉州": 1, "福州": 1, "廈門": 1, "天津": 1, "瀋陽": 1, "漢城": 1, "首爾": 1,
    "平壤": 1, "江戶": 1, "鎌倉": 1, "奈良": 1, "京都": 1, "東京": 1, "大阪": 1, "香港": 1,
    "澳門": 1, "西貢": 1, "河內": 1, "順化": 1, "平城": 1, "洛邑": 1, "鎬京": 1, "建康": 1,
    "大都": 1, "大興": 1, "大興城": 1, "蒙古": 1, "越南": 1, "日本": 1, "中國": 1, "臺灣": 1,
    "台灣": 1, "朝鮮": 1, "中原": 1, "華北": 1, "江南": 1, "關中": 1, "西域": 1, "東北": 1,
    "西南": 1, "東南": 1, "都城": 1, "首都": 1, "京師": 1, "國號": 1, "年號": 1, "朝廷": 1,
    "皇帝": 1, "國王": 1, "天皇": 1, "將軍": 1, "王朝": 1, "政權": 1, "幕府": 1, "佛教": 1,
    "儒家": 1, "科舉": 1, "條約": 1, "戰爭": 1, "改革": 1, "維新": 1, "明治": 1, "大正": 1,
    "昭和": 1, "平成": 1, "康熙": 1, "乾隆": 1, "洪武": 1, "永樂": 1, "開元": 1, "貞觀": 1
  };

  function yearBand(year) {
    if (year < -1000) return { min: 40, max: 500, slice: 120 };
    if (year < 200) return { min: 20, max: 260, slice: 70 };
    if (year < 600) return { min: 18, max: 200, slice: 55 };
    if (year < 1400) return { min: 15, max: 150, slice: 40 };
    if (year < 1840) return { min: 12, max: 110, slice: 32 };
    return { min: 10, max: 80, slice: 24 };
  }

  function centuryOf(year) {
    var n = Number(year);
    if (!Number.isFinite(n) || n === 0) return 0;
    if (n < 0) return -Math.ceil(Math.abs(n) / 100);
    return Math.ceil(n / 100);
  }

  function plainText(value) {
    return String(value || "").replace(/[^\u3400-\u9fff]/g, "");
  }

  function clueKeyword(event) {
    var extra = (window.CLUES && window.CLUES[event.id]) || {};
    return plainText(extra.keyword).replace(/[採接納受把將與在的了是為於及並]$/, "");
  }

  function personKey(event) {
    var key = clueKeyword(event);
    if (key.length < 2 || PLACE_WORDS[key]) return "";
    if (/^今/.test(key) || /[城京都港府州縣]$/.test(key)) return "";
    return key.slice(0, 3);
  }

  function coreTitle(event) {
    var text = plainText(event && event.title);
    [
      "朝鮮民主主義人民共和國", "中華人民共和國", "蒙古人民共和國", "中華民國", "大韓民國", "大韓帝國",
      "第一次", "第二次", "第三次", "第四次",
      "邦交正常化", "主權移交", "宣布獨立", "開始實施", "爆發", "簽訂"
    ].forEach(function (word) {
      text = text.split(word).join("");
    });
    return text;
  }

  function longestShared(a, b) {
    var best = "";
    if (!a || !b) return best;
    for (var i = 0; i < a.length; i++) {
      for (var len = a.length - i; len >= 3 && len > best.length; len--) {
        var slice = a.slice(i, i + len);
        if (b.indexOf(slice) !== -1) {
          best = slice;
          break;
        }
      }
    }
    return best;
  }

  function titlesTooAlike(a, b) {
    var ta = plainText(a.quizTitle || a.title);
    var tb = plainText(b.quizTitle || b.title);
    if (!ta || !tb) return false;
    if (ta === tb) return true;
    var shorter = ta.length < tb.length ? ta : tb;
    var longer = ta.length < tb.length ? tb : ta;
    if (shorter.length >= 4 && longer.indexOf(shorter) !== -1) return true;
    var shared = longestShared(ta, tb);
    return shared.length >= 6 && shared.length / shorter.length >= 0.72;
  }

  function sameTopic(a, b) {
    var ka = personKey(a);
    var kb = personKey(b);
    if (ka && kb && (ka === kb || ka.indexOf(kb) === 0 || kb.indexOf(ka) === 0)) return true;
    var ta = plainText(a.title) + plainText(a.quizTitle);
    var tb = plainText(b.title) + plainText(b.quizTitle);
    if (ka && tb.indexOf(ka) !== -1) return true;
    if (kb && ta.indexOf(kb) !== -1) return true;
    var shared = longestShared(coreTitle(a), coreTitle(b));
    return shared.length >= 3 && !PLACE_WORDS[shared];
  }

  function regionTier(origin, region) {
    if (region === origin) return 0;
    if (NEIGHBORS[origin] && NEIGHBORS[origin][region]) return 1;
    return 2;
  }

  function spreadChoices(list, answer, band, slots, already) {
    if (slots <= 0 || !list.length) return [];
    var picked = [];
    var used = {};
    function pickedAll() { return already.concat(picked); }
    function yearGap(event) {
      var gap = Infinity;
      pickedAll().forEach(function (item) {
        gap = Math.min(gap, Math.abs(item.year - event.year));
      });
      return gap === Infinity ? Math.abs(Math.abs(event.year - answer.year) - ((band.min + band.max) / 2)) : gap;
    }
    function crowded(event) {
      return pickedAll().filter(function (item) {
        return Math.abs(item.year - event.year) <= band.slice;
      }).length;
    }
    function neighborCount() {
      return pickedAll().filter(function (item) { return item.region !== answer.region; }).length;
    }
    var guard = 0;
    while (picked.length < slots && guard < list.length + 3) {
      guard += 1;
      var sameLeft = list.some(function (event) {
        return !used[event.id] && event.region === answer.region;
      });
      var roomier = list.some(function (event) {
        return !used[event.id] && crowded(event) < 2;
      });
      var available = list.filter(function (event) {
        if (used[event.id]) return false;
        if (event.region !== answer.region && neighborCount() >= 2 && sameLeft) return false;
        if (crowded(event) >= 2 && roomier) return false;
        return true;
      });
      if (!available.length) break;
      var nearest = available.reduce(function (min, event) {
        return Math.min(min, Math.abs(event.year - answer.year));
      }, Infinity);
      if (nearest > band.max) {
        available.sort(function (a, b) {
          var tier = regionTier(answer.region, a.region) - regionTier(answer.region, b.region);
          if (tier) return tier;
          return Math.abs(a.year - answer.year) - Math.abs(b.year - answer.year);
        });
        var nextSparse = available[0];
        used[nextSparse.id] = true;
        picked.push(nextSparse);
        continue;
      }
      var mid = (band.min + band.max) / 2;
      available.sort(function (a, b) {
        var tier = regionTier(answer.region, a.region) - regionTier(answer.region, b.region);
        if (tier) return tier;
        var century = Math.abs(centuryOf(a.year) - centuryOf(answer.year)) - Math.abs(centuryOf(b.year) - centuryOf(answer.year));
        if (century) return century;
        var da = Math.abs(Math.abs(a.year - answer.year) - mid);
        var db = Math.abs(Math.abs(b.year - answer.year) - mid);
        if (Math.abs(da - db) > 12) return da - db;
        return yearGap(b) - yearGap(a);
      });
      var front = available.slice(0, Math.max(1, Math.ceil(available.length / 3)));
      var haveBefore = picked.some(function (item) { return item.year < answer.year; });
      var haveAfter = picked.some(function (item) { return item.year > answer.year; });
      if (haveBefore !== haveAfter) {
        var side = front.filter(function (event) {
          return haveBefore ? event.year > answer.year : event.year < answer.year;
        });
        if (side.length) front = side;
      }
      front.sort(function (a, b) { return yearGap(b) - yearGap(a); });
      var next = front[Math.floor(Math.random() * Math.min(2, front.length))];
      used[next.id] = true;
      picked.push(next);
    }
    return picked;
  }

  function distractors(answer, source) {
    var need = 5;
    var band = yearBand(answer.year);
    var rest = source.filter(function (event) {
      return event && event.id !== answer.id && event.title && Number.isFinite(event.year);
    });
    var chosen = [];

    function take(limits) {
      if (chosen.length >= need) return;
      var list = rest.filter(function (event) {
        if (chosen.some(function (item) { return item.id === event.id; })) return false;
        var diff = Math.abs(event.year - answer.year);
        if (diff < limits.min) return false;
        if (limits.max && diff > limits.max) return false;
        if (regionTier(answer.region, event.region) > limits.tier) return false;
        if (limits.century != null && Math.abs(centuryOf(event.year) - centuryOf(answer.year)) > limits.century) return false;
        if (titlesTooAlike(answer, event)) return false;
        if (limits.topic !== false && sameTopic(answer, event)) return false;
        if (chosen.some(function (item) {
          return titlesTooAlike(item, event) || (limits.topic !== false && sameTopic(item, event));
        })) return false;
        return true;
      });
      spreadChoices(list, answer, band, need - chosen.length, chosen).forEach(function (event) {
        chosen.push(event);
      });
    }

    take({ min: band.min, max: band.max, tier: 1, century: 1, topic: true });
    if (chosen.length < need) take({ min: band.min, max: Math.round(band.max * 2), tier: 1, century: 2, topic: true });
    if (chosen.length < need) take({ min: band.min, max: 0, tier: 1, century: null, topic: true });
    if (chosen.length < need) take({ min: Math.max(8, band.min - 4), max: 0, tier: 2, century: null, topic: true });
    if (chosen.length < need) take({ min: 1, max: 0, tier: 2, century: null, topic: false });
    rest.slice().sort(function (a, b) {
      var tier = regionTier(answer.region, a.region) - regionTier(answer.region, b.region);
      if (tier) return tier;
      return Math.abs(a.year - answer.year) - Math.abs(b.year - answer.year);
    }).forEach(function (event) {
      if (chosen.length >= need) return;
      if (!chosen.some(function (item) { return item.id === event.id; })) chosen.push(event);
    });
    return chosen.slice(0, need);
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
      if (state.tried[event.id]) {
        btn.disabled = true;
        btn.classList.add("is-wrong");
        btn.setAttribute("aria-disabled", "true");
      }
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
