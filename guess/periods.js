/* 時間軸時期資料。
 * start / end：史學上常用的包含起迄（可重疊，例如三國與西晉、南宋與元）。
 * visStart / visEnd：單列色帶用的右開區間 [visStart, visEnd)，右緣落在下一段起年，
 *   讓共享界年（如 618 隋／唐、1912 清／民國）對齊同一 x。
 * row: 1 表示重疊短帶，畫在主帶上方，用以標示並行政權。
 */
window.PERIOD_SCHEMES = {
  "中國": {
    label: "中國朝代",
    periods: [
      { id: "western-zhou", label: "西周", short: "西周", start: -1046, end: -771, visStart: -1046, visEnd: -770, color: "#6b5344", note: "年代依夏商周斷代工程常用的前 1046 年武王克商說。" },
      { id: "chunqiu", label: "春秋", short: "春秋", start: -770, end: -476, visStart: -770, visEnd: -475, color: "#8a6b3d", note: "平王東遷前 770 年；春秋、戰國之界取前 475 年（周元王元年）一說。" },
      { id: "zhanguo", label: "戰國", short: "戰國", start: -475, end: -221, visStart: -475, visEnd: -221, color: "#7a5c8a" },
      { id: "qin", label: "秦", short: "秦", start: -221, end: -207, visStart: -221, visEnd: -206, color: "#8c4a3a" },
      { id: "chuhan", label: "楚漢", short: "楚漢", start: -206, end: -203, visStart: -206, visEnd: -202, color: "#a67c52", note: "秦亡至西漢建立之間的楚漢之爭。" },
      { id: "whan", label: "西漢", short: "西漢", start: -202, end: 8, visStart: -202, visEnd: 9, color: "#9e2b1f" },
      { id: "xin", label: "新", short: "新", start: 9, end: 23, visStart: 9, visEnd: 25, color: "#6b5344", note: "王莽新朝 9–23 年；其後更始，至 25 年東漢建立。" },
      { id: "ehan", label: "東漢", short: "東漢", start: 25, end: 220, visStart: 25, visEnd: 220, color: "#c45c4a" },
      { id: "sanguo", label: "三國", short: "三國", start: 220, end: 280, visStart: 220, visEnd: 266, color: "#3e4a59", note: "曹魏 220 年開國，至 280 年吳亡。266 年起與西晉並行。" },
      { id: "sanguo-overlap", label: "三國", short: "吳", start: 220, end: 280, visStart: 266, visEnd: 280, row: 1, color: "#3e4a59", note: "西晉已立，吳至 280 年方亡。" },
      { id: "wjin", label: "西晉", short: "西晉", start: 266, end: 316, visStart: 266, visEnd: 317, color: "#6a7a45" },
      { id: "ejin", label: "東晉", short: "東晉", start: 317, end: 420, visStart: 317, visEnd: 420, color: "#5a6b3d" },
      { id: "nanbei", label: "南北朝", short: "南北", start: 420, end: 589, visStart: 420, visEnd: 581, color: "#4a5d7a", note: "南朝至 589 年陳亡；581 年隋已建。" },
      { id: "nanbei-overlap", label: "陳", short: "陳", start: 420, end: 589, visStart: 581, visEnd: 589, row: 1, color: "#4a5d7a", note: "隋已建，陳至 589 年方亡。" },
      { id: "sui", label: "隋", short: "隋", start: 581, end: 618, visStart: 581, visEnd: 618, color: "#2b6b62" },
      { id: "tang", label: "唐", short: "唐", start: 618, end: 907, visStart: 618, visEnd: 907, color: "#b07a1a" },
      { id: "wudai", label: "五代十國", short: "五代", start: 907, end: 979, visStart: 907, visEnd: 960, color: "#7a5c8a", note: "北宋 960 年建立，北漢至 979 年方亡。" },
      { id: "wudai-overlap", label: "北漢", short: "北漢", start: 907, end: 979, visStart: 960, visEnd: 979, row: 1, color: "#7a5c8a", note: "十國殘餘：北漢至 979 年。" },
      { id: "nsong", label: "北宋", short: "北宋", start: 960, end: 1127, visStart: 960, visEnd: 1127, color: "#9e4b6e" },
      { id: "ssong", label: "南宋", short: "南宋", start: 1127, end: 1279, visStart: 1127, visEnd: 1279, color: "#b05a7a" },
      { id: "yuan-overlap", label: "元", short: "元", start: 1271, end: 1368, visStart: 1271, visEnd: 1279, row: 1, color: "#4a3b2f", note: "1271 年定國號，1279 年滅宋。" },
      { id: "yuan", label: "元", short: "元", start: 1271, end: 1368, visStart: 1279, visEnd: 1368, color: "#4a3b2f", note: "國號始於 1271 年，1279 年滅宋、統一中國本部。" },
      { id: "ming", label: "明", short: "明", start: 1368, end: 1644, visStart: 1368, visEnd: 1644, color: "#7a1f3a" },
      { id: "qing", label: "清", short: "清", start: 1644, end: 1912, visStart: 1644, visEnd: 1912, color: "#3d5a80" },
      { id: "roc", label: "中華民國", short: "民國", start: 1912, end: 1949, visStart: 1912, visEnd: 1949, color: "#2b6b62" },
      { id: "prc", label: "中華人民共和國", short: "現代", start: 1949, end: 1999, visStart: 1949, visEnd: 1999, color: "#5b534a" }
    ]
  },
  "日本": {
    label: "日本時期",
    periods: [
      { id: "yayoi", label: "彌生", short: "彌生", start: -1046, end: 250, visStart: -1046, visEnd: 250, color: "#8a6b3d", note: "彌生時代約自前 10 世紀至 3 世紀；此處向前延伸以配合全站時間軸。" },
      { id: "kofun", label: "古墳", short: "古墳", start: 250, end: 538, visStart: 250, visEnd: 538, color: "#6b5344" },
      { id: "asuka", label: "飛鳥", short: "飛鳥", start: 538, end: 710, visStart: 538, visEnd: 710, color: "#2b6b62", note: "常以 538 年佛教傳入或 592 年推古朝為始，至遷都平城京。" },
      { id: "nara", label: "奈良", short: "奈良", start: 710, end: 794, visStart: 710, visEnd: 794, color: "#3d5a80" },
      { id: "heian", label: "平安", short: "平安", start: 794, end: 1185, visStart: 794, visEnd: 1185, color: "#9e4b6e" },
      { id: "kamakura", label: "鎌倉", short: "鎌倉", start: 1185, end: 1333, visStart: 1185, visEnd: 1333, color: "#4a5d7a", note: "壇之浦之戰 1185 年；鎌倉幕府 1192 年開府，1333 年滅亡。" },
      { id: "muromachi", label: "室町", short: "室町", start: 1336, end: 1573, visStart: 1333, visEnd: 1467, color: "#5a6b3d", note: "足利幕府 1336／1338 年開府，至 1573 年。1467 年起與戰國並行。" },
      { id: "sengoku", label: "戰國", short: "戰國", start: 1467, end: 1573, visStart: 1467, visEnd: 1573, color: "#8c4a3a" },
      { id: "azuchi", label: "安土桃山", short: "安土", start: 1573, end: 1603, visStart: 1573, visEnd: 1603, color: "#b07a1a" },
      { id: "edo", label: "江戶", short: "江戶", start: 1603, end: 1868, visStart: 1603, visEnd: 1868, color: "#3e4a59" },
      { id: "meiji", label: "明治", short: "明治", start: 1868, end: 1912, visStart: 1868, visEnd: 1912, color: "#9e2b1f" },
      { id: "taisho", label: "大正", short: "大正", start: 1912, end: 1926, visStart: 1912, visEnd: 1926, color: "#7a5c8a" },
      { id: "showa", label: "昭和", short: "昭和", start: 1926, end: 1989, visStart: 1926, visEnd: 1989, color: "#4a3b2f" },
      { id: "heisei", label: "平成", short: "平成", start: 1989, end: 1999, visStart: 1989, visEnd: 1999, color: "#2b6b62", note: "平成至 2019 年；本站資料迄於 1999 年。" }
    ]
  },
  "朝鮮": {
    label: "朝鮮時期",
    periods: [
      { id: "gojoseon", label: "古朝鮮", short: "古朝", start: -1046, end: -108, visStart: -1046, visEnd: -108, color: "#6b5344", note: "古朝鮮傳說與考古年代更早；此處向前延伸以配合全站時間軸。" },
      { id: "han-gun", label: "漢郡", short: "漢郡", start: -108, end: -57, visStart: -108, visEnd: -57, color: "#8c4a3a", note: "樂浪等郡設置以後、半島三國傳說紀年起年以前。" },
      { id: "samguk", label: "三國", short: "三國", start: -57, end: 668, visStart: -57, visEnd: 668, color: "#4a5d7a", note: "傳統以新羅前 57 年、高句麗前 37 年、百濟前 18 年為始，至 668 年高句麗亡。" },
      { id: "silla", label: "統一新羅", short: "新羅", start: 668, end: 935, visStart: 668, visEnd: 918, color: "#2b6b62", note: "高麗 918 年建國，新羅至 935 年方亡。" },
      { id: "silla-overlap", label: "新羅", short: "新羅", start: 668, end: 935, visStart: 918, visEnd: 935, row: 1, color: "#2b6b62", note: "高麗已建，新羅至 935 年。" },
      { id: "goryeo", label: "高麗", short: "高麗", start: 918, end: 1392, visStart: 918, visEnd: 1392, color: "#7a5c8a" },
      { id: "joseon", label: "朝鮮", short: "朝鮮", start: 1392, end: 1910, visStart: 1392, visEnd: 1910, color: "#3d5a80", note: "1897 年起國號亦作大韓帝國，至 1910 年。" },
      { id: "ilje", label: "日治", short: "日治", start: 1910, end: 1945, visStart: 1910, visEnd: 1945, color: "#8c4a3a" },
      { id: "kr-modern", label: "現代", short: "現代", start: 1945, end: 1999, visStart: 1945, visEnd: 1999, color: "#5b534a" }
    ]
  },
  "越南": {
    label: "越南時期",
    periods: [
      { id: "lac", label: "雒越", short: "雒越", start: -1046, end: -204, visStart: -1046, visEnd: -204, color: "#5a6b3d", note: "雒越社會更早；此處向前延伸以配合全站時間軸。" },
      { id: "nanyue", label: "南越", short: "南越", start: -204, end: -111, visStart: -204, visEnd: -111, color: "#8c4a3a" },
      { id: "bac-thuoc", label: "北屬", short: "北屬", start: -111, end: 938, visStart: -111, visEnd: 938, color: "#4a5d7a" },
      { id: "early-indep", label: "獨立初期", short: "吳丁黎", start: 938, end: 1009, visStart: 938, visEnd: 1009, color: "#b07a1a", note: "吳權 938 年擊敗南漢，其後為丁朝、前黎朝，至 1009 年李朝建立。" },
      { id: "ly", label: "李", short: "李", start: 1009, end: 1225, visStart: 1009, visEnd: 1225, color: "#2b6b62" },
      { id: "tran", label: "陳", short: "陳", start: 1225, end: 1407, visStart: 1225, visEnd: 1407, color: "#7a5c8a", note: "1400 年短暫為胡朝，1407 年入屬明時期。" },
      { id: "ming-occ", label: "屬明", short: "屬明", start: 1407, end: 1428, visStart: 1407, visEnd: 1428, color: "#8c4a3a" },
      { id: "le", label: "後黎", short: "後黎", start: 1428, end: 1788, visStart: 1428, visEnd: 1788, color: "#3d5a80" },
      { id: "tay-son", label: "西山", short: "西山", start: 1788, end: 1802, visStart: 1788, visEnd: 1802, color: "#9e4b6e" },
      { id: "nguyen", label: "阮", short: "阮", start: 1802, end: 1945, visStart: 1802, visEnd: 1945, color: "#4a3b2f" },
      { id: "vn-modern", label: "現代", short: "現代", start: 1945, end: 1999, visStart: 1945, visEnd: 1999, color: "#5b534a" }
    ]
  },
  "臺灣": {
    label: "臺灣時期",
    periods: [
      { id: "tw-paleolithic", label: "舊石器", short: "舊石", start: -28000, end: -5001, visStart: -28000, visEnd: -5000, color: "#6b5344", note: "舊石器時代。左緣取距今約三萬年（西元前 28000 年）的常用估計，右緣為西元前 5000 年。不是大坌坑、卑南、十三行等個別文化。" },
      { id: "tw-neolithic", label: "新石器", short: "新石", start: -5000, end: 0, visStart: -5000, visEnd: 1, color: "#c4a574", note: "新石器時代，西元前 5000 年至西元前後（約兩千年前）。" },
      { id: "tw-metal", label: "金屬器", short: "金屬", start: 1, end: 1623, visStart: 1, visEnd: 1624, color: "#5a6b3d", note: "金屬器時代，約兩千年前至 1624 年大航海時代開始。右緣與荷西相接。" },
      { id: "dutch-spanish", label: "荷西", short: "荷西", start: 1624, end: 1662, visStart: 1624, visEnd: 1662, color: "#3d5a80", note: "荷蘭 1624–1662 年，西班牙 1626–1642 年據北部。" },
      { id: "koxinga", label: "明鄭", short: "明鄭", start: 1662, end: 1683, visStart: 1662, visEnd: 1683, color: "#8c4a3a" },
      { id: "qing-tw", label: "清", short: "清", start: 1683, end: 1895, visStart: 1683, visEnd: 1895, color: "#3e4a59" },
      { id: "jp-tw", label: "日治", short: "日治", start: 1895, end: 1945, visStart: 1895, visEnd: 1945, color: "#9e2b1f" },
      { id: "tw-postwar", label: "戰後", short: "戰後", start: 1945, end: 1999, visStart: 1945, visEnd: 1999, color: "#2b6b62" }
    ]
  },
  "蒙古": {
    label: "蒙古時期",
    periods: [
      { id: "xiongnu", label: "匈奴", short: "匈奴", start: -1046, end: 155, visStart: -1046, visEnd: 155, color: "#8c4a3a", note: "匈奴名號較晚見於記載；此處向前延伸以配合全站時間軸，起迄為示意分段。" },
      { id: "xianbei", label: "鮮卑／柔然", short: "柔然", start: 155, end: 552, visStart: 155, visEnd: 552, color: "#6b5344" },
      { id: "turk", label: "突厥", short: "突厥", start: 552, end: 744, visStart: 552, visEnd: 744, color: "#b07a1a" },
      { id: "uyghur", label: "回鶻", short: "回鶻", start: 744, end: 840, visStart: 744, visEnd: 840, color: "#7a5c8a" },
      { id: "fragment", label: "分裂", short: "分裂", start: 840, end: 1206, visStart: 840, visEnd: 1206, color: "#5a6b3d", note: "回鶻汗國亡後至成吉思汗統一以前的草原諸部時期。" },
      { id: "mongol", label: "大蒙古國", short: "蒙古", start: 1206, end: 1368, visStart: 1206, visEnd: 1368, color: "#4a3b2f" },
      { id: "northern-yuan", label: "北元", short: "北元", start: 1368, end: 1635, visStart: 1368, visEnd: 1636, color: "#3d5a80" },
      { id: "qing-mn", label: "清屬", short: "清屬", start: 1636, end: 1911, visStart: 1636, visEnd: 1911, color: "#3e4a59", note: "後金／清 1636 年改國號，喀爾喀於 1691 年臣屬。" },
      { id: "mn-modern", label: "現代", short: "現代", start: 1911, end: 1999, visStart: 1911, visEnd: 1999, color: "#2b6b62" }
    ]
  }
};
