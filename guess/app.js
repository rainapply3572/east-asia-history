(function () {
  "use strict";

  const REGIONS = ["中國", "日本", "朝鮮半島", "臺灣", "蒙古", "越南"];
  const CATEGORIES = ["政治", "戰爭", "文化", "外交", "宗教", "科技", "經濟", "社會"];
  const ROUND_OPTIONS = [5, 10, 20];
  const MAX_POINTS = 5000;
  const SCORE_TAU_RATIO = 0.08;
  const STORAGE_KEY = "eastAsiaYearGuess.bestScores";
  const FALLBACK_MIN = -1046;
  const FALLBACK_MAX = 1999;
  const yearSpan = (Array.isArray(window.EVENTS) ? window.EVENTS : []).reduce((span, event) => {
    if (!event || !Number.isFinite(event.year)) return span;
    if (event.year < span.min) span.min = event.year;
    if (event.year > span.max) span.max = event.year;
    return span;
  }, { min: FALLBACK_MIN, max: FALLBACK_MAX });
  const DATA_MIN = yearSpan.min;
  const DATA_MAX = yearSpan.max;

  const PRESETS = [
    { id: "all", label: "全時期", start: DATA_MIN, end: DATA_MAX },
    { id: "ancient", label: "古代", start: DATA_MIN, end: 589 },
    { id: "medieval", label: "中古", start: 590, end: 1367 },
    { id: "earlyModern", label: "近世", start: 1368, end: 1839 },
    { id: "modern", label: "近現代", start: 1840, end: DATA_MAX },
    { id: "custom", label: "自訂", start: null, end: null }
  ];

  const els = {
    screenStart: document.getElementById("screenStart"),
    screenPlay: document.getElementById("screenPlay"),
    screenResult: document.getElementById("screenResult"),
    regionFilters: document.getElementById("regionFilters"),
    categoryFilters: document.getElementById("categoryFilters"),
    presetFilters: document.getElementById("presetFilters"),
    roundFilters: document.getElementById("roundFilters"),
    rangeSlider: document.getElementById("rangeSlider"),
    rangeStart: document.getElementById("rangeStart"),
    rangeEnd: document.getElementById("rangeEnd"),
    rangeThumbStart: document.getElementById("rangeThumbStart"),
    rangeThumbEnd: document.getElementById("rangeThumbEnd"),
    setupTrack: document.getElementById("setupTrack"),
    rangeText: document.getElementById("rangeText"),
    setupPeriodBands: document.getElementById("setupPeriodBands"),
    setupSchemeSwitch: document.getElementById("setupSchemeSwitch"),
    setupSchemeRow: document.getElementById("setupSchemeRow"),
    setupPeriodCaption: document.getElementById("setupPeriodCaption"),
    rangeDimLeft: document.getElementById("rangeDimLeft"),
    rangeDimRight: document.getElementById("rangeDimRight"),
    showMap: document.getElementById("showMap"),
    curriculumOnly: document.getElementById("curriculumOnly"),
    matchCount: document.getElementById("matchCount"),
    bestHint: document.getElementById("bestHint"),
    setupError: document.getElementById("setupError"),
    startBtn: document.getElementById("startBtn"),
    setupForm: document.getElementById("setupForm"),
    playBody: document.getElementById("playBody"),
    mapCard: document.getElementById("mapCard"),
    eventCategory: document.getElementById("eventCategory"),
    eventRegion: document.getElementById("eventRegion"),
    eventTitle: document.getElementById("eventTitle"),
    eventUnit: document.getElementById("eventUnit"),
    eventLocation: document.getElementById("eventLocation"),
    eventDesc: document.getElementById("eventDesc"),
    roundLabel: document.getElementById("roundLabel"),
    liveScore: document.getElementById("liveScore"),
    liveStreak: document.getElementById("liveStreak"),
    quitBtn: document.getElementById("quitBtn"),
    guessInput: document.getElementById("guessInput"),
    guessSliderWrap: document.getElementById("guessSliderWrap"),
    guessSlider: document.getElementById("guessSlider"),
    guessThumb: document.getElementById("guessThumb"),
    guessTrack: document.getElementById("guessTrack"),
    guessNumber: document.getElementById("guessNumber"),
    guessPeriodBands: document.getElementById("guessPeriodBands"),
    guessSchemeSwitch: document.getElementById("guessSchemeSwitch"),
    guessSchemeRow: document.getElementById("guessSchemeRow"),
    revealPeriodBands: document.getElementById("revealPeriodBands"),
    guessText: document.getElementById("guessText"),
    bceToggle: document.getElementById("bceToggle"),
    bceToggleLabel: document.getElementById("bceToggleLabel"),
    submitBtn: document.getElementById("submitBtn"),
    revealPanel: document.getElementById("revealPanel"),
    revealVerdict: document.getElementById("revealVerdict"),
    revealPoints: document.getElementById("revealPoints"),
    compareGap: document.getElementById("compareGap"),
    markerGuess: document.getElementById("markerGuess"),
    markerActual: document.getElementById("markerActual"),
    markerGuessYear: document.getElementById("markerGuessYear"),
    markerActualYear: document.getElementById("markerActualYear"),
    compareStart: document.getElementById("compareStart"),
    compareEnd: document.getElementById("compareEnd"),
    scoreMeterFill: document.getElementById("scoreMeterFill"),
    scoreMeterLabel: document.getElementById("scoreMeterLabel"),
    nextBtn: document.getElementById("nextBtn"),
    resultTotal: document.getElementById("resultTotal"),
    resultMax: document.getElementById("resultMax"),
    resultRecord: document.getElementById("resultRecord"),
    resultStreak: document.getElementById("resultStreak"),
    resultAverage: document.getElementById("resultAverage"),
    resultExact: document.getElementById("resultExact"),
    resultBody: document.getElementById("resultBody"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    adjustBtn: document.getElementById("adjustBtn")
  };

  const state = {
    regions: new Set(REGIONS),
    categories: new Set(CATEGORIES),
    presetId: "all",
    start: DATA_MIN,
    end: DATA_MAX,
    rounds: 10,
    showMap: true,
    curriculumOnly: false,
    pool: [],
    queue: [],
    index: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    revealed: false,
    current: null,
    guess: 1000,
    history: [],
    map: null,
    marker: null,
    tileIndex: 0,
    tileLayer: null,
    schemeId: "中國",
    schemeUserPicked: false
  };

  const TILE_SOURCES = [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, HERE, Garmin, USGS et al.'
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, HERE, Garmin, USGS et al.'
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'
    }
  ];

  function allEvents() {
    return Array.isArray(window.EVENTS) ? window.EVENTS : [];
  }

  function formatYear(year) {
    const n = Number(year);
    if (!Number.isFinite(n)) return "—";
    if (n < 0) return "西元前 " + Math.abs(n) + " 年";
    return "西元 " + n + " 年";
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("zh-Hant-TW");
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  const THUMB_SIZE = 18;
  const AXIS_INSET = THUMB_SIZE / 2;

  function axisWidth(el) {
    return el ? el.getBoundingClientRect().width : 0;
  }

  function yearToX(year, start, end, width, inset) {
    if (inset == null) inset = AXIS_INSET;
    const span = Math.max(1, end - start);
    const usable = Math.max(0, width - 2 * inset);
    return inset + ((Number(year) - start) / span) * usable;
  }

  function xToYear(x, start, end, width, inset) {
    if (inset == null) inset = AXIS_INSET;
    const span = Math.max(1, end - start);
    const usable = Math.max(0, width - 2 * inset);
    const t = usable === 0 ? 0 : (x - inset) / usable;
    return clamp(Math.round(start + t * span), start, end);
  }

  function yearToPct(year, start, end) {
    const span = Math.max(1, end - start);
    return ((year - start) / span) * 100;
  }

  /* 隱藏會直接洩漏年分的數字，年號與朝代名予以保留。 */
  function scrubYearMentions(text) {
    if (!text) return "";
    let s = String(text);
    s = s.replace(/(西元前|公元前)\s*\d{1,4}(?:\s*[–—−\-〜~至到]\s*\d{1,4})?\s*年?/g, "$1某年");
    s = s.replace(/(西元|公元)(?!前)\s*\d{1,4}(?:\s*[–—−\-〜~至到]\s*\d{1,4})?\s*年?/g, "$1某年");
    s = s.replace(/[（(]\s*\d{2,4}\s*[–—−\-〜~至到]\s*\d{2,4}\s*年?\s*[）)]/g, "");
    s = s.replace(/\d{3,4}\s*[–—−\-〜~至到]\s*\d{3,4}\s*年?/g, "某年");
    s = s.replace(/\d{1,4}\s*年/g, "某年");
    s = s.replace(/(?<![\d.])\d{3,4}(?![\d.])/g, "某年");
    s = s.replace(/某年\s*某年/g, "某年");
    s = s.replace(/[（(]\s*[）)]/g, "");
    s = s.replace(/\s{2,}/g, " ");
    s = s.replace(/\s+([，。；、）】])/g, "$1");
    s = s.replace(/（約\s*/g, "（約");
    return s.trim();
  }

  function eventRegions(event) {
    if (Array.isArray(event.regions) && event.regions.length) return event.regions;
    return event.region ? [event.region] : [];
  }

  function eventPrimaryRegion(event) {
    return event.region || (Array.isArray(event.regions) && event.regions[0]) || "";
  }

  function matchesFilters(event, regions, categories, start, end, curriculumOnly) {
    if (event.year < start || event.year > end) return false;
    const primary = eventPrimaryRegion(event);
    if (!regions.has(primary)) return false;
    if (categories.size && !categories.has(event.category)) return false;
    const only = curriculumOnly === undefined ? state.curriculumOnly : curriculumOnly;
    if (only && !event.curriculum) return false;
    return true;
  }

  function filteredEvents() {
    return allEvents().filter((e) =>
      matchesFilters(e, state.regions, state.categories, state.start, state.end)
    );
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function spanYears() {
    return Math.max(1, state.end - state.start);
  }

  function scoreForDiff(diff) {
    if (diff === 0) return MAX_POINTS;
    const tau = spanYears() * SCORE_TAU_RATIO;
    return Math.round(MAX_POINTS * Math.exp(-diff / tau));
  }

  function settingsKey() {
    const regions = [...state.regions].sort().join(",");
    const cats =
      state.categories.size === 0 || state.categories.size === CATEGORIES.length
        ? "all"
        : [...state.categories].sort().join(",");
    return [regions, state.start, state.end, cats, state.rounds, state.curriculumOnly ? "curric" : "allq"].join("|");
  }

  function loadBestMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function getBest() {
    const map = loadBestMap();
    return map[settingsKey()] || null;
  }

  function saveBest(score) {
    const map = loadBestMap();
    const key = settingsKey();
    const prev = map[key];
    if (prev && prev.score >= score) return false;
    map[key] = { score: score, at: Date.now(), rounds: state.rounds };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (err) {
      /* file:// 極少數環境可能停用 localStorage，忽略即可 */
    }
    return true;
  }

  function makeChip(label, pressed, onToggle, role) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = label;
    btn.setAttribute(role === "radio" ? "aria-checked" : "aria-pressed", pressed ? "true" : "false");
    if (role) btn.setAttribute("role", role);
    btn.addEventListener("click", onToggle);
    return btn;
  }

  function renderRegionChips() {
    els.regionFilters.innerHTML = "";
    REGIONS.forEach((region) => {
      els.regionFilters.appendChild(
        makeChip(region, state.regions.has(region), () => {
          if (state.regions.has(region)) {
            if (state.regions.size === 1) return;
            state.regions.delete(region);
          } else {
            state.regions.add(region);
          }
          renderRegionChips();
          updateMatchCount();
        })
      );
    });
  }

  function renderCategoryChips() {
    els.categoryFilters.innerHTML = "";
    const allOn = state.categories.size === CATEGORIES.length;
    const allBtn = makeChip("全部", allOn, () => {
      if (allOn) return;
      state.categories = new Set(CATEGORIES);
      renderCategoryChips();
      updateMatchCount();
    });
    els.categoryFilters.appendChild(allBtn);
    CATEGORIES.forEach((cat) => {
      els.categoryFilters.appendChild(
        makeChip(cat, state.categories.has(cat), () => {
          if (state.categories.has(cat)) {
            if (state.categories.size === 1) return;
            state.categories.delete(cat);
          } else {
            state.categories.add(cat);
          }
          renderCategoryChips();
          updateMatchCount();
        })
      );
    });
  }

  function applyPreset(id, fromSlider) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (preset.id !== "custom") {
      state.start = preset.start;
      state.end = preset.end;
      els.rangeStart.value = String(preset.start);
      els.rangeEnd.value = String(preset.end);
    }
    if (!fromSlider) state.presetId = preset.id;
    renderPresetChips();
    updateRangeUi();
    updateMatchCount();
  }

  function renderPresetChips() {
    els.presetFilters.innerHTML = "";
    PRESETS.forEach((preset) => {
      els.presetFilters.appendChild(
        makeChip(preset.label, state.presetId === preset.id, () => applyPreset(preset.id), "radio")
      );
    });
  }

  function renderRoundChips() {
    els.roundFilters.innerHTML = "";
    ROUND_OPTIONS.forEach((n) => {
      els.roundFilters.appendChild(
        makeChip(String(n) + " 題", state.rounds === n, () => {
          state.rounds = n;
          renderRoundChips();
          updateMatchCount();
        }, "radio")
      );
    });
  }

  function syncRangeFromSliders() {
    let a = Number(els.rangeStart.value);
    let b = Number(els.rangeEnd.value);
    if (a > b) {
      const t = a;
      a = b;
      b = t;
      els.rangeStart.value = String(a);
      els.rangeEnd.value = String(b);
    }
    state.start = a;
    state.end = b;
    const match = PRESETS.find((p) => p.id !== "custom" && p.start === a && p.end === b);
    state.presetId = match ? match.id : "custom";
    renderPresetChips();
    updateRangeUi();
    updateMatchCount();
  }

  function updateRangeUi() {
    els.rangeText.textContent = formatYear(state.start) + " 至 " + formatYear(state.end);
    els.rangeStart.value = String(state.start);
    els.rangeEnd.value = String(state.end);
    positionRangeThumbs();
    renderSetupBands();
  }

  function positionRangeThumbs() {
    const wrap = els.rangeSlider;
    if (!wrap) return;
    const width = axisWidth(wrap);
    const x0 = yearToX(state.start, DATA_MIN, DATA_MAX, width);
    const x1 = yearToX(state.end, DATA_MIN, DATA_MAX, width);
    if (els.rangeThumbStart) els.rangeThumbStart.style.left = x0 + "px";
    if (els.rangeThumbEnd) els.rangeThumbEnd.style.left = x1 + "px";
    if (els.rangeDimLeft) {
      els.rangeDimLeft.style.left = "0px";
      els.rangeDimLeft.style.width = x0 + "px";
    }
    if (els.rangeDimRight) {
      els.rangeDimRight.style.left = x1 + "px";
      els.rangeDimRight.style.width = Math.max(0, width - x1) + "px";
      els.rangeDimRight.style.right = "auto";
    }
  }

  function updateMatchCount() {
    if (window.YearGuessMp) YearGuessMp.onSettingsChanged();
    const pool = filteredEvents();
    const n = pool.length;
    els.matchCount.innerHTML = "符合事件：<strong>" + n + "</strong> 則";
    const best = getBest();
    if (best) {
      els.bestHint.textContent = "此設定的本機最高分：" + formatNumber(best.score);
    } else {
      els.bestHint.textContent = "";
    }
    renderSchemeSwitch(els.setupSchemeSwitch);
    renderSetupBands();
    if (n < state.rounds) {
      els.setupError.hidden = false;
      els.setupError.textContent = "符合的事件少於 " + state.rounds + " 則，請放寬地區、年代或類型" + (state.curriculumOnly ? "，或暫時關閉「僅課內題」" : "") + "，或改選較少回合。";
      els.startBtn.disabled = true;
    } else {
      els.setupError.hidden = true;
      els.setupError.textContent = "";
      els.startBtn.disabled = false;
    }
  }

  function showScreen(name) {
    els.screenStart.hidden = name !== "start";
    els.screenPlay.hidden = name !== "play";
    els.screenResult.hidden = name !== "result";
  }

  function setGuess(year, fromNumber) {
    let y = clamp(Math.round(Number(year) || 0), state.start, state.end);
    state.guess = y;
    els.guessSlider.min = String(state.start);
    els.guessSlider.max = String(state.end);
    els.guessSlider.value = String(y);
    if (!fromNumber) els.bceToggle.checked = y < 0;
    if (els.bceToggle.checked) {
      els.guessNumber.value = String(Math.abs(y) || (y === 0 ? 0 : Math.abs(y)));
    } else {
      els.guessNumber.value = String(y);
    }
    els.guessText.textContent = formatYear(currentGuessValue());
    positionGuessThumb();
  }

  function positionGuessThumb() {
    const wrap = els.guessSliderWrap;
    if (!wrap || !els.guessThumb || wrap.offsetParent === null) return;
    const width = axisWidth(wrap);
    const x = yearToX(state.guess, state.start, state.end, width);
    els.guessThumb.style.left = x + "px";
  }

  function currentGuessValue() {
    const raw = Number(els.guessNumber.value);
    const abs = Number.isFinite(raw) ? Math.round(raw) : 0;
    let y = els.bceToggle.checked ? -Math.abs(abs) : abs;
    // 若使用者在數字欄直接輸入負號，視為西元前
    if (!els.bceToggle.checked && raw < 0) y = raw;
    return clamp(y, state.start, state.end);
  }

  function syncGuessFromNumber() {
    const raw = Number(els.guessNumber.value);
    if (!Number.isFinite(raw)) return;
    if (raw < 0) els.bceToggle.checked = true;
    let y = els.bceToggle.checked ? -Math.abs(raw) : raw;
    setGuess(y, true);
  }

  function ensureMap() {
    if (state.map || typeof L === "undefined") return;
    state.map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true
    });
    attachTiles(0);
    state.marker = L.marker([35, 115], {
      icon: L.divIcon({
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: '<div class="marker-dot" style="background:#9e2b1f;width:18px;height:18px"></div>'
      }),
      keyboard: false
    }).addTo(state.map);
    state.map.setView([35, 115], 4);
  }

  function attachTiles(index) {
    if (!state.map) return;
    if (state.tileLayer) state.map.removeLayer(state.tileLayer);
    state.tileIndex = index;
    const source = TILE_SOURCES[index];
    const layer = L.tileLayer(source.url, {
      attribution: source.attribution,
      maxZoom: 18
    });
    layer.on("tileerror", function () {
      if (state.tileIndex === index && index < TILE_SOURCES.length - 1) {
        attachTiles(index + 1);
      }
    });
    layer.addTo(state.map);
    state.tileLayer = layer;
  }

  const REGION_FOCUS = {
    "中國": [35.5, 104],
    "日本": [37, 137.5],
    "朝鮮半島": [37.5, 127.8],
    "臺灣": [23.7, 121],
    "蒙古": [46.5, 103.5],
    "越南": [16.2, 107.2]
  };

  function eventFocus(event) {
    const lat = Number(event && event.lat);
    const lng = Number(event && event.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: lat, lng: lng, exact: true };
    const focus = REGION_FOCUS[event && event.region] || [35, 115];
    return { lat: focus[0], lng: focus[1], exact: false };
  }

  function showEventOnMap(event) {
    if (!state.showMap || !event) return;
    ensureMap();
    if (!state.map || !state.marker) return;
    const pos = eventFocus(event);
    const zoom = pos.exact ? 6 : 4;
    state.map.setView([pos.lat, pos.lng], zoom, { animate: false });
    state.marker.setLatLng([pos.lat, pos.lng]);
    requestAnimationFrame(() => {
      if (!state.map) return;
      state.map.invalidateSize();
      state.map.setView([pos.lat, pos.lng], zoom, { animate: false });
    });
  }


  const REGION_TO_SCHEME = {
    "中國": "中國",
    "日本": "日本",
    "朝鮮半島": "朝鮮",
    "越南": "越南",
    "臺灣": "臺灣",
    "蒙古": "蒙古"
  };

  function periodSchemes() {
    return window.PERIOD_SCHEMES || {};
  }

  function availableSchemeIds() {
    const selected = [];
    state.regions.forEach((r) => {
      const id = REGION_TO_SCHEME[r];
      if (id && selected.indexOf(id) === -1) selected.push(id);
    });
    if (selected.length <= 1) return selected.length ? selected : ["中國"];
    if (selected.indexOf("中國") === -1) return ["中國"].concat(selected);
    return selected;
  }

  function ensureScheme() {
    const avail = availableSchemeIds();
    if (avail.indexOf(state.schemeId) === -1) {
      state.schemeId = avail.indexOf("中國") !== -1 ? "中國" : avail[0];
    }
    if (avail.length > 1 && avail.indexOf("中國") !== -1) {
      /* mixed: default to China unless user already picked a still-valid scheme */
      if (!state.schemeUserPicked) state.schemeId = "中國";
    } else {
      state.schemeId = avail[0];
      state.schemeUserPicked = false;
    }
  }

  function setScheme(id, fromUser) {
    const avail = availableSchemeIds();
    if (avail.indexOf(id) === -1) return;
    state.schemeId = id;
    if (fromUser) state.schemeUserPicked = true;
    renderSchemeSwitch(els.setupSchemeSwitch);
    renderSchemeSwitch(els.guessSchemeSwitch);
    renderSetupBands();
    renderGuessBands();
    renderRevealBands();
  }

  function schemePeriods(schemeId) {
    const scheme = periodSchemes()[schemeId];
    return scheme && Array.isArray(scheme.periods) ? scheme.periods : [];
  }

  function visiblePeriods(schemeId, start, end) {
    return schemePeriods(schemeId).map((p) => {
      const visStart = p.visStart != null ? p.visStart : p.start;
      const visEnd = p.visEnd != null ? p.visEnd : p.end;
      return {
        id: p.id,
        label: p.label,
        short: p.short || p.label,
        color: p.color,
        note: p.note,
        start: p.start,
        end: p.end,
        row: p.row || 0,
        visStart: Math.max(visStart, start),
        visEnd: Math.min(visEnd, end)
      };
    }).filter((p) => p.visEnd > p.visStart && p.visEnd > start && p.visStart < end);
  }

  function periodTitle(p) {
    const span = formatYear(p.start) + " 至 " + formatYear(p.end);
    return p.label + "（" + span + "）" + (p.note ? " " + p.note : "");
  }

  function renderPeriodBands(container, start, end, schemeId) {
    if (!container) return;
    container.innerHTML = "";
    const track = container.parentElement || container;
    const width = axisWidth(track);
    const periods = visiblePeriods(schemeId, start, end);
    const hasOverlap = periods.some((p) => p.row === 1);
    track.classList.toggle("has-overlap", hasOverlap);
    if (track.parentElement && track.parentElement.classList.contains("slider")) {
      track.parentElement.classList.toggle("has-overlap", hasOverlap);
    }
    periods.forEach((p) => {
      const left = yearToX(p.visStart, start, end, width);
      const right = yearToX(p.visEnd, start, end, width);
      const px = Math.max(0, right - left);
      const el = document.createElement("span");
      el.className = "period-band" + (p.row === 1 ? " overlap" : "");
      el.style.left = left + "px";
      el.style.width = px + "px";
      el.style.background = p.color;
      el.title = periodTitle(p);
      el.dataset.start = String(p.start);
      el.dataset.end = String(p.end);
      el.dataset.visStart = String(p.visStart);
      el.dataset.visEnd = String(p.visEnd);
      el.dataset.label = p.label;
      const narrow = width < 560;
      const fullAt = narrow ? 36 : 54;
      const shortAt = narrow ? 18 : 28;
      const charAt = narrow ? 11 : 16;
      if (px >= fullAt) el.textContent = p.label;
      else if (px >= shortAt) el.textContent = p.short;
      else if (px >= charAt) el.textContent = p.short.charAt(0);
      else el.textContent = "";
      container.appendChild(el);
    });
  }

  function renderSetupBands() {
    ensureScheme();
    renderPeriodBands(els.setupPeriodBands, DATA_MIN, DATA_MAX, state.schemeId);
    positionRangeThumbs();
    if (els.setupPeriodCaption) {
      const scheme = periodSchemes()[state.schemeId];
      els.setupPeriodCaption.textContent = scheme ? "色帶：" + scheme.label : "";
    }
    if (els.setupSchemeRow) {
      const avail = availableSchemeIds();
      els.setupSchemeRow.hidden = avail.length <= 1;
    }
  }

  function renderGuessBands() {
    renderPeriodBands(els.guessPeriodBands, state.start, state.end, state.schemeId);
    positionGuessThumb();
    if (els.guessSchemeRow) {
      const avail = availableSchemeIds();
      els.guessSchemeRow.hidden = avail.length <= 1;
    }
  }

  function renderRevealBands() {
    if (!els.revealPeriodBands) return;
    if (els.revealPanel && els.revealPanel.hidden) return;
    renderPeriodBands(els.revealPeriodBands, state.start, state.end, state.schemeId);
  }

  function renderSchemeSwitch(container) {
    if (!container) return;
    const avail = availableSchemeIds();
    ensureScheme();
    container.innerHTML = "";
    if (avail.length <= 1) return;
    avail.forEach((id) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = id;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", state.schemeId === id ? "true" : "false");
      btn.addEventListener("click", () => setScheme(id, true));
      container.appendChild(btn);
    });
  }

  function showQuizPrompt(event) {
    const card = document.getElementById("eventCard");
    if (card) card.classList.remove("revealed");
    els.eventTitle.textContent = event.quizTitle || event.title;
    const loc = event.quizLocation || event.location || "";
    els.eventLocation.textContent = loc;
    els.eventDesc.textContent = event.quizText || event.description || "";
    const yearEl = document.getElementById("eventOfficialYear");
    if (yearEl) yearEl.remove();
    if (els.eventUnit) {
      els.eventUnit.hidden = true;
      els.eventUnit.textContent = "";
    }
  }

  function showOfficialPrompt(event) {
    const card = document.getElementById("eventCard");
    if (card) card.classList.add("revealed");
    els.eventTitle.textContent = event.title;
    const loc = event.location || event.quizLocation || "";
    const regs = eventRegions(event);
    els.eventLocation.textContent = loc + (regs.length ? " · " + regs.join("、") : "");
    els.eventDesc.textContent = event.description || event.quizText || "";
    let yearEl = document.getElementById("eventOfficialYear");
    if (!yearEl) {
      yearEl = document.createElement("p");
      yearEl.id = "eventOfficialYear";
      yearEl.className = "event-original-year";
      els.eventTitle.insertAdjacentElement("afterend", yearEl);
    }
    yearEl.textContent = formatYear(event.year);
    if (els.eventUnit) {
      if (event.unit) {
        els.eventUnit.hidden = false;
        els.eventUnit.textContent = "課內單元：" + event.unit;
      } else {
        els.eventUnit.hidden = true;
        els.eventUnit.textContent = "";
      }
    }
    els.eventRegion.textContent = regs.join("、") || eventPrimaryRegion(event);
  }

  function startGame() {
    if (window.YearGuessMp && YearGuessMp.interceptStart()) return;
    state.showMap = els.showMap.checked;
    state.curriculumOnly = !!(els.curriculumOnly && els.curriculumOnly.checked);
    const pool = filteredEvents();
    if (pool.length < state.rounds) {
      updateMatchCount();
      return;
    }
    state.pool = pool;
    state.queue = shuffle(pool).slice(0, state.rounds);
    state.index = 0;
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.history = [];
    state.revealed = false;
    els.playBody.classList.toggle("no-map", !state.showMap);
    ensureScheme();
    showScreen("play");
    renderRound();
  }

  function renderRound() {
    const event = state.queue[state.index];
    enterPlayRound(event);
  }

  function enterPlayRound(event) {
    state.current = event;
    state.revealed = false;
    els.roundLabel.textContent = (state.index + 1) + " / " + state.rounds;
    els.liveScore.textContent = formatNumber(state.score);
    els.liveStreak.textContent = String(state.streak);
    els.eventCategory.textContent = event.category || "";
    els.eventCategory.style.background = catColor(event.category);
    els.eventRegion.textContent = eventPrimaryRegion(event);
    showQuizPrompt(event);
    els.guessInput.hidden = false;
    els.revealPanel.hidden = true;
    els.submitBtn.disabled = false;
    resetCompareVisuals();
    clearMultiplayerMarkers();
    const mid = Math.round((state.start + state.end) / 2);
    els.bceToggle.checked = mid < 0;
    els.bceToggleLabel.style.display = state.start < 0 ? "" : "none";
    setGuess(mid, false);
    renderGuessBands();
    renderSchemeSwitch(els.guessSchemeSwitch);
    els.playBody.classList.toggle("no-map", !state.showMap);
    if (state.showMap) showEventOnMap(event);
    if (els.guessSlider) els.guessSlider.focus();
    if (window.YearGuessMp) YearGuessMp.onEnterPlayRound();
  }

  function catColor(category) {
    const key = "--cat-" + category;
    const val = getComputedStyle(document.documentElement).getPropertyValue(key);
    return val.trim() || "#1c1814";
  }

  function resetCompareVisuals() {
    els.markerGuess.className = "compare-marker guess";
    els.markerActual.className = "compare-marker actual";
    els.compareGap.style.opacity = "0";
    els.scoreMeterFill.style.width = "0%";
    els.scoreMeterLabel.textContent = "0 / 5,000";
  }

  function submitGuess() {
    if (state.revealed || !state.current) return;
    if (window.YearGuessMp && YearGuessMp.interceptSubmit()) return;
    const guess = currentGuessValue();
    state.guess = guess;
    setGuess(guess, els.bceToggle.checked);
    const actual = state.current.year;
    const diff = Math.abs(guess - actual);
    const points = scoreForDiff(diff);
    state.revealed = true;
    state.score += points;
    if (diff === 0) {
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    } else {
      state.streak = 0;
    }
    state.history.push({
      event: state.current,
      guess: guess,
      actual: actual,
      diff: diff,
      points: points
    });
    els.liveScore.textContent = formatNumber(state.score);
    els.liveStreak.textContent = String(state.streak);
    showReveal(guess, actual, diff, points);
  }


  function placeRevealMarkers(guess, actual, diff) {
    const track = document.getElementById("compareTimeline") && els.revealPeriodBands
      ? els.revealPeriodBands.parentElement
      : null;
    if (!track) return;
    const width = axisWidth(track);
    const gX = yearToX(guess, state.start, state.end, width);
    const aX = yearToX(actual, state.start, state.end, width);
    els.compareStart.textContent = formatYear(state.start);
    els.compareEnd.textContent = formatYear(state.end);
    const startX = yearToX(state.start, state.start, state.end, width);
    const endX = yearToX(state.end, state.start, state.end, width);
    els.compareStart.style.left = startX + "px";
    els.compareEnd.style.left = endX + "px";
    els.compareStart.className = "compare-end start";
    els.compareEnd.className = "compare-end end";
    if (startX < 40) els.compareStart.classList.add("start");
    if (width - endX < 40) els.compareEnd.classList.add("end");
    els.markerGuessYear.textContent = formatYear(guess);
    els.markerActualYear.textContent = formatYear(actual);
    const left = Math.min(gX, aX);
    const gapW = Math.abs(aX - gX);
    els.compareGap.style.left = left + "px";
    els.compareGap.style.width = gapW + "px";
    els.markerGuess.style.left = gX + "px";
    els.markerActual.style.left = aX + "px";
    els.markerGuess.className = "compare-marker guess";
    els.markerActual.className = "compare-marker actual";

    const close = gapW < 72 && diff !== 0;
    const veryClose = gapW < 28 && diff !== 0;
    /* 靠近時把猜測標在軸上方、正確年分標在軸下方，避免「西元前 214西元前 202」黏在一起。 */
    if (diff === 0) {
      els.markerGuess.classList.add("exact", "labels-above");
      els.markerActual.classList.add("exact", "labels-below");
    } else if (close) {
      els.markerGuess.classList.add("labels-above");
      els.markerActual.classList.add("labels-below");
    } else {
      els.markerGuess.classList.add("labels-above");
      els.markerActual.classList.add("labels-above");
    }

    function edgeAlign(el, x) {
      if (x <= 56) el.classList.add("labels-left");
      else if (x >= width - 56) el.classList.add("labels-right");
    }
    if (!veryClose) {
      edgeAlign(els.markerGuess, gX);
      edgeAlign(els.markerActual, aX);
    } else {
      /* 兩點極近且靠近邊緣時，讓較外側的標籤往內對齊，避免出框又互疊 */
      if (Math.min(gX, aX) <= 56) {
        els.markerGuess.classList.add("labels-left");
        els.markerActual.classList.add("labels-left");
      } else if (Math.max(gX, aX) >= width - 56) {
        els.markerGuess.classList.add("labels-right");
        els.markerActual.classList.add("labels-right");
      }
    }

    requestAnimationFrame(() => {
      els.compareGap.style.opacity = diff === 0 ? "0" : "1";
      els.markerGuess.classList.add("show");
      els.markerActual.classList.add("show");
    });
  }


  function clearMultiplayerMarkers() {
    const layer = document.getElementById("mpMarkerLayer");
    if (layer) layer.innerHTML = "";
    const timeline = document.getElementById("compareTimeline");
    if (timeline) timeline.classList.remove("is-mp");
    if (els.markerGuess) els.markerGuess.style.display = "";
    if (els.markerActual) els.markerActual.style.display = "";
  }

  function placeMultiplayerMarkers(guesses, actual) {
    const track = els.revealPeriodBands ? els.revealPeriodBands.parentElement : null;
    const layer = document.getElementById("mpMarkerLayer");
    const timeline = document.getElementById("compareTimeline");
    if (!track || !layer) return;
    layer.innerHTML = "";
    if (timeline) timeline.classList.add("is-mp");
    if (els.markerGuess) els.markerGuess.style.display = "none";
    const width = axisWidth(track);
    const aX = yearToX(actual, state.start, state.end, width);
    els.compareStart.textContent = formatYear(state.start);
    els.compareEnd.textContent = formatYear(state.end);
    const startX = yearToX(state.start, state.start, state.end, width);
    const endX = yearToX(state.end, state.start, state.end, width);
    els.compareStart.style.left = startX + "px";
    els.compareEnd.style.left = endX + "px";
    els.compareStart.className = "compare-end start";
    els.compareEnd.className = "compare-end end";
    if (els.compareGap) {
      els.compareGap.style.opacity = "0";
      els.compareGap.style.width = "0";
    }
    if (els.markerActual) {
      els.markerActual.style.display = "";
      els.markerActualYear.textContent = formatYear(actual);
      els.markerActual.style.left = aX + "px";
      els.markerActual.className = "compare-marker actual labels-below show";
      if (aX <= 56) els.markerActual.classList.add("labels-left");
      else if (aX >= width - 56) els.markerActual.classList.add("labels-right");
    }
    const answered = (guesses || []).filter((g) => g.answered && Number.isFinite(g.guess));
    const closeThresh = 64;
    const aboveGroups = [];
    answered.forEach((g, idx) => {
      const x = yearToX(g.guess, state.start, state.end, width);
      let row = 0;
      for (let i = 0; i < aboveGroups.length; i++) {
        if (Math.abs(aboveGroups[i] - x) < closeThresh) {
          row += 1;
        }
      }
      aboveGroups.push(x);
      const el = document.createElement("span");
      el.className = "compare-marker mp-player labels-above show";
      if (row) el.classList.add("mp-row-" + Math.min(row, 2));
      if (g.isSelf) el.classList.add("is-self");
      if (g.diff === 0) el.classList.add("exact");
      if (x <= 56) el.classList.add("labels-left");
      else if (x >= width - 56) el.classList.add("labels-right");
      el.style.left = x + "px";
      const color = g.color || "var(--gold)";
      const name = g.isSelf ? "你（" + g.nick + "）" : g.nick;
      el.innerHTML = "<i></i><b></b>";
      el.querySelector("i").textContent = name;
      el.querySelector("b").textContent = formatYear(g.guess);
      el.style.setProperty("--mp-color", color);
      const dot = document.createElement("style");
      el.style.zIndex = String(20 + idx);
      // color the pseudo dot via box-shadow border using an inner span
      const pip = document.createElement("span");
      pip.className = "mp-pip";
      pip.style.cssText = "position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#fff;border:3px solid " + color + ";box-shadow:0 2px 6px rgba(0,0,0,0.18);";
      el.appendChild(pip);
      layer.appendChild(el);
    });
    requestAnimationFrame(() => {
      Array.from(layer.children).forEach((el) => el.classList.add("show"));
    });
  }

  function showReveal(guess, actual, diff, points) {
    els.guessInput.hidden = true;
    els.revealPanel.hidden = false;
    showOfficialPrompt(state.current);
    renderRevealBands();
    if (diff === 0) {
      els.revealVerdict.textContent = "完全正確！";
      els.revealVerdict.className = "reveal-verdict perfect";
      els.revealPoints.innerHTML = "相差 0 年 · <strong>" + formatNumber(points) + "</strong> 分";
    } else {
      const late = guess > actual;
      els.revealVerdict.textContent = (late ? "晚了 " : "早了 ") + formatNumber(diff) + " 年";
      els.revealVerdict.className = "reveal-verdict";
      els.revealPoints.innerHTML =
        "正確是 " + formatYear(actual) + " · <strong>" + formatNumber(points) + "</strong> 分";
    }
    placeRevealMarkers(guess, actual, diff);
    els.scoreMeterFill.style.width = "0%";
    els.scoreMeterLabel.textContent = "0 / 5,000";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        els.scoreMeterFill.style.width = (points / MAX_POINTS) * 100 + "%";
      });
    });
    animateCount(els.scoreMeterLabel, 0, points, 900, (v) => formatNumber(Math.round(v)) + " / 5,000");
    const last = state.index >= state.rounds - 1;
    els.nextBtn.textContent = last ? "查看總結" : "下一題";
    els.nextBtn.focus();
  }

  function animateCount(el, from, to, duration, fmt) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function nextOrFinish() {
    if (!state.revealed) return;
    if (window.YearGuessMp && YearGuessMp.interceptNext()) return;
    if (state.index >= state.rounds - 1) {
      finishGame();
      return;
    }
    state.index += 1;
    renderRound();
  }

  function finishGame() {
    const total = state.score;
    const max = state.rounds * MAX_POINTS;
    const exacts = state.history.filter((h) => h.diff === 0).length;
    const avg = state.history.length ? Math.round(total / state.history.length) : 0;
    const mpActive = window.YearGuessMp && YearGuessMp.isActive();
    const isRecord = mpActive ? false : saveBest(total);
    els.resultTotal.textContent = formatNumber(total);
    els.resultMax.textContent = "滿分 " + formatNumber(max);
    els.resultRecord.hidden = !isRecord;
    els.resultStreak.textContent = String(state.bestStreak);
    els.resultAverage.textContent = formatNumber(avg);
    els.resultExact.textContent = exacts + " / " + state.rounds;
    els.resultBody.innerHTML = "";
    state.history.forEach((row, i) => {
      const tr = document.createElement("tr");
      if (row.diff === 0) tr.className = "exact";
      tr.innerHTML =
        "<td>" + (i + 1) + "</td>" +
        "<td>" + escapeHtml(row.event.title) + "</td>" +
        "<td>" + formatYear(row.guess) + "</td>" +
        "<td>" + formatYear(row.actual) + "</td>" +
        "<td>" + formatNumber(row.diff) + "</td>" +
        "<td>" + formatNumber(row.points) + "</td>";
      els.resultBody.appendChild(tr);
    });
    showScreen("result");
    if (window.YearGuessMp) YearGuessMp.onFinishScreen();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function quitGame() {
    if (window.YearGuessMp && YearGuessMp.interceptQuit()) return;
    if (state.history.length) {
      finishGame();
      return;
    }
    showScreen("start");
    updateMatchCount();
  }


  function pointerYear(ev, wrap, start, end) {
    const rect = wrap.getBoundingClientRect();
    return xToYear(ev.clientX - rect.left, start, end, rect.width);
  }

  function bindGuessPointer() {
    const wrap = els.guessSliderWrap;
    if (!wrap) return;
    let dragging = false;
    function apply(ev) {
      setGuess(pointerYear(ev, wrap, state.start, state.end), false);
    }
    wrap.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || state.revealed) return;
      dragging = true;
      wrap.setPointerCapture(ev.pointerId);
      apply(ev);
      ev.preventDefault();
    });
    wrap.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      apply(ev);
    });
    function stop() { dragging = false; }
    wrap.addEventListener("pointerup", stop);
    wrap.addEventListener("pointercancel", stop);
    wrap.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        ev.preventDefault();
        setGuess(state.guess - (ev.shiftKey ? 10 : 1), false);
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        ev.preventDefault();
        setGuess(state.guess + (ev.shiftKey ? 10 : 1), false);
      }
    });
    wrap.tabIndex = 0;
  }

  function bindRangePointer() {
    const wrap = els.rangeSlider;
    if (!wrap) return;
    let dragging = null;
    function apply(ev) {
      const year = pointerYear(ev, wrap, DATA_MIN, DATA_MAX);
      if (dragging === "start") {
        state.start = Math.min(year, state.end);
      } else if (dragging === "end") {
        state.end = Math.max(year, state.start);
      }
      const match = PRESETS.find((p) => p.id !== "custom" && p.start === state.start && p.end === state.end);
      state.presetId = match ? match.id : "custom";
      renderPresetChips();
      updateRangeUi();
      updateMatchCount();
    }
    wrap.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const rect = wrap.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const width = rect.width;
      const x0 = yearToX(state.start, DATA_MIN, DATA_MAX, width);
      const x1 = yearToX(state.end, DATA_MIN, DATA_MAX, width);
      dragging = Math.abs(x - x0) <= Math.abs(x - x1) ? "start" : "end";
      wrap.setPointerCapture(ev.pointerId);
      apply(ev);
      ev.preventDefault();
    });
    wrap.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      apply(ev);
    });
    function stop() { dragging = null; }
    wrap.addEventListener("pointerup", stop);
    wrap.addEventListener("pointercancel", stop);
  }

  function bind() {
    els.rangeStart.addEventListener("input", syncRangeFromSliders);
    els.rangeEnd.addEventListener("input", syncRangeFromSliders);
    bindRangePointer();
    bindGuessPointer();
    if (els.curriculumOnly) {
      els.curriculumOnly.addEventListener("change", () => {
        state.curriculumOnly = !!els.curriculumOnly.checked;
        updateMatchCount();
      });
    }
    els.setupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      startGame();
    });
    els.guessSlider.addEventListener("input", () => setGuess(Number(els.guessSlider.value), false));
    els.guessNumber.addEventListener("input", syncGuessFromNumber);
    els.bceToggle.addEventListener("change", () => {
      const raw = Math.abs(Number(els.guessNumber.value) || 0);
      setGuess(els.bceToggle.checked ? -raw : raw, true);
    });
    els.submitBtn.addEventListener("click", submitGuess);
    els.guessNumber.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      }
    });
    els.nextBtn.addEventListener("click", nextOrFinish);
    els.quitBtn.addEventListener("click", quitGame);
    els.playAgainBtn.addEventListener("click", startGame);
    els.adjustBtn.addEventListener("click", () => {
      if (window.YearGuessMp && YearGuessMp.interceptAdjust()) return;
      showScreen("start");
      updateMatchCount();
    });
    window.addEventListener("resize", () => {
      renderSetupBands();
      renderGuessBands();
      positionGuessThumb();
      positionRangeThumbs();
      renderRevealBands();
      if (state.revealed && window.YearGuessMp && YearGuessMp.relayoutMarkers()) {
        /* multiplayer markers handled */
      } else if (state.revealed && state.current && state.history.length) {
        const last = state.history[state.history.length - 1];
        placeRevealMarkers(last.guess, last.actual, last.diff);
      }
    });
  }

  function init() {
    if (!allEvents().length) {
      els.matchCount.textContent = "找不到事件資料，請確認 events.js 與本頁放在同一資料夾。";
      els.startBtn.disabled = true;
      return;
    }
    els.rangeStart.min = String(DATA_MIN);
    els.rangeStart.max = String(DATA_MAX);
    els.rangeEnd.min = String(DATA_MIN);
    els.rangeEnd.max = String(DATA_MAX);
    renderRegionChips();
    renderCategoryChips();
    renderPresetChips();
    renderRoundChips();
    updateRangeUi();
    updateMatchCount();
    bind();
  }

  /* 給自動測試使用的穩定介面，不影響一般遊玩。 */
  window.YearGuess = {
    scrubYearMentions: scrubYearMentions,
    scoreForDiff: scoreForDiff,
    formatYear: formatYear,
    getState: function () { return state; },
    startGame: startGame,
    submitGuess: submitGuess,
    nextOrFinish: nextOrFinish,
    setGuess: setGuess,
    renderRound: renderRound,
    renderGuessBands: renderGuessBands,
    renderRevealBands: renderRevealBands,
    renderSetupBands: renderSetupBands,
    yearToX: yearToX,
    xToYear: xToYear,
    AXIS_INSET: AXIS_INSET,
    positionGuessThumb: positionGuessThumb,
    placeRevealMarkers: placeRevealMarkers,
    setScheme: function (id) { setScheme(id); },
    availableSchemeIds: availableSchemeIds,
    eventPrimaryRegion: eventPrimaryRegion,
    eventRegions: eventRegions,
    matchesFilters: matchesFilters,
    filteredEvents: filteredEvents,
    DATA_MIN: DATA_MIN,
    DATA_MAX: DATA_MAX,
    els: els,
    enterPlayRound: enterPlayRound,
    showReveal: showReveal,
    showOfficialPrompt: showOfficialPrompt,
    showQuizPrompt: showQuizPrompt,
    showEventOnMap: showEventOnMap,
    showScreen: showScreen,
    catColor: catColor,
    escapeHtml: escapeHtml,
    formatNumber: formatNumber,
    scoreForDiff: scoreForDiff,
    spanYears: spanYears,
    shuffle: shuffle,
    ensureScheme: ensureScheme,
    renderSchemeSwitch: renderSchemeSwitch,
    resetCompareVisuals: resetCompareVisuals,
    currentGuessValue: currentGuessValue,
    placeMultiplayerMarkers: placeMultiplayerMarkers,
    clearMultiplayerMarkers: clearMultiplayerMarkers,
    updateMatchCount: updateMatchCount,
    renderRegionChips: renderRegionChips,
    renderCategoryChips: renderCategoryChips,
    renderPresetChips: renderPresetChips,
    renderRoundChips: renderRoundChips,
    updateRangeUi: updateRangeUi,
    MAX_POINTS: MAX_POINTS,
    REGIONS: REGIONS,
    CATEGORIES: CATEGORIES
  };

  init();
})();
