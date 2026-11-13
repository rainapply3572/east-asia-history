(function () {
  "use strict";

  var REGIONS = ["中國", "日本", "朝鮮半島", "臺灣", "蒙古", "越南"];
  var CATEGORIES = ["政治", "戰爭", "文化", "外交", "宗教", "科技", "經濟", "社會"];
  var REGION_TO_SCHEME = {
    "中國": "中國",
    "日本": "日本",
    "朝鮮半島": "朝鮮",
    "越南": "越南",
    "臺灣": "臺灣",
    "蒙古": "蒙古"
  };
  var DYNASTY_WORDS = [
    "西周", "春秋", "戰國", "楚漢", "西漢", "東漢", "三國", "西晉", "東晉", "南北朝",
    "五代十國", "北漢", "北宋", "南宋", "中華民國", "中華人民共和國",
    "彌生", "古墳", "飛鳥", "奈良", "平安", "鎌倉", "室町", "安土桃山", "江戶",
    "明治", "大正", "昭和", "平成",
    "古朝鮮", "漢郡", "統一新羅", "高麗", "朝鮮王朝", "李氏朝鮮", "日治",
    "雒越", "南越", "北屬", "後黎", "西山", "屬明", "明鄭", "鄭氏時期", "鄭氏政權", "荷西",
    "匈奴", "鮮卑", "柔然", "突厥", "回鶻", "大蒙古國", "北元", "清屬",
    "秦朝", "漢朝", "唐朝", "宋朝", "明朝", "清朝", "元朝", "隋朝", "周朝", "商朝", "夏朝",
    "秦代", "漢代", "唐代", "宋代", "明代", "清代", "元代", "隋代", "周代",
    "年號"
  ];
  var YEAR_SPOILER = /(?:西元前|公元前|西元|公元)\s*[0-9０-９]{1,4}|[0-9０-９]{3,4}\s*年|[0-9０-９]{1,2}\s*世紀|(?:秦|漢|唐|宋|明|清|元|隋|周|商|夏)(?:朝|代)/;
  var ISSUE_NEW = "https://github.com/rainapply3572/east-asia-history/issues/new";

  function $(id) { return document.getElementById(id); }

  function events() {
    return Array.isArray(window.EVENTS) ? window.EVENTS : [];
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatYear(year) {
    if (!Number.isFinite(year)) return "—";
    if (year < 0) return "西元前 " + Math.abs(year) + " 年";
    return "西元 " + year + " 年";
  }

  function quizTitle(event) {
    return event.quizTitle || event.title || "未命名";
  }

  function quizText(event) {
    return event.quizText || event.description || "";
  }

  function periodsFor(event) {
    var schemes = window.PERIOD_SCHEMES || {};
    var schemeId = REGION_TO_SCHEME[event.region];
    var scheme = schemes[schemeId];
    if (!scheme || !Array.isArray(scheme.periods) || !Number.isFinite(event.year)) return [];
    return scheme.periods.filter(function (period) {
      return event.year >= period.start && event.year <= period.end;
    });
  }

  function displayPeriod(event) {
    var hits = periodsFor(event);
    var main = hits.filter(function (period) { return period.row !== 1; });
    var list = main.length ? main : hits;
    list.sort(function (a, b) {
      return (a.end - a.start) - (b.end - b.start) || a.start - b.start;
    });
    return list[0] || null;
  }

  function fillSelect(select, options, placeholder) {
    select.innerHTML = "";
    if (placeholder) {
      var all = document.createElement("option");
      all.value = "";
      all.textContent = placeholder;
      select.appendChild(all);
    }
    options.forEach(function (option) {
      var el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });
  }

  function regionOptions() {
    return REGIONS.map(function (region) { return { value: region, label: region }; });
  }

  function categoryOptions() {
    return CATEGORIES.map(function (category) { return { value: category, label: category }; });
  }

  function buildPeriodSelect() {
    var select = $("bankPeriod");
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = "全部時期";
    select.appendChild(all);
    var schemes = window.PERIOD_SCHEMES || {};
    Object.keys(schemes).forEach(function (schemeId) {
      var group = document.createElement("optgroup");
      group.label = schemes[schemeId].label || schemeId;
      (schemes[schemeId].periods || []).forEach(function (period) {
        if (period.row === 1) return;
        var option = document.createElement("option");
        option.value = schemeId + ":" + period.id;
        option.textContent = period.label;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  }

  function spoilerHits(text) {
    var hits = [];
    DYNASTY_WORDS.forEach(function (word) {
      if (text.indexOf(word) !== -1) hits.push(word);
    });
    var match = String(text || "").match(YEAR_SPOILER);
    if (match) hits.push(match[0]);
    return hits;
  }

  function deriveTitle(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    var cut = clean.split(/[。！？!?]/)[0].trim();
    var base = cut || clean;
    if (base.length <= 36) return base;
    return base.slice(0, 36) + "…";
  }

  function readYear(input, bce) {
    var raw = String(input.value || "").trim().replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30);
    }).replace(/－/g, "-");
    if (!raw) return "";
    if (bce.checked) return "-" + raw.replace(/^-/, "");
    return raw;
  }

  function parseYear(raw) {
    var text = String(raw || "").replace(/\s+/g, "");
    var match;
    var year;
    if ((match = text.match(/^(?:西元前|公元前|前)(\d{1,4})$/))) year = -Number(match[1]);
    else if ((match = text.match(/^(?:西元|公元)(\d{1,4})$/))) year = Number(match[1]);
    else if ((match = text.match(/^-?\d{1,4}$/))) year = Number(text);
    else return { error: "年份請填整數。西元前可勾選，或直接填負數，例如 -221。" };
    if (!Number.isInteger(year) || year === 0) return { error: "沒有第 0 年。" };
    if (year < -3000 || year > 2020) return { error: "年份須介於西元前 3000 年與西元 2020 年之間。" };
    return { year: year };
  }

  function showError(el, message) {
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function issueUrl(kind, fields) {
    var edit = kind === "edit";
    var heading = edit
      ? "[題庫修改] " + fields.action + " " + fields.id
      : "[題庫申請] " + fields.title;
    var pairs = [
      ["template", edit ? "question-edit.yml" : "question-submission.yml"],
      ["labels", edit ? "題庫修改" : "題庫申請"],
      ["title", heading.slice(0, 120)],
      ["quiz_title", fields.title],
      ["quiz", fields.quiz],
      ["year", String(fields.year)],
      ["region", fields.region],
      ["category", fields.category],
      ["location", fields.location || ""],
      ["source", fields.source || ""],
      ["nick", fields.nick || ""],
      ["action", fields.action]
    ];
    if (edit) {
      pairs.push(["qid", fields.id]);
      pairs.push(["curriculum", fields.curriculum ? "是" : "否"]);
    }
    var query = pairs.filter(function (pair) {
      return pair[1] != null && pair[1] !== "";
    }).map(function (pair) {
      return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
    }).join("&");
    return ISSUE_NEW + "?" + query;
  }

  function openIssue(url, fallback, link) {
    if (url.length > 7500) {
      return "內容太長，縮短事件敘述後再送出。";
    }
    link.href = url;
    fallback.hidden = false;
    var opened = window.open(url, "_blank", "noopener");
    if (!opened) link.focus();
    return "";
  }

  function validateCommon(fields, deleting) {
    if (!deleting) {
      if (!fields.quiz || fields.quiz.length < 8) return "事件敘述至少 8 個字。";
      if (fields.quiz.length > 500) return "事件敘述請勿超過 500 字。";
      var leaks = spoilerHits(fields.title).concat(spoilerHits(fields.quiz));
      if (leaks.length) return "請不要在題目或敘述裡寫出：" + leaks.slice(0, 6).join("、") + "。";
    }
    var year = parseYear(fields.yearRaw);
    if (year.error) return year.error;
    if (REGIONS.indexOf(fields.region) === -1) return "請選擇地區。";
    if (CATEGORIES.indexOf(fields.category) === -1) return "請選擇類型。";
    fields.year = year.year;
    return "";
  }

  var SCHEME_ORDER = ["中國", "日本", "朝鮮", "越南", "臺灣", "蒙古"];
  var manualOpen = {};
  var searchOpen = {};
  var lastQuery = "";

  function groupInfo(event) {
    var period = displayPeriod(event);
    var schemeId = REGION_TO_SCHEME[event.region] || "";
    var schemes = window.PERIOD_SCHEMES || {};
    var scheme = schemes[schemeId];
    if (!period) {
      return { key: "none", name: "未分時期", scheme: "", start: 0, unknown: true, schemeOrder: 99 };
    }
    var schemeOrder = SCHEME_ORDER.indexOf(schemeId);
    return {
      key: schemeId + ":" + period.id,
      name: period.label,
      scheme: scheme && scheme.label ? scheme.label : schemeId,
      start: period.start,
      unknown: false,
      schemeOrder: schemeOrder < 0 ? 50 : schemeOrder
    };
  }

  function filteredEvents() {
    var query = $("bankSearch").value.trim().toLowerCase();
    var region = $("bankRegion").value;
    var period = $("bankPeriod").value;
    var curriculumOnly = $("bankCurriculum").checked;
    var spoilers = $("bankSpoilers").checked;
    var list = events().filter(function (event) {
      if (region && event.region !== region) return false;
      if (curriculumOnly && !event.curriculum) return false;
      if (period) {
        var parts = period.split(":");
        var schemeId = REGION_TO_SCHEME[event.region];
        if (schemeId !== parts[0]) return false;
        var hit = periodsFor(event).some(function (item) { return item.id === parts[1]; });
        if (!hit) return false;
      }
      if (!query) return true;
      var info = groupInfo(event);
      var blob = [quizTitle(event), quizText(event), event.region || "", event.quizLocation || event.location || "", info.name, info.scheme];
      if (spoilers) blob.push(formatYear(event.year), String(event.year));
      return blob.join("\n").toLowerCase().indexOf(query) !== -1;
    });
    var dir = $("bankSort").value === "year-desc" ? -1 : 1;
    list.sort(function (a, b) {
      return ((a.year || 0) - (b.year || 0)) * dir || quizTitle(a).localeCompare(quizTitle(b), "zh-Hant");
    });
    return list;
  }

  function cardHtml(event, spoilers) {
    var answer = spoilers
      ? '<p class="bank-answer"><span>年份</span> ' + esc(formatYear(event.year)) + "</p>"
      : '<p class="bank-answer is-hidden">年份已隱藏</p>';
    return '<article class="bank-card">' +
      '<div class="bank-card-top"><h2>' + esc(quizTitle(event)) + "</h2>" +
      '<button type="button" class="ghost bank-edit" data-id="' + esc(event.id) + '">提出修改申請</button></div>' +
      '<p class="bank-text">' + esc(quizText(event)) + "</p>" +
      '<p class="bank-meta">' +
      '<span class="badge">' + esc(event.region || "—") + "</span>" +
      (event.quizLocation || event.location ? '<span class="badge">' + esc(event.quizLocation || event.location) + "</span>" : "") +
      '<span class="badge' + (event.curriculum ? " is-on" : "") + '">' + (event.curriculum ? "課內" : "非課內") + "</span>" +
      "</p>" + answer + "</article>";
  }

  function render() {
    var query = $("bankSearch").value.trim();
    if (query !== lastQuery) {
      searchOpen = {};
      lastQuery = query;
    }
    var list = filteredEvents();
    var spoilers = $("bankSpoilers").checked;
    $("bankCount").textContent = "顯示 " + list.length + " 題／共 " + events().length + " 題";
    var root = $("bankList");
    if (!list.length) {
      root.innerHTML = '<p class="bank-empty">沒有符合的題目。</p>';
      return;
    }
    var buckets = {};
    var groups = [];
    list.forEach(function (event) {
      var info = groupInfo(event);
      if (!buckets[info.key]) {
        buckets[info.key] = { info: info, items: [] };
        groups.push(buckets[info.key]);
      }
      buckets[info.key].items.push(event);
    });
    var dir = $("bankSort").value === "year-desc" ? -1 : 1;
    groups.sort(function (a, b) {
      if (a.info.unknown !== b.info.unknown) return a.info.unknown ? 1 : -1;
      if (a.info.start !== b.info.start) return (a.info.start - b.info.start) * dir;
      if (a.info.schemeOrder !== b.info.schemeOrder) return a.info.schemeOrder - b.info.schemeOrder;
      return a.info.name.localeCompare(b.info.name, "zh-Hant");
    });
    root.innerHTML = groups.map(function (group) {
      group.items.sort(function (a, b) {
        return ((a.year || 0) - (b.year || 0)) * dir || quizTitle(a).localeCompare(quizTitle(b), "zh-Hant");
      });
      var open = query ? searchOpen[group.info.key] !== false : !!manualOpen[group.info.key];
      return '<section class="bank-group' + (open ? " is-open" : "") + '" data-group="' + esc(group.info.key) + '">' +
        '<button type="button" class="bank-group-toggle" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="bank-group-chevron" aria-hidden="true"></span>' +
        '<span class="bank-group-name">' + esc(group.info.name) + "</span>" +
        (group.info.scheme ? '<span class="bank-group-scheme">' + esc(group.info.scheme) + "</span>" : "") +
        '<span class="bank-group-count">' + group.items.length + " 題</span></button>" +
        '<div class="bank-group-body"' + (open ? "" : " hidden") + ">" +
        group.items.map(function (event) { return cardHtml(event, spoilers); }).join("") +
        "</div></section>";
    }).join("");
  }

  function findEvent(id) {
    return events().filter(function (event) { return event.id === id; })[0] || null;
  }

  function openEdit(id) {
    var event = findEvent(id);
    if (!event) return;
    $("editId").value = event.id;
    $("editTitle").value = quizTitle(event);
    $("editQuiz").value = quizText(event);
    $("editBce").checked = event.year < 0;
    $("editYear").value = String(Math.abs(event.year));
    $("editRegion").value = event.region || REGIONS[0];
    $("editCategory").value = event.category || "文化";
    $("editLocation").value = event.quizLocation || event.location || "";
    $("editSource").value = event.source || "";
    $("editCurriculum").checked = !!event.curriculum;
    $("editNick").value = "";
    var radios = document.querySelectorAll('input[name="editAction"]');
    radios.forEach(function (radio) { radio.checked = radio.value === "修改"; });
    showError($("editError"), "");
    $("editFallback").hidden = true;
    $("editDialog").showModal();
  }

  function bind() {
    ["bankSearch", "bankRegion", "bankPeriod", "bankSort", "bankCurriculum", "bankSpoilers"].forEach(function (id) {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
    $("bankList").addEventListener("click", function (event) {
      var toggle = event.target.closest(".bank-group-toggle");
      if (toggle) {
        var section = toggle.closest(".bank-group");
        var key = section.getAttribute("data-group");
        var next = toggle.getAttribute("aria-expanded") !== "true";
        if ($("bankSearch").value.trim()) searchOpen[key] = next;
        else manualOpen[key] = next;
        section.classList.toggle("is-open", next);
        toggle.setAttribute("aria-expanded", next ? "true" : "false");
        section.querySelector(".bank-group-body").hidden = !next;
        return;
      }
      var button = event.target.closest(".bank-edit");
      if (!button) return;
      openEdit(button.getAttribute("data-id"));
    });
    $("editClose").addEventListener("click", function () { $("editDialog").close(); });
    $("submitForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var fields = {
        title: $("newTitle").value.trim() || deriveTitle($("newQuiz").value),
        quiz: $("newQuiz").value.trim(),
        yearRaw: readYear($("newYear"), $("newBce")),
        region: $("newRegion").value,
        category: $("newCategory").value,
        location: $("newLocation").value.trim(),
        source: $("newSource").value.trim(),
        nick: $("newNick").value.trim(),
        action: "新增"
      };
      var error = validateCommon(fields, false);
      showError($("newError"), error);
      if (error) return;
      var url = issueUrl("new", fields);
      var openError = openIssue(url, $("newFallback"), $("newFallbackLink"));
      showError($("newError"), openError);
    });
    $("editForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var action = "修改";
      document.querySelectorAll('input[name="editAction"]').forEach(function (radio) {
        if (radio.checked) action = radio.value;
      });
      var fields = {
        id: $("editId").value.trim(),
        title: $("editTitle").value.trim() || deriveTitle($("editQuiz").value),
        quiz: $("editQuiz").value.trim(),
        yearRaw: readYear($("editYear"), $("editBce")),
        region: $("editRegion").value,
        category: $("editCategory").value,
        location: $("editLocation").value.trim(),
        source: $("editSource").value.trim(),
        nick: $("editNick").value.trim(),
        curriculum: $("editCurriculum").checked,
        action: action
      };
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(fields.id)) {
        showError($("editError"), "題目編號不正確。");
        return;
      }
      var error = validateCommon(fields, action === "刪除");
      showError($("editError"), error);
      if (error) return;
      var url = issueUrl("edit", fields);
      var openError = openIssue(url, $("editFallback"), $("editFallbackLink"));
      showError($("editError"), openError);
    });
  }

  function init() {
    fillSelect($("bankRegion"), regionOptions(), "全部地區");
    fillSelect($("newRegion"), regionOptions());
    fillSelect($("editRegion"), regionOptions());
    fillSelect($("newCategory"), categoryOptions());
    fillSelect($("editCategory"), categoryOptions());
    $("newCategory").value = "文化";
    buildPeriodSelect();
    if (!events().length) {
      $("bankCount").textContent = "找不到題目。請確認 events.js 與此頁在同一個資料夾。";
      return;
    }
    bind();
    render();
  }

  window.QuestionBank = {
    issueUrl: issueUrl,
    parseYear: parseYear,
    spoilerHits: spoilerHits,
    deriveTitle: deriveTitle,
    displayPeriod: displayPeriod
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
