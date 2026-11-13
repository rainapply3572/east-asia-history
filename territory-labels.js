(() => {
  function centroidOf(feature) {
    const geom = feature && feature.geometry;
    if (!geom || !geom.coordinates) return null;
    const pts = [];
    if (geom.type === "Polygon") {
      if (geom.coordinates[0]) pts.push(...geom.coordinates[0]);
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((poly) => {
        if (poly && poly[0]) pts.push(...poly[0]);
      });
    }
    const valid = pts.filter((p) => p && p.length >= 2);
    if (!valid.length) return null;
    const lon = valid.reduce((s, p) => s + p[0], 0) / valid.length;
    const lat = valid.reduce((s, p) => s + p[1], 0) / valid.length;
    return { lon, lat };
  }

  function inTaiwan(lon, lat) {
    return lon >= 119.3 && lon <= 122.3 && lat >= 21.7 && lat <= 25.5;
  }

  function inRyukyu(lon, lat) {
    return lon >= 122.5 && lon <= 131.5 && lat >= 23.8 && lat <= 29.5;
  }

  const TAIWAN_NAMES = new Set(["Taiwan", "Taiwanese Tribes", "Dutch Formosa", "Middag Kingdom"]);
  const RYUKYU_NAMES = new Set(["Ryukyu", "Chūzan", "Hokuzan", "Nanzan"]);

  function taiwanOverride(year) {
    if (year >= 1945) return pack("中華民國", "roc", 2);
    if (year >= 1895) return pack("日治臺灣", "taiwan-jp", 2);
    if (year >= 1683) return pack("清", "qing", 2);
    if (year >= 1662) return pack("鄭氏", "zheng", 2);
    if (year >= 1624) return pack("荷屬臺灣", "taiwan-dutch", 2);
    return pack("臺灣各族", "taiwan", 2);
  }

  function ryukyuOverride(year, name) {
    if (year >= 1879) return pack("日本（沖繩）", "japan", 3);
    if (year >= 1429) return pack("琉球國", "ryukyu", 3);
    if (name === "Chūzan") return pack("中山", "ryukyu", 3);
    if (name === "Hokuzan") return pack("北山", "ryukyu", 3);
    if (name === "Nanzan") return pack("南山", "ryukyu", 3);
    return pack("琉球", "ryukyu", 3);
  }

  function hkOverride(year) {
    if (year >= 1997) return pack("香港（中華人民共和國）", "prc", 3);
    if (year >= 1842) return pack("英屬香港", "hk", 3);
    if (year >= 1644) return pack("清", "qing", 3);
    if (year >= 1368) return pack("明", "ming", 3);
    return pack("香港", "hk", 3);
  }

  function pack(label, colorKey, priority) {
    return { label, colorKey, priority };
  }

  function chinaMain(year) {
    if (year >= 1949) return pack("中華人民共和國", "prc", 0);
    if (year >= 1912) return pack("中華民國", "roc", 0);
    if (year >= 1644) return pack("清", "qing", 0);
    if (year >= 1368) return pack("明", "ming", 0);
    if (year >= 1271) return pack("元", "yuan", 0);
    if (year >= 1127) return pack("南宋", "song", 0);
    if (year >= 960) return pack("北宋", "song", 0);
    if (year >= 907) return pack("五代十國", "five", 0);
    if (year >= 618) return pack("唐", "tang", 0);
    if (year >= 581) return pack("隋", "sui", 0);
    if (year >= 420) return pack("南朝", "southern", 0);
    if (year >= 317) return pack("東晉", "jin", 0);
    if (year >= 280) return pack("西晉", "jin", 0);
    if (year >= 220) return pack("三國", "sanguo", 0);
    if (year >= 25) return pack("東漢", "han", 0);
    if (year >= 9) return pack("新", "xin", 0);
    if (year >= -202) return pack("西漢", "han", 0);
    if (year >= -221) return pack("秦", "qin", 0);
    return pack("秦", "qin", 0);
  }

  function japanOverride(year) {
    if (year >= 1952) return pack("日本", "japan", 2);
    if (year >= 1945) return pack("日本（盟軍佔領下）", "japan", 2);
    if (year >= 1868) return pack("大日本帝國", "japan", 2);
    if (year >= 1603) return pack("江戶幕府", "japan", 2);
    if (year >= 1467) return pack("日本（戰國時代）", "japan", 2);
    if (year >= 1336) return pack("室町幕府", "japan", 2);
    if (year >= 1185) return pack("鎌倉幕府", "japan", 2);
    if (year >= 794) return pack("平安時代", "japan", 2);
    if (year >= 710) return pack("奈良時代", "japan", 2);
    if (year >= 300) return pack("大和", "japan", 2);
    return pack("彌生", "japan", 2);
  }

  function koreaName(year, name) {
    if (name === "Korea, Republic of" || name === "Korea (USA)") {
      if (year >= 1948) return pack("大韓民國", "rok", 2);
      return pack("朝鮮南部（美軍佔領）", "rok", 2);
    }
    if (name === "Korea, Democratic People's Republic of" || name === "Korea (USSR)") {
      if (year >= 1948) return pack("朝鮮民主主義人民共和國", "dprk", 2);
      return pack("朝鮮北部（蘇軍佔領）", "dprk", 2);
    }
    if (name === "Koguryo") {
      if (year >= 698) return pack("渤海", "balhae", 2);
      if (year >= 668) return pack("舊高句麗之地", "koguryo", 2);
      return pack("高句麗", "koguryo", 2);
    }
    if (name === "Paekche") {
      if (year >= 660) return pack("統一新羅", "silla", 2);
      return pack("百濟", "paekche", 2);
    }
    if (name === "Silla" || name === "Silia") {
      if (year >= 918) return pack("高麗", "goryeo", 2);
      if (year >= 668) return pack("統一新羅", "silla", 2);
      return pack("新羅", "silla", 2);
    }
    if (name === "Gaya") return pack("伽倻", "gaya", 2);
    if (name === "Balhae" || name === "Parhae") {
      if (year >= 926) return pack("遼", "liao", 2);
      return pack("渤海", "balhae", 2);
    }
    if (name === "Goryeo") return pack("高麗", "goryeo", 2);
    // generic Korea
    if (year >= 1910 && year < 1945) return pack("日治朝鮮", "korea-jp", 2);
    if (year >= 1897 && year < 1910) return pack("大韓帝國", "korea", 2);
    if (year >= 1392) return pack("朝鮮", "korea", 2);
    if (year >= 918) return pack("高麗", "goryeo", 2);
    return pack("朝鮮", "korea", 2);
  }

  function vietOverride(year, name) {
    if (name === "Funan") return pack("扶南", "funan", 2);
    if (name === "Chen-La") return pack("真臘", "chenla", 2);
    if (name === "Champa" || name === "Champa City States") return pack("占城", "champa", 3);
    if (name === "French Indochina" || name === "French Indo-China") {
      return pack("法屬印度支那", "indochina", 2);
    }
    if (name === "Cochin China" || name === "Cochin") {
      if (year >= 1862) return pack("法屬交趾支那", "indochina", 2);
      if (year >= 1802) return pack("越南（阮朝）", "vietnam", 2);
      if (year >= 1778) return pack("西山朝", "vietnam", 2);
      return pack("廣南（阮主）", "vietnam", 2);
    }
    if (name === "Tonkin") {
      if (year >= 1945) return pack("越南民主共和國", "vietnam", 2);
      return pack("東京（北圻）", "vietnam", 2);
    }
    if (name === "Vietnam") {
      if (year >= 1976) return pack("越南", "vietnam", 2);
      if (year >= 1954) return pack("越南（南北分治）", "vietnam", 2);
      if (year >= 1945) return pack("越南", "vietnam", 2);
      return pack("越南", "vietnam", 2);
    }
    // Annam, Đại Việt
    if (year >= 1887) return pack("法屬印度支那", "indochina", 2);
    if (year >= 1883) return pack("越南（法護阮朝）", "vietnam", 2);
    if (year >= 1802) return pack("越南（阮朝）", "vietnam", 2);
    if (year >= 1778) return pack("西山朝", "vietnam", 2);
    if (year >= 1428) return pack("大越（後黎）", "vietnam", 2);
    if (year >= 1407) return pack("明屬交趾", "vietnam", 2);
    if (year >= 1400) return pack("大越（胡朝）", "vietnam", 2);
    if (year >= 1225) return pack("大越（陳朝）", "vietnam", 2);
    if (year >= 1009) return pack("大越（李朝）", "vietnam", 2);
    if (year >= 980) return pack("大瞿越（前黎）", "vietnam", 2);
    if (year >= 968) return pack("大瞿越（丁朝）", "vietnam", 2);
    return pack("安南", "vietnam", 2);
  }

  const NAME_FALLBACKS = {
    "Luva": "Luva",
    "Kamarupa": "迦摩縷波",
    "Rajput Clans and Small States": "拉杰普特諸邦",
    "minor Hindu and Buddhist states": "印度教／佛教小邦",
    "minor Hindu and Buddhist kingdoms": "印度教／佛教小邦",
    "minor Hindu kingdoms": "印度教小邦",
    "minor states under Indian influence": "受印度影響的小邦",
    "Hindu kingdoms": "印度教諸邦",
    "Hindu kingdoms and republics": "印度教諸邦與共和國",
    "Hindu states": "印度教諸邦",
    "Paleo-Siberian hunter-gatherers": "古西伯利亞採集狩獵群體",
    "Iron Age chieftainships": "鐵器時代酋邦",
    "Kimek-Kipchak khaganate": "奇馬克—欽察",
    "Cuman-Kipchak confederation": "庫曼—欽察",
    "central Asian khanates": "中亞汗國",
    "Quazaq Khanate": "哈薩克汗國",
    "Khiva Khanate": "希瓦汗國",
    "Bukara Khanate": "布哈拉汗國",
    "Oirat Confederation": "瓦剌／衛拉特",
    "Hövsgöl Nuur": "庫蘇古爾湖一帶",
    "White Horde": "白帳汗國",
    "Chagatai Khanate": "察合台汗國",
    "Haripunjaya": "訶梨朋闍耶",
    "Harapunchai": "訶梨朋闍耶",
    "Dvaravati": "墮羅缽底",
    "Sukhothai": "素可泰",
    "Kingdom of Sukhotai": "素可泰",
    "Ayutthaya": "大城王朝",
    "Rattanakosin Kingdom": "曼谷王朝",
    "Lan Na": "蘭納",
    "Lavo": "羅渦",
    "Lopburi Kingdom": "華富里",
    "Pagan": "蒲甘",
    "Bagan": "蒲甘",
    "Kingdom of Pagan": "蒲甘",
    "Ava": "阿瓦",
    "Pegu": "勃固",
    "Shan states": "撣邦諸土司",
    "Burmese kingdoms": "緬甸諸邦",
    "Burma": "緬甸",
    "Arakan": "若開",
    "Laos": "寮國",
    "Laotian states": "寮國諸邦",
    "Cambodia": "柬埔寨",
    "Khmer Empire": "高棉帝國",
    "Siam": "暹羅",
    "Thailand": "泰國",
    "Thai Kingdoms": "泰族諸邦",
    "Thai": "泰族諸部",
    "Mon state": "孟族邦國",
    "Mon States": "孟族邦國",
    "Mon-Khmer": "孟—高棉各族",
    "Malays": "馬來各族",
    "Malay": "馬來諸邦",
    "Malaya": "馬來亞",
    "Malaysia": "馬來西亞",
    "Brunei": "汶萊",
    "Aceh": "亞齊",
    "Srivijaya Empire": "室利佛逝",
    "Dutch East Indies": "荷屬東印度",
    "Netherlands Indies": "荷屬東印度",
    "Indonesia": "印度尼西亞",
    "Philippines": "菲律賓",
    "Ainu": "阿伊努",
    "Ainus": "阿伊努",
    "Tungus": "通古斯各族",
    "Tungusic Tribes": "通古斯各族",
    "Siberians": "西伯利亞各族",
    "Uyghurs": "回紇／回鶻",
    "Göktürks": "突厥",
    "Western Gokturk Khaganate": "西突厥",
    "Oghuz Turks": "烏古斯突厥",
    "Turcik tribes": "突厥諸部",
    "Karluks": "葛邏祿",
    "Kurykans": "骨利幹",
    "Zhangzhung Kingdom": "象雄",
    "Nan Chao": "南詔",
    "Nan-Zhao": "南詔",
    "Xiongnu": "匈奴",
    "Southern Xiongnu": "南匈奴",
    "Yuezhi": "月氏",
    "Yueban": "悅般",
    "Min-Yue": "閩越",
    "Nan-Yue": "南越",
    "Hainan": "海南",
    "Xinjiang": "新疆",
    "Mongolia": "蒙古",
    "Mongols": "蒙古各部",
    "Mongol Empire": "蒙古帝國",
    "Ruanruan": "柔然",
    "Han Zhao": "漢趙（前趙）",
    "Northern Liang": "北涼",
    "Sixteen Kingdoms": "十六國",
    "Toba Wei": "北魏",
    "Russia": "俄羅斯",
    "Russian Empire": "俄羅斯帝國",
    "Tsardom of Muscovy": "莫斯科沙皇國",
    "USSR": "蘇聯",
    "Kazakhstan": "哈薩克",
    "Kyrgyzstan": "吉爾吉斯",
    "Tajikistan": "塔吉克",
    "Uzbekistan": "烏茲別克",
    "Afghanistan": "阿富汗",
    "Nepal": "尼泊爾",
    "Bhutan": "不丹",
    "India": "印度",
    "Pakistan": "巴基斯坦",
    "Bangladesh": "孟加拉國",
    "Sri Lanka": "斯里蘭卡",
    "Ceylon": "錫蘭",
    "Ceylon (Dutch)": "荷屬錫蘭",
    "Guam": "關島",
    "Saipan": "塞班",
    "Kuril Islands": "千島群島",
    "Sakhalin (RU)": "庫頁島（俄國）",
  };

  function overridePolity(feature, year) {
    const props = (feature && feature.properties) || {};
    const name = props.NAME || "";
    const c = centroidOf(feature) || { lon: 0, lat: 0 };
    const { lon, lat } = c;

    if (TAIWAN_NAMES.has(name) || inTaiwan(lon, lat)) return taiwanOverride(year);
    if (name === "Hong Kong") return hkOverride(year);
    if (RYUKYU_NAMES.has(name) || inRyukyu(lon, lat)) return ryukyuOverride(year, name);

    if (name === "Zhou states") {
      if (year >= -221 && year < -202) return pack("秦", "qin", 0);
      return pack("周朝列國", "zhou", 1);
    }
    if (name === "Qin" || name === "Yue") {
      if (name === "Yue" && year >= -221 && year < -202) return pack("秦", "qin", 0);
      if (name === "Yue") return pack("越", "yue", 1);
      if (year >= -221 && year < -202) return pack("秦", "qin", 0);
      if (year < -221) return pack("秦", "qin", 1);
      return chinaMain(year);
    }

    if (name === "Han" || name === "Han Empire") return chinaMain(year);

    if (name === "Jin") {
      if (year >= 317) return pack("東晉", "jin", 0);
      if (year >= 280) return pack("西晉", "jin", 0);
      return pack("晉", "jin", 0);
    }
    if (name === "Jin Empire") {
      if (year >= 581) return pack("隋", "sui", 0);
      if (year >= 557) return pack("陳", "southern", 0);
      if (year >= 502) return pack("梁", "southern", 0);
      if (year >= 479) return pack("南齊", "southern", 0);
      if (year >= 420) return pack("劉宋", "southern", 0);
      return pack("南朝", "southern", 0);
    }

    if (name === "Han Zhao") return pack("漢趙（前趙）", "han-zhao", 1);
    if (name === "Northern Liang") return pack("北涼", "northern-liang", 1);
    if (name === "Sixteen Kingdoms") return pack("十六國", "sixteen", 1);
    if (name === "Toba Wei") {
      if (year >= 581) return pack("隋", "sui", 0);
      if (year >= 557) return pack("北周／北齊", "nwei", 1);
      if (year >= 535) return pack("東魏／西魏", "nwei", 1);
      return pack("北魏", "nwei", 0);
    }
    if (name === "Ruanruan") return pack("柔然", "ruanruan", 2);

    if (name === "Sui Empire" || name === "Tang Empire") return chinaMain(year);

    if (name === "Song Empire") return chinaMain(year);

    if (name === "Liao" || name === "Khitans") {
      if (year >= 1115 && year < 1235) return pack("金", "jurchen", 1);
      if (year >= 907) return pack("遼", "liao", 1);
      return pack("契丹", "liao", 1);
    }
    if (name === "Xixia") {
      if (year >= 1228) return year >= 1271 ? pack("元", "yuan", 1) : pack("蒙古帝國", "mongol", 1);
      if (year >= 1038) return pack("西夏", "xixia", 1);
      return pack("黨項／夏州", "xixia", 1);
    }

    if (name === "Mongol Empire" || name === "Mongols") {
      if (year >= 1271) return pack("元", "yuan", 0);
      if (year >= 1206) return pack("蒙古帝國", "mongol", 0);
      return pack("蒙古各部", "mongol", 2);
    }
    if (name === "Great Khanate") {
      if (year >= 1368) return pack("明", "ming", 0);
      if (year >= 1271) return pack("元", "yuan", 0);
      return pack("大蒙古國", "mongol", 0);
    }
    if (name === "Oirat Confederation") return pack("瓦剌／衛拉特", "oirat", 2);
    if (name === "Mongolia") {
      if (year >= 1992) return pack("蒙古國", "mongolia", 2);
      if (year >= 1924) return pack("蒙古人民共和國", "mongolia", 2);
      if (year >= 1911) return pack("外蒙古（博克多汗國）", "mongolia", 2);
      return pack("蒙古", "mongolia", 2);
    }

    if (name === "Ming Empire" || name === "Ming Chinese Empire") {
      if (year >= 1644) return pack("清", "qing", 0);
      return pack("明", "ming", 0);
    }
    if (name === "Post-Ming Warlords") {
      if (year >= 1683) return pack("清", "qing", 0);
      if (year >= 1673) return pack("三藩", "nanming", 1);
      if (year >= 1662) return pack("南明餘部", "nanming", 1);
      return pack("南明餘部", "nanming", 1);
    }
    if (name === "Manchu Empire" || name === "Qing Empire") {
      if (year >= 1912) return pack("中華民國", "roc", 0);
      if (year >= 1644) return pack("清", "qing", 0);
      return pack("後金／清", "qing", 0);
    }
    if (name === "China" || name === "Chinese Warlords" || name === "Chinese warlords") {
      return chinaMain(year);
    }
    if (name === "Manchuria") {
      if (year >= 1949) return pack("中華人民共和國（東北）", "prc", 1);
      if (year >= 1945) return pack("中國東北", "roc", 1);
      if (year >= 1932) return pack("滿洲國", "manchukuo", 1);
      return pack("中國東北", "roc", 1);
    }
    if (name === "Xinjiang") {
      if (year >= 1949) return pack("中華人民共和國（新疆）", "prc", 1);
      return pack("新疆", "xinjiang", 1);
    }
    if (name === "Tibet" || name === "Tibetan Empire" || name === "Tufan Empire") {
      if (year >= 1951) return pack("西藏（中華人民共和國）", "prc", 2);
      if (name === "Tibetan Empire" || name === "Tufan Empire" || (year >= 618 && year <= 842)) {
        return pack("吐蕃", "tibet", 2);
      }
      if (year >= 1912 && year < 1951) return pack("西藏", "tibet", 2);
      return pack("西藏諸部", "tibet", 2);
    }
    if (name === "Zhangzhung Kingdom") return pack("象雄", "tibet", 3);
    if (name === "Hainan") {
      if (year >= 1949) return pack("中華人民共和國（海南）", "prc", 3);
      if (year >= 1912) return pack("中華民國（海南）", "roc", 3);
      if (year >= 1644) return pack("清", "qing", 3);
      if (year >= 1368) return pack("明", "ming", 3);
      return pack("海南", "hainan", 3);
    }

    const japanNames = new Set([
      "Yayoi", "Yamato", "Japan", "Imperial Japan", "Imperial Japan (Fujiwara)",
      "Shogun Japan (Kamakura)", "Japan (Warring States)", "Tokugawa shogunate",
      "Empire of Japan", "Japan (USA)",
    ]);
    if (japanNames.has(name)) return japanOverride(year);
    if (name === "Ainu" || name === "Ainus") return pack("阿伊努", "ainu", 3);

    const koreaNames = new Set([
      "Koguryo", "Paekche", "Silla", "Silia", "Gaya", "Balhae", "Parhae", "Goryeo",
      "Korea", "Korea (USA)", "Korea (USSR)",
      "Korea, Republic of", "Korea, Democratic People's Republic of",
    ]);
    if (koreaNames.has(name)) return koreaName(year, name);

    const vietNames = new Set([
      "Funan", "Chen-La", "Champa", "Champa City States", "Annam", "Đại Việt",
      "Vietnam", "Tonkin", "Cochin China", "Cochin",
      "French Indochina", "French Indo-China",
    ]);
    if (vietNames.has(name)) return vietOverride(year, name);

    if (name === "Nan Chao" || name === "Nan-Zhao") return pack("南詔", "nanzhao", 3);

    if (name === "White Russia" || name === "Far Eastern SSR") {
      if (year >= 1922) return pack("蘇聯", "ussr", 3);
      if (name === "Far Eastern SSR") return pack("遠東共和國", "ussr", 3);
      return pack("蘇聯", "ussr", 3);
    }
    if (name === "USSR") return pack("蘇聯", "ussr", 3);

    const fallback = NAME_FALLBACKS[name] || props.NAME_ZH || name;
    const colorKey = props.COLOR || name;
    // Neighbors around EA get mid priority, far ones lower
    const neighbor = /南詔|吐蕃|西藏|匈奴|突厥|回|契丹|瓦剌|蒙古|阿伊努|琉球|蒲甘|高棉|真臘|占城|暹羅|緬|寮|柬|扶南|墮羅|蘭納|大城|素可泰/.test(fallback);
    return pack(fallback, colorKey, neighbor ? 3 : 4);
  }

  window.overridePolity = overridePolity;
  window.territoryCentroid = centroidOf;
})();
