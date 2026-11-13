/**
 * 題庫申請／修改的純函式。只做欄位解析與 events.js 讀寫，不執行題目內文。
 * 題目內文一律當成不可信資料，寫回檔案時只經 JSON.stringify。
 */

export const OWNER_LOGIN = "rainapply3572";

export const REGIONS = ["中國", "日本", "朝鮮半島", "臺灣", "蒙古", "越南"];
export const CATEGORIES = ["政治", "戰爭", "文化", "外交", "宗教", "科技", "經濟", "社會"];

export const FIELD_NAMES = [
  "題目",
  "事件敘述",
  "年份",
  "地區",
  "地點",
  "類型",
  "出處",
  "提案人",
  "題目編號",
  "動作",
  "課內",
  "單元"
];

/** 玩家會看到的文字裡不該出現的朝代／時期名。地區名（朝鮮、日本等）不在此列。 */
export const DYNASTY_WORDS = [
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

const YEAR_SPOILER = /(?:西元前|公元前|西元|公元)\s*[0-9０-９]{1,4}|[0-9０-９]{3,4}\s*年|[0-9０-９]{1,2}\s*世紀|(?:秦|漢|唐|宋|明|清|元|隋|周|商|夏)(?:朝|代)/;

const YEAR_MIN = -3000;
const YEAR_MAX = 2020;

const LIMITS = {
  "題目": 80,
  "事件敘述": 500,
  "地點": 80,
  "出處": 200,
  "提案人": 24,
  "單元": 40
};

export function sameLogin(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function isRepoOwner(login, repositoryOwner) {
  return sameLogin(login, OWNER_LOGIN) && sameLogin(login, repositoryOwner);
}

function normalizeWidth(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/－/g, "-")
    .replace(/\u00a0/g, " ");
}

function cleanText(value, multiline) {
  let text = normalizeWidth(value).replace(/\u0000/g, "");
  text = text.replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (!multiline) text = text.replace(/[\r\n]+/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function emptyMarker(value) {
  const text = String(value || "").trim();
  return text === "" || text === "_No response_" || text === "無回應";
}

export function parseSections(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const parts = text.split(/^###\s+/m);
  const fields = {};
  for (const part of parts) {
    if (!part.trim()) continue;
    const breakAt = part.indexOf("\n");
    const label = (breakAt === -1 ? part : part.slice(0, breakAt)).trim();
    if (!FIELD_NAMES.includes(label)) continue;
    const raw = breakAt === -1 ? "" : part.slice(breakAt + 1);
    fields[label] = emptyMarker(raw) ? "" : raw.trim();
  }
  return fields;
}

export function parseKeyLines(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const fields = {};
  let current = null;
  for (const line of text.split("\n")) {
    const match = line.match(/^([^\s:：]{1,12})[:：]\s?(.*)$/);
    if (match && FIELD_NAMES.includes(match[1])) {
      current = match[1];
      fields[current] = match[2].trim();
      continue;
    }
    if (current && (line.startsWith(" ") || line.startsWith("\t"))) {
      fields[current] += "\n" + line.trim();
    } else if (line.trim()) {
      current = null;
    }
  }
  Object.keys(fields).forEach((key) => {
    if (emptyMarker(fields[key])) fields[key] = "";
  });
  return fields;
}

function extractFences(body) {
  const text = String(body || "");
  const blocks = [];
  const pattern = /```[^\n]*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(text))) blocks.push(match[1]);
  return blocks.join("\n");
}

/** 讀取議題內文。有欄位標題時只用標題，避免內文裡夾帶的「年份:」覆寫主人看到的欄位。 */
export function parseIssueBody(body) {
  const sections = parseSections(body);
  if (Object.keys(sections).length) return sections;
  const fences = extractFences(body);
  if (fences.trim()) return parseKeyLines(fences);
  return parseKeyLines(body);
}

/** 主人留言覆寫。有圍欄時只讀圍欄，避免說明文字裡的欄位被誤判。 */
export function parseOverrideComment(body) {
  const text = String(body || "");
  const fences = extractFences(text);
  const source = fences.trim() ? fences : text;
  const fields = parseKeyLines(source);
  return Object.keys(fields).length ? fields : null;
}

export function latestOwnerOverride(comments, repositoryOwner) {
  const list = Array.isArray(comments) ? comments.slice() : [];
  list.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  let latest = null;
  for (const comment of list) {
    const login = comment && comment.user && comment.user.login;
    if (!isRepoOwner(login, repositoryOwner)) continue;
    if (comment.author_association !== "OWNER") continue;
    const fields = parseOverrideComment(comment.body || "");
    if (fields) latest = fields;
  }
  return latest;
}

export function mergeFields(bodyFields, overrideFields) {
  return Object.assign({}, bodyFields || {}, overrideFields || {});
}

export function parseYear(raw) {
  const text = cleanText(raw, false).replace(/\s+/g, "");
  if (!text) return { error: "請填年份。" };
  let year = null;
  let match;
  if ((match = text.match(/^(?:西元前|公元前|前)(\d{1,4})$/))) {
    const n = Number(match[1]);
    if (n === 0) return { error: "沒有西元前 0 年。" };
    year = -n;
  } else if ((match = text.match(/^(?:西元|公元)(\d{1,4})$/))) {
    year = Number(match[1]);
    if (year === 0) return { error: "沒有西元 0 年。" };
  } else if ((match = text.match(/^-?\d{1,4}$/))) {
    year = Number(text);
    if (year === 0) return { error: "沒有第 0 年。西元前請用負數，例如 -221。" };
  } else {
    return { error: "年份必須是整數。西元前請用負數（例如 -221）或「西元前221」。" };
  }
  if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
    return { error: "年份須介於西元前 3000 年與西元 2020 年之間。" };
  }
  return { year };
}

export function spoilerHits(text) {
  const value = String(text || "");
  const hits = [];
  DYNASTY_WORDS.forEach((word) => {
    if (word && value.includes(word)) hits.push(word);
  });
  const match = value.match(YEAR_SPOILER);
  if (match) hits.push(match[0]);
  return hits;
}

function parseCurriculum(raw) {
  if (raw == null || emptyMarker(raw)) return false;
  const text = cleanText(raw, false);
  if (["是", "課內", "yes", "true", "1"].includes(text.toLowerCase())) return true;
  if (["否", "非課內", "no", "false", "0"].includes(text.toLowerCase())) return false;
  return null;
}

function parseAction(raw, hasId) {
  const text = cleanText(raw || "", false);
  if (text === "新增" || text === "新題") return "add";
  if (text === "修改") return "edit";
  if (text === "刪除" || text === "删除") return "delete";
  if (!text) return hasId ? "edit" : "add";
  return null;
}

function validId(id) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(id);
}

function clip(label, value, multiline) {
  const text = cleanText(value || "", multiline);
  const max = LIMITS[label];
  if (max && text.length > max) return { error: label + "請勿超過 " + max + " 字。" };
  return { text };
}

export function validateFields(fields) {
  const source = fields || {};
  const idText = cleanText(source["題目編號"] || "", false);
  const hasId = !!idText;
  const action = parseAction(source["動作"], hasId);
  if (!action) return { error: "動作只能是「新增」、「修改」或「刪除」。" };

  if (action !== "add") {
    if (!validId(idText)) return { error: "題目編號格式不正確。" };
  } else if (hasId) {
    return { error: "新題不能指定題目編號。" };
  }

  if (action === "delete") {
    return { action, id: idText };
  }

  const quizClip = clip("事件敘述", source["事件敘述"], true);
  if (quizClip.error) return quizClip;
  if (quizClip.text.length < 8) return { error: "事件敘述至少 8 個字，並請不要寫出朝代或年分。" };

  const titleClip = clip("題目", source["題目"], false);
  if (titleClip.error) return titleClip;
  const title = titleClip.text || deriveTitle(quizClip.text);
  if (!title || title.length < 2) return { error: "請填題目，或寫長一點的事件敘述以便自動產生題目。" };

  const leaks = spoilerHits(title).concat(spoilerHits(quizClip.text));
  if (leaks.length) {
    return { error: "題目或事件敘述含有會洩漏答案的字：" + leaks.slice(0, 6).join("、") + "。請改寫後再核准。" };
  }

  const year = parseYear(source["年份"]);
  if (year.error) return year;

  const region = cleanText(source["地區"] || "", false);
  if (!REGIONS.includes(region)) return { error: "地區必須是：" + REGIONS.join("、") + "。" };

  const category = cleanText(source["類型"] || "", false) || "文化";
  if (!CATEGORIES.includes(category)) return { error: "類型必須是：" + CATEGORIES.join("、") + "。" };

  const location = clip("地點", source["地點"], false);
  if (location.error) return location;
  const reference = clip("出處", source["出處"], false);
  if (reference.error) return reference;
  const nick = clip("提案人", source["提案人"], false);
  if (nick.error) return nick;
  const unit = clip("單元", source["單元"], false);
  if (unit.error) return unit;

  const hasCurriculum = Object.prototype.hasOwnProperty.call(source, "課內");
  const curriculum = hasCurriculum ? parseCurriculum(source["課內"]) : false;
  if (curriculum === null) return { error: "課內請填「是」或「否」。" };

  return {
    action,
    id: action === "edit" ? idText : "",
    title,
    quiz: quizClip.text,
    year: year.year,
    region,
    category,
    location: location.text,
    source: reference.text,
    submitter: nick.text,
    unit: unit.text,
    curriculum,
    present: {
      出處: Object.prototype.hasOwnProperty.call(source, "出處"),
      提案人: Object.prototype.hasOwnProperty.call(source, "提案人"),
      單元: Object.prototype.hasOwnProperty.call(source, "單元"),
      課內: hasCurriculum,
      地點: Object.prototype.hasOwnProperty.call(source, "地點")
    }
  };
}

function deriveTitle(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const cut = clean.split(/[。！？!?]/)[0].trim();
  const base = cut || clean;
  if (base.length <= 36) return base;
  return base.slice(0, 36) + "…";
}

export function parseEventsSource(source) {
  const text = String(source || "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start || !text.slice(0, start).includes("window.EVENTS")) {
    throw new Error("events.js 格式不正確，沒有寫入。");
  }
  const events = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(events)) throw new Error("events.js 不是題目陣列，沒有寫入。");
  return events;
}

export function serializeEvents(events) {
  let json = JSON.stringify(events, null, 2);
  json = json
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return "window.EVENTS = " + json + ";\n";
}

function nextId(events, issueNumber) {
  const n = Number(issueNumber);
  if (!Number.isInteger(n) || n < 1 || n > 100000000) {
    throw new Error("議題編號不正確。");
  }
  const used = new Set(events.map((event) => event && event.id));
  let id = "q-" + n;
  let i = 2;
  while (used.has(id)) {
    id = "q-" + n + "-" + i;
    i += 1;
    if (i > 50) throw new Error("無法產生不重複的題目編號。");
  }
  return id;
}

function applyRecord(target, record) {
  target.title = record.title;
  target.year = record.year;
  target.location = record.location || "";
  target.region = record.region;
  target.regions = [record.region];
  target.category = record.category;
  target.description = record.quiz;
  target.quizTitle = record.title;
  target.quizLocation = record.location || "";
  target.quizText = record.quiz;
  const present = record.present || {};
  if (present.課內) {
    if (record.curriculum) target.curriculum = true;
    else delete target.curriculum;
  } else if (record.action === "add") {
    delete target.curriculum;
  }
  if (present.單元) {
    if (record.unit) target.unit = record.unit;
    else delete target.unit;
  }
  if (present.出處) {
    if (record.source) target.source = record.source;
    else delete target.source;
  }
  if (present.提案人) {
    if (record.submitter) target.submitter = record.submitter;
    else delete target.submitter;
  }
}

export function applyChange(events, record, issueNumber) {
  const list = events.slice();
  if (record.action === "delete") {
    const index = list.findIndex((event) => event && event.id === record.id);
    if (index < 0) return { error: "找不到題目編號「" + record.id + "」，沒有刪除。" };
    const before = list[index];
    list.splice(index, 1);
    return { action: "delete", id: record.id, before, after: null, events: list };
  }
  if (record.action === "edit") {
    const index = list.findIndex((event) => event && event.id === record.id);
    if (index < 0) return { error: "找不到題目編號「" + record.id + "」，沒有修改。" };
    const before = list[index];
    const after = Object.assign({}, before);
    applyRecord(after, record);
    after.id = before.id;
    if (before.lat != null) after.lat = before.lat;
    if (before.lng != null) after.lng = before.lng;
    list[index] = after;
    return { action: "edit", id: after.id, before, after, events: list };
  }
  const id = nextId(list, issueNumber);
  const after = { id };
  applyRecord(after, record);
  list.push(after);
  return { action: "add", id, before: null, after, events: list };
}

export function snapshot(event) {
  if (!event) return null;
  return {
    id: event.id,
    題目: event.quizTitle || event.title || "",
    事件敘述: event.quizText || event.description || "",
    年份: event.year,
    地區: event.region || "",
    地點: event.location || "",
    類型: event.category || "",
    課內: event.curriculum ? "是" : "否",
    出處: event.source || "",
    單元: event.unit || ""
  };
}

function fence(value) {
  const json = JSON.stringify(value, null, 2).replace(/```/g, "'''");
  return "````json\n" + json + "\n````";
}

export function resultComment(result) {
  const actionLabel = { add: "新增", edit: "修改", delete: "刪除" }[result.action] || result.action;
  const lines = ["已核准，並寫入猜年題庫。", "", "動作：" + actionLabel, "編號：" + result.id];
  if (result.action === "delete") {
    lines.push("", "刪除前：", fence(snapshot(result.before)));
  } else if (result.action === "edit") {
    lines.push("", "修改前：", fence(snapshot(result.before)), "", "修改後：", fence(snapshot(result.after)));
  } else {
    lines.push("", "寫入的題目：", fence(snapshot(result.after)));
  }
  lines.push("", "網站重新部署後，猜年遊戲與題庫專區會看到這次變更。");
  return lines.join("\n");
}

export function errorComment(message) {
  return [
    "這次沒有寫入題庫。",
    "",
    String(message || "無法解析議題內容。"),
    "",
    "請直接修改這個議題的欄位，或由儲存庫擁有者留言覆寫（見下方格式），然後重新加上「核准」標籤。已先移除這次的「核准」，方便再次加上。",
    "",
    "留言覆寫請用圍欄，且只有儲存庫擁有者的留言有效。最新一則擁有者覆寫會蓋過議題內文的同名欄位：",
    "",
    "````",
    "年份: 1592",
    "地區: 日本",
    "題目: 一行題目",
    "事件敘述: 玩家會讀到的敘述，不要寫朝代或年分。",
    "````"
  ].join("\n");
}
