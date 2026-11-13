(() => {
  const YEAR_MIN = -1046;
  const YEAR_MAX = 2020;
  const REGIONS = ["中國", "日本", "朝鮮半島", "臺灣", "蒙古", "越南"];
  const CATEGORIES = ["政治", "戰爭", "文化", "外交", "宗教", "科技", "經濟", "社會"];
  const CATEGORY_COLORS = {
    "政治": "#9e2b1f",
    "戰爭": "#3e4a59",
    "文化": "#2b6b62",
    "外交": "#b07a1a",
    "宗教": "#6b3fa0",
    "科技": "#1f6b8a",
    "經濟": "#8a5a12",
    "社會": "#5a6b2b",
  };
  const POLITY_COLORS = {
    qin: "#c4a464", han: "#9e2b1f", zhou: "#7a6240", yue: "#4a7a62",
    sui: "#a05a28", tang: "#b54a3c", song: "#c47a3a", liao: "#5a6b8a",
    xixia: "#6b5a3a", mongol: "#3d5a4c", ming: "#8b1e1e", qing: "#2c4a6e",
    china: "#c0392b", warlords: "#6e4a3a", nanming: "#8a4a4a",
    japan: "#8e3a59", ainu: "#5a6e5a",
    koguryo: "#3d5c4e", paekche: "#6a4c8a", silla: "#2e6b6b", gaya: "#4a6b4a",
    balhae: "#3a5a6b", goryeo: "#3a5f8a", korea: "#2f5d8a", rok: "#1f4e8a", dprk: "#6b2a2a",
    vietnam: "#2d6a4f", indochina: "#3a6a8a", funan: "#4a7a6a", chenla: "#3a6b58", champa: "#8a5a3a",
    taiwan: "#c45c26", "taiwan-dutch": "#d4a017", middag: "#7a5c2e",
    ryukyu: "#4a7a8a", hk: "#8a3040",
    xiongnu: "#6b5330", gokturk: "#4a5a3a", uyghur: "#5a4a3a",
    tibet: "#5a4e6e", nanzhao: "#6b4a3a", oirat: "#3f5c50", mongolia: "#3d5a4c",
    russia: "#3a4a62", ussr: "#6b2a2a", khmer: "#8a4a2a", cambodia: "#7a3a3a",
    ayutthaya: "#8a6030", siam: "#a06030",
    yuan: "#3d5a4c", prc: "#c0392b", roc: "#1b4f8a", xin: "#6b3a3a",
    sanguo: "#5a3a4a", five: "#8a5a40", southern: "#7a4a50", nwei: "#4a5a6b",
    jurchen: "#5a3a3a", zheng: "#9b3a1f", "taiwan-jp": "#8e3a59",
    manchukuo: "#6b4a2a", "korea-jp": "#8e3a59", xinjiang: "#6b5a3a",
    sixteen: "#6a5a48", "northern-liang": "#6b5a3a", ruanruan: "#5a4a38",
    hainan: "#8a4a40",
  };
  const PLAY_TOAST_MS = 5000;
  const MAX_OPEN_TOASTS = 5;
  const BASE_TICK_MS = 220;

  const state = {
    events: [],
    yearStart: YEAR_MIN,
    yearEnd: YEAR_MAX,
    regions: new Set(REGIONS),
    categories: new Set(CATEGORIES),
    selectedId: null,
    map: null,
    cluster: null,
    markersById: new Map(),
    playing: false,
    playTimer: null,
    playSpeed: 1,
    lastPlayYear: null,
    showTerritories: true,
    territoryLayer: null,
    territoryPane: null,
    currentSnapshotYear: null,
    currentLabelYear: null,
    territoryAnim: null,
    territoryOutgoing: [],
    toastQueue: [],
    openToasts: [],
    showPlayToasts: true,
  };

  const els = {
    regionFilters: document.getElementById("regionFilters"),
    categoryFilters: document.getElementById("categoryFilters"),
    eventList: document.getElementById("eventList"),
    listCount: document.getElementById("listCount"),
    rangeText: document.getElementById("rangeText"),
    yearStart: document.getElementById("yearStart"),
    yearEnd: document.getElementById("yearEnd"),
    sliderFill: document.getElementById("sliderFill"),
    resetRange: document.getElementById("resetRange"),
    playBtn: document.getElementById("playBtn"),
    playSpeed: document.getElementById("playSpeed"),
    detail: document.getElementById("detail"),
    detailClose: document.getElementById("detailClose"),
    detailTitle: document.getElementById("detailTitle"),
    detailCategory: document.getElementById("detailCategory"),
    detailRegion: document.getElementById("detailRegion"),
    detailYear: document.getElementById("detailYear"),
    detailLocation: document.getElementById("detailLocation"),
    detailRegionFact: document.getElementById("detailRegionFact"),
    detailCategoryFact: document.getElementById("detailCategoryFact"),
    detailDesc: document.getElementById("detailDesc"),
    menuToggle: document.getElementById("menuToggle"),
    backdrop: document.getElementById("backdrop"),
    legend: document.getElementById("legend"),
    territoryToggle: document.getElementById("territoryToggle"),
    territoryYear: document.getElementById("territoryYear"),
    territoryList: document.getElementById("territoryList"),
    territoryNote: document.getElementById("territoryNote"),
    territoryExpand: document.getElementById("territoryExpand"),
    territoryMajors: document.getElementById("territoryMajors"),
    territoryDetails: document.getElementById("territoryDetails"),
    territoryCite: document.getElementById("territoryCite"),
    territoryPanel: document.getElementById("territoryPanel"),
    playToastToggle: document.getElementById("playToastToggle"),
  };

  function formatYear(year) {
    if (year < 0) return `西元前 ${Math.abs(year)} 年`;
    return `西元 ${year} 年`;
  }

  function yearPercent(year) {
    return ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;
  }

  function visibleEvents() {
    return state.events.filter((event) => {
      if (event.year < state.yearStart || event.year > state.yearEnd) return false;
      if (!state.categories.has(event.category)) return false;
      const regions = event.regions && event.regions.length ? event.regions : [event.region];
      return regions.some((region) => state.regions.has(region));
    });
  }

  function renderFilters() {
    const makeChip = (label, pressed, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(pressed));
      button.addEventListener("click", onClick);
      return button;
    };

    els.regionFilters.replaceChildren();
    REGIONS.forEach((region) => {
      els.regionFilters.appendChild(
        makeChip(region, state.regions.has(region), () => {
          if (state.regions.has(region) && state.regions.size === 1) return;
          if (state.regions.has(region)) state.regions.delete(region);
          else state.regions.add(region);
          renderFilters();
          refresh();
        })
      );
    });

    els.categoryFilters.replaceChildren();
    CATEGORIES.forEach((category) => {
      els.categoryFilters.appendChild(
        makeChip(category, state.categories.has(category), () => {
          if (state.categories.has(category) && state.categories.size === 1) return;
          if (state.categories.has(category)) state.categories.delete(category);
          else state.categories.add(category);
          renderFilters();
          refresh();
        })
      );
    });
  }

  function renderLegend() {
    const body = CATEGORIES.map((category) => {
      return `<div><i style="background:${CATEGORY_COLORS[category]}"></i>${category}</div>`;
    }).join("");
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    els.legend.classList.toggle("is-open", !narrow);
    els.legend.innerHTML =
      '<button type="button" class="legend-toggle" id="legendToggle" aria-expanded="' +
      String(!narrow) + '">圖例</button><div class="legend-body">' + body + "</div>";
  }

  function renderRange() {
    els.rangeText.textContent = `${formatYear(state.yearStart)} ─ ${formatYear(state.yearEnd)}`;
    const start = yearPercent(state.yearStart);
    const end = yearPercent(state.yearEnd);
    els.sliderFill.style.left = `${start}%`;
    els.sliderFill.style.right = `${100 - end}%`;
    els.yearStart.value = String(state.yearStart);
    els.yearEnd.value = String(state.yearEnd);
  }

  function markerIcon(event, active) {
    const color = CATEGORY_COLORS[event.category] || "#9e2b1f";
    const size = active ? 20 : 16;
    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div class="marker-dot${active ? " active" : ""}" style="background:${color};width:${size}px;height:${size}px"></div>`,
    });
  }

  function addMarker(event) {
    const marker = L.marker([event.lat, event.lng], {
      icon: markerIcon(event, event.id === state.selectedId),
      title: `${formatYear(event.year)}　${event.title}`,
      riseOnHover: true,
    });
    marker.bindPopup(`<strong>${event.title}</strong><br>${formatYear(event.year)}　${event.location}`);
    marker.on("click", () => selectEvent(event.id, { fromMap: true }));
    state.markersById.set(event.id, marker);
    state.cluster.addLayer(marker);
    return marker;
  }

  function renderMarkers(events) {
    state.cluster.clearLayers();
    state.markersById.clear();
    events.forEach((event) => addMarker(event));
  }

  function syncMarkers(events) {
    const keep = new Set(events.map((event) => event.id));
    for (const [id, marker] of state.markersById) {
      if (!keep.has(id)) {
        state.cluster.removeLayer(marker);
        state.markersById.delete(id);
      }
    }
    events.forEach((event) => {
      if (!state.markersById.has(event.id)) addMarker(event);
    });
  }

  function renderList(events) {
    els.listCount.textContent = `目前範圍內共 ${events.length} 件`;
    els.eventList.replaceChildren();

    if (!events.length) {
      const empty = document.createElement("li");
      empty.innerHTML = `<p class="sub" style="padding:12px">目前條件下沒有符合的事件，請調整年代或篩選。</p>`;
      els.eventList.appendChild(empty);
      return;
    }

    events.forEach((event) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "event-item" + (event.id === state.selectedId ? " active" : "");
      button.dataset.id = event.id;
      button.innerHTML = `
        <span class="year">${formatYear(event.year)}</span>
        <span>
          <span class="title">${event.title}</span>
          <span class="sub">${event.location} · ${event.region} · ${event.category}</span>
        </span>
      `;
      button.addEventListener("click", () => {
        selectEvent(event.id, { fromList: true });
        if (window.matchMedia("(max-width: 900px)").matches) {
          document.body.classList.remove("sidebar-open");
          els.menuToggle.setAttribute("aria-expanded", "false");
          els.backdrop.hidden = true;
        }
      });
      item.appendChild(button);
      els.eventList.appendChild(item);
    });
  }

  function openDetail(event) {
    els.detail.hidden = false;
    els.detailTitle.textContent = event.title;
    els.detailCategory.textContent = event.category;
    els.detailCategory.style.background = CATEGORY_COLORS[event.category];
    els.detailRegion.textContent = event.region;
    els.detailYear.textContent = formatYear(event.year);
    els.detailLocation.textContent = event.location;
    const regions = event.regions && event.regions.length ? event.regions.join("、") : event.region;
    els.detailRegionFact.textContent = regions;
    els.detailCategoryFact.textContent = event.category;
    els.detailDesc.textContent = event.description;
  }

  function closeDetail() {
    els.detail.hidden = true;
    state.selectedId = null;
    const events = visibleEvents();
    renderMarkers(events);
    renderList(events);
  }

  function selectEvent(id, { fromMap = false, fromList = false } = {}) {
    const event = state.events.find((item) => item.id === id);
    if (!event) return;
    state.selectedId = id;
    openDetail(event);

    const events = visibleEvents();
    renderList(events);
    renderMarkers(events);

    const marker = state.markersById.get(id);
    if (marker) {
      const targetZoom = Math.max(state.map.getZoom(), 6);
      state.cluster.zoomToShowLayer(marker, () => {
        marker.setIcon(markerIcon(event, true));
        if (!fromMap) marker.openPopup();
      });
      if (fromList) {
        state.map.flyTo([event.lat, event.lng], targetZoom, { duration: 0.6 });
      }
    }

    const active = els.eventList.querySelector(`[data-id="${id}"]`);
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function polityColor(key) {
    if (POLITY_COLORS[key]) return POLITY_COLORS[key];
    let hash = 0;
    const text = String(key || "");
    for (let i = 0; i < text.length; i += 1) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
    return `hsl(${hash % 360}, 42%, 42%)`;
  }

  function snapshotYearFor(year) {
    const data = window.TERRITORIES;
    if (!data || !data.years || !data.years.length) return null;
    let chosen = null;
    for (let i = 0; i < data.years.length; i += 1) {
      if (data.years[i] <= year) chosen = data.years[i];
      else break;
    }
    return chosen;
  }

  function decorateFeature(feature) {
    if (typeof window.overridePolity === "function") {
      return window.overridePolity(feature, state.yearEnd);
    }
    const zh = feature.properties.NAME_ZH || feature.properties.NAME;
    return { label: zh, colorKey: feature.properties.COLOR || feature.properties.NAME, priority: 4 };
  }

  const TERRITORY_ANIM_MS = 700;
  const TERRITORY_ANIM_FAST_MS = 300;

  function territoryAnimMs() {
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    if (state.playing && state.playSpeed >= 4) return TERRITORY_ANIM_FAST_MS;
    if (state.playing && state.playSpeed >= 2) return 450;
    return TERRITORY_ANIM_MS;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  }

  function normalizePolityName(feature) {
    const raw = String((feature && feature.properties && (feature.properties.NAME || feature.properties.NAME_ZH)) || "");
    return raw
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[‐‑–—_]/g, " ")
      .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function featureCentroidLatLng(feature, layer) {
    const c = typeof window.territoryCentroid === "function" ? window.territoryCentroid(feature) : null;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) return L.latLng(c.lat, c.lon);
    if (layer && layer.getBounds && layer.getBounds().isValid()) return layer.getBounds().getCenter();
    return L.latLng(35, 120);
  }

  function mapLatLngs(node, fn) {
    if (Array.isArray(node)) return node.map((child) => mapLatLngs(child, fn));
    return fn(node);
  }

  function scaleLatLngsAround(latlngs, centroid, scale, map) {
    const cpt = map.latLngToLayerPoint(centroid);
    return mapLatLngs(latlngs, (ll) => {
      const p = map.latLngToLayerPoint(ll);
      return map.layerPointToLatLng(L.point(
        cpt.x + (p.x - cpt.x) * scale,
        cpt.y + (p.y - cpt.y) * scale
      ));
    });
  }

  function isLatLng(node) {
    return !!(node && Number.isFinite(node.lat) && Number.isFinite(node.lng));
  }

  function asMultiPolygon(latlngs) {
    if (!latlngs || !latlngs.length) return [];
    if (isLatLng(latlngs[0])) return [[latlngs]];
    if (latlngs[0] && isLatLng(latlngs[0][0])) return [latlngs];
    return latlngs;
  }

  function applyLatLngs(layer, parts) {
    const typ = layer.feature && layer.feature.geometry && layer.feature.geometry.type;
    if (typ === "Polygon") layer.setLatLngs(parts[0] || []);
    else layer.setLatLngs(parts);
  }

  function ringCentroid(ring) {
    const pts = (ring || []).filter(isLatLng);
    if (!pts.length) return L.latLng(0, 0);
    let lat = 0;
    let lng = 0;
    pts.forEach((p) => { lat += p.lat; lng += p.lng; });
    return L.latLng(lat / pts.length, lng / pts.length);
  }

  function closeXY(pts) {
    if (pts.length > 1 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) {
      return pts.slice(0, -1);
    }
    return pts.slice();
  }

  function toXY(ring, map) {
    return closeXY((ring || []).filter(isLatLng).map((ll) => {
      const p = map.latLngToLayerPoint(ll);
      return { x: p.x, y: p.y };
    }));
  }

  function resampleXY(pts, count) {
    const src = pts && pts.length ? pts : [{ x: 0, y: 0 }];
    if (src.length === 1) return Array.from({ length: count }, () => ({ x: src[0].x, y: src[0].y }));
    const segs = [];
    let total = 0;
    for (let i = 0; i < src.length; i += 1) {
      const a = src[i];
      const b = src[(i + 1) % src.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, d, acc: total });
      total += d;
    }
    if (total === 0) return Array.from({ length: count }, () => ({ x: src[0].x, y: src[0].y }));
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const at = (i / count) * total;
      let seg = segs[segs.length - 1];
      for (let j = 0; j < segs.length; j += 1) {
        if (at <= segs[j].acc + segs[j].d) { seg = segs[j]; break; }
      }
      const u = seg.d === 0 ? 0 : (at - seg.acc) / seg.d;
      out.push({ x: seg.a.x + (seg.b.x - seg.a.x) * u, y: seg.a.y + (seg.b.y - seg.a.y) * u });
    }
    return out;
  }

  function alignRings(base, other) {
    const n = base.length;
    let bestOff = 0;
    let bestRev = false;
    let bestScore = Infinity;
    for (let rev = 0; rev < 2; rev += 1) {
      for (let off = 0; off < n; off += 1) {
        let score = 0;
        for (let i = 0; i < n; i += 1) {
          const j = rev ? (off - i + n) % n : (off + i) % n;
          const dx = base[i].x - other[j].x;
          const dy = base[i].y - other[j].y;
          score += dx * dx + dy * dy;
        }
        if (score < bestScore) {
          bestScore = score;
          bestOff = off;
          bestRev = !!rev;
        }
      }
    }
    return base.map((_, i) => {
      const j = bestRev ? (bestOff - i + n) % n : (bestOff + i) % n;
      return other[j];
    });
  }

  function xyToRing(xy, map) {
    const ring = xy.map((p) => map.layerPointToLatLng(L.point(p.x, p.y)));
    if (ring.length) ring.push(ring[0]);
    return ring;
  }

  function lerpRing(a, b, t) {
    return a.map((p, i) => L.latLng(
      p.lat + (b[i].lat - p.lat) * t,
      p.lng + (b[i].lng - p.lng) * t
    ));
  }

  function buildMorphPlan(oldLayer, newLayer, map) {
    const oldParts = asMultiPolygon(oldLayer.getLatLngs());
    const newParts = asMultiPolygon(newLayer.getLatLngs());
    if (!oldParts.length || !newParts.length) return null;
    if (oldParts.length > 12 || newParts.length > 12) return null;

    const used = new Set();
    const pairs = [];
    const oldOnly = [];
    oldParts.forEach((oldPoly) => {
      const oc = ringCentroid(oldPoly[0] || []);
      const ocPt = map.latLngToLayerPoint(oc);
      let bestJ = -1;
      let bestD = Infinity;
      newParts.forEach((newPoly, j) => {
        if (used.has(j)) return;
        const ncPt = map.latLngToLayerPoint(ringCentroid(newPoly[0] || []));
        const d = ocPt.distanceTo(ncPt);
        if (d < bestD) { bestD = d; bestJ = j; }
      });
      if (bestJ >= 0 && bestD < 260) {
        used.add(bestJ);
        pairs.push([oldPoly, newParts[bestJ]]);
      } else {
        oldOnly.push(oldPoly);
      }
    });
    const newOnly = newParts.filter((_, j) => !used.has(j));
    if (!pairs.length) return null;

    const typ = newLayer.feature && newLayer.feature.geometry && newLayer.feature.geometry.type;
    if (typ === "Polygon" && (pairs.length + oldOnly.length + newOnly.length) !== 1) return null;

    const morphPairs = pairs.map(([oldPoly, newPoly]) => {
      const ringCount = Math.max(oldPoly.length, newPoly.length);
      const rings = [];
      for (let r = 0; r < ringCount; r += 1) {
        const oldRing = oldPoly[r];
        const newRing = newPoly[r];
        if (oldRing && newRing && oldRing.length && newRing.length) {
          const count = Math.max(16, Math.min(72, Math.max(oldRing.length, newRing.length)));
          const aXY = resampleXY(toXY(oldRing, map), count);
          const bXY = alignRings(aXY, resampleXY(toXY(newRing, map), count));
          rings.push({ type: "morph", a: xyToRing(aXY, map), b: xyToRing(bXY, map) });
        } else if (newRing && newRing.length) {
          rings.push({ type: "grow", ring: newRing, centroid: ringCentroid(newRing) });
        } else if (oldRing && oldRing.length) {
          rings.push({ type: "shrink", ring: oldRing, centroid: ringCentroid(oldRing) });
        }
      }
      return rings;
    });
    return { morphPairs, oldOnly, newOnly };
  }

  function interpolateMorph(plan, t, map) {
    const parts = plan.morphPairs.map((rings) => rings.map((ring) => {
      if (ring.type === "morph") return lerpRing(ring.a, ring.b, t);
      if (ring.type === "grow") return scaleLatLngsAround(ring.ring, ring.centroid, Math.max(0.001, t), map);
      return scaleLatLngsAround(ring.ring, ring.centroid, Math.max(0.001, 1 - t), map);
    }));
    plan.oldOnly.forEach((poly) => {
      const c = ringCentroid(poly[0] || []);
      parts.push(poly.map((ring) => scaleLatLngsAround(ring, c, Math.max(0.001, 1 - t), map)));
    });
    plan.newOnly.forEach((poly) => {
      const c = ringCentroid(poly[0] || []);
      parts.push(poly.map((ring) => scaleLatLngsAround(ring, c, Math.max(0.001, t), map)));
    });
    return parts;
  }

  function collectPathLayers(group) {
    const layers = [];
    if (!group) return layers;
    group.eachLayer((layer) => layers.push(layer));
    return layers;
  }

  function pairPolityLayers(oldLayers, newLayers, map) {
    const groups = (layers) => {
      const out = new Map();
      layers.forEach((layer) => {
        const key = normalizePolityName(layer.feature) || `__anon_${layers.indexOf(layer)}`;
        if (!out.has(key)) out.set(key, []);
        out.get(key).push(layer);
      });
      return out;
    };
    const oldG = groups(oldLayers);
    const newG = groups(newLayers);
    const persist = [];
    const disappear = [];
    const appear = [];
    const names = new Set([...oldG.keys(), ...newG.keys()]);
    names.forEach((name) => {
      const oldList = (oldG.get(name) || []).slice();
      const newList = (newG.get(name) || []).slice();
      const used = new Set();
      oldList.forEach((oldLayer) => {
        const oc = featureCentroidLatLng(oldLayer.feature, oldLayer);
        const ocPt = map.latLngToLayerPoint(oc);
        let best = -1;
        let bestD = Infinity;
        newList.forEach((newLayer, j) => {
          if (used.has(j)) return;
          const ncPt = map.latLngToLayerPoint(featureCentroidLatLng(newLayer.feature, newLayer));
          const d = ocPt.distanceTo(ncPt);
          if (d < bestD) { bestD = d; best = j; }
        });
        if (best >= 0) {
          used.add(best);
          persist.push({ oldLayer, newLayer: newList[best] });
        } else {
          disappear.push(oldLayer);
        }
      });
      newList.forEach((newLayer, j) => {
        if (!used.has(j)) appear.push(newLayer);
      });
    });
    return { persist, disappear, appear };
  }

  function removeLayerSafe(layer) {
    if (!layer) return;
    if (state.map && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    else if (layer.remove) layer.remove();
  }

  function cancelTerritoryAnim({ snap = true } = {}) {
    const anim = state.territoryAnim;
    if (!anim) return false;
    const wasIncomplete = !anim.completed;
    anim.cancelled = true;
    if (anim.raf) cancelAnimationFrame(anim.raf);
    if (snap && typeof anim.finish === "function") anim.finish();
    state.territoryAnim = null;
    return wasIncomplete;
  }

  function clearOutgoingTerritories() {
    (state.territoryOutgoing || []).forEach((layer) => removeLayerSafe(layer));
    state.territoryOutgoing = [];
    if (state.territoryOutgoingGroup) {
      removeLayerSafe(state.territoryOutgoingGroup);
      state.territoryOutgoingGroup = null;
    }
  }

  function renderTerritoryLegend(seen) {
    const items = [...seen.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.label.localeCompare(b.label, "zh-Hant");
    });
    if (els.territoryMajors) {
      const majors = items.filter((item) => item.priority <= 2).slice(0, 8);
      els.territoryMajors.innerHTML = majors.map((item) => {
        return `<span><i style="background:${polityColor(item.colorKey)}"></i>${item.label}</span>`;
      }).join("");
    }
    if (els.territoryList) {
      els.territoryList.replaceChildren();
      items.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<i style="background:${polityColor(item.colorKey)}"></i><span>${item.label}</span>`;
        els.territoryList.appendChild(li);
      });
    }
  }

  function restyleTerritoryLayer(group) {
    const seen = new Map();
    group.eachLayer((layer) => {
      const info = decorateFeature(layer.feature);
      const color = polityColor(info.colorKey);
      layer.setStyle({ color, fillColor: color, weight: 1, opacity: 0.9, fillOpacity: 0.32 });
      if (layer.getTooltip && layer.getTooltip()) layer.setTooltipContent(info.label);
      else layer.bindTooltip(info.label, { sticky: true, className: "territory-tip" });
      if (!seen.has(info.label)) seen.set(info.label, info);
    });
    renderTerritoryLegend(seen);
  }

  function buildTerritoryLayer(fc) {
    const seen = new Map();
    const layer = L.geoJSON(fc, {
      pane: "territories",
      style(feature) {
        const info = decorateFeature(feature);
        const color = polityColor(info.colorKey);
        return {
          color,
          fillColor: color,
          weight: 1,
          opacity: 0.9,
          fillOpacity: 0.32,
        };
      },
      onEachFeature(feature, path) {
        const info = decorateFeature(feature);
        path.bindTooltip(info.label, { sticky: true, className: "territory-tip" });
        if (!seen.has(info.label)) seen.set(info.label, info);
      },
    });
    return { layer, seen };
  }

  function finishTerritorySwap(nextLayer, outgoing) {
    outgoing.forEach((layer) => removeLayerSafe(layer));
    if (state.territoryOutgoing === outgoing) state.territoryOutgoing = [];
    else {
      state.territoryOutgoing = (state.territoryOutgoing || []).filter((layer) => outgoing.indexOf(layer) < 0);
    }
    if (state.territoryLayer && state.territoryLayer !== nextLayer) removeLayerSafe(state.territoryLayer);
    state.territoryLayer = nextLayer;
    if (nextLayer && state.map && !state.map.hasLayer(nextLayer)) nextLayer.addTo(state.map);
    if (state.territoryLayer && state.territoryLayer.bringToBack) state.territoryLayer.bringToBack();
  }

  function animateTerritorySwap(prevLayer, nextLayer) {
    const map = state.map;
    const oldLayers = collectPathLayers(prevLayer);
    const newLayers = collectPathLayers(nextLayer);
    const { persist, disappear, appear } = pairPolityLayers(oldLayers, newLayers, map);
    const outgoing = disappear.slice();
    const jobs = [];

    appear.forEach((layer) => {
      const full = layer.getLatLngs();
      const centroid = featureCentroidLatLng(layer.feature, layer);
      layer._fullLatLngs = full;
      layer.setLatLngs(scaleLatLngsAround(full, centroid, 0.001, map));
      jobs.push({ type: "appear", layer, full, centroid });
    });

    persist.forEach(({ oldLayer, newLayer }) => {
      const full = newLayer.getLatLngs();
      const plan = buildMorphPlan(oldLayer, newLayer, map);
      if (plan) {
        newLayer.setLatLngs(oldLayer.getLatLngs());
        jobs.push({ type: "morph", layer: newLayer, full, plan });
      } else {
        const newCentroid = featureCentroidLatLng(newLayer.feature, newLayer);
        const oldFull = oldLayer.getLatLngs();
        const oldCentroid = featureCentroidLatLng(oldLayer.feature, oldLayer);
        newLayer.setLatLngs(scaleLatLngsAround(full, newCentroid, 0.001, map));
        outgoing.push(oldLayer);
        jobs.push({ type: "reshape", newLayer, full, newCentroid, oldLayer, oldFull, oldCentroid });
      }
    });

    disappear.forEach((layer) => {
      jobs.push({
        type: "disappear",
        layer,
        full: layer.getLatLngs(),
        centroid: featureCentroidLatLng(layer.feature, layer),
      });
    });

    if (prevLayer) {
      prevLayer.eachLayer((layer) => {
        if (outgoing.indexOf(layer) < 0 && persist.every((pair) => pair.oldLayer !== layer)) {
          // leftover unmatched already classified
        }
      });
    }

    persist.forEach(({ oldLayer }) => {
      if (outgoing.indexOf(oldLayer) < 0) {
        if (prevLayer && prevLayer.removeLayer) prevLayer.removeLayer(oldLayer);
        removeLayerSafe(oldLayer);
      }
    });

    const outgoingGroup = L.featureGroup([]);
    outgoing.forEach((layer) => {
      if (prevLayer && prevLayer.hasLayer && prevLayer.hasLayer(layer)) prevLayer.removeLayer(layer);
      outgoingGroup.addLayer(layer);
    });
    state.territoryOutgoing = outgoing;
    state.territoryOutgoingGroup = outgoingGroup;

    nextLayer.addTo(map);
    if (outgoing.length) {
      outgoingGroup.addTo(map);
      if (outgoingGroup.bringToBack) outgoingGroup.bringToBack();
    }
    if (nextLayer.bringToBack) nextLayer.bringToBack();
    if (prevLayer && prevLayer !== nextLayer) removeLayerSafe(prevLayer);
    state.territoryLayer = nextLayer;

    const finish = () => {
      jobs.forEach((job) => {
        if (job.type === "appear" || job.type === "morph") applyLatLngs(job.layer, asMultiPolygon(job.full));
        else if (job.type === "reshape") applyLatLngs(job.newLayer, asMultiPolygon(job.full));
      });
      removeLayerSafe(outgoingGroup);
      if (state.territoryOutgoingGroup === outgoingGroup) state.territoryOutgoingGroup = null;
      finishTerritorySwap(nextLayer, outgoing);
      if (state.territoryAnim) state.territoryAnim.completed = true;
      state.territoryAnim = null;
    };

    const duration = territoryAnimMs();
    if (!jobs.length || duration <= 0) {
      finish();
      return;
    }

    const start = performance.now();
    const anim = { cancelled: false, completed: false, raf: null, finish };
    state.territoryAnim = anim;

    const step = (now) => {
      if (anim.cancelled) return;
      const t = easeOutCubic((now - start) / duration);
      jobs.forEach((job) => {
        if (job.type === "appear") {
          job.layer.setLatLngs(scaleLatLngsAround(job.full, job.centroid, Math.max(0.001, t), map));
        } else if (job.type === "disappear") {
          job.layer.setLatLngs(scaleLatLngsAround(job.full, job.centroid, Math.max(0.001, 1 - t), map));
        } else if (job.type === "morph") {
          applyLatLngs(job.layer, interpolateMorph(job.plan, t, map));
        } else if (job.type === "reshape") {
          job.newLayer.setLatLngs(scaleLatLngsAround(job.full, job.newCentroid, Math.max(0.001, t), map));
          job.oldLayer.setLatLngs(scaleLatLngsAround(job.oldFull, job.oldCentroid, Math.max(0.001, 1 - t), map));
        }
      });
      if (t >= 1) {
        anim.completed = true;
        finish();
        return;
      }
      anim.raf = requestAnimationFrame(step);
    };
    anim.raf = requestAnimationFrame(step);
  }

  function updateTerritories() {
    if (!els.territoryYear) return;
    const data = window.TERRITORIES;
    const meta = (data && data.meta) || {};
    const cite = `近似重建，僅供參考。資料：<a href="${meta.url || "https://github.com/aourednik/historical-basemaps"}" target="_blank" rel="noopener">historical-basemaps</a>（${meta.license || "GPL-3.0"}）`;
    if (els.territoryCite) els.territoryCite.innerHTML = cite;
    if (els.territoryNote) {
      els.territoryNote.innerHTML =
        `${meta.note || "疆域邊界為大陸尺度的近似重建，不能作為精確國界依據。"}<br>資料來源：<a href="${meta.url || "https://github.com/aourednik/historical-basemaps"}" target="_blank" rel="noopener">aourednik/historical-basemaps</a>　授權：${meta.license || "GPL-3.0"}。顯示名稱已依通行斷代校正，幾何仍來自原快照。`;
    }

    if (!data) {
      els.territoryYear.textContent = "疆域資料未載入";
      return;
    }

    if (!state.showTerritories) {
      cancelTerritoryAnim({ snap: false });
      clearOutgoingTerritories();
      if (state.territoryOutgoingGroup) {
        removeLayerSafe(state.territoryOutgoingGroup);
        state.territoryOutgoingGroup = null;
      }
      if (state.territoryLayer) {
        removeLayerSafe(state.territoryLayer);
        state.territoryLayer = null;
      }
      state.currentSnapshotYear = null;
      state.currentLabelYear = null;
      els.territoryYear.textContent = "已關閉疆域圖";
      if (els.territoryMajors) els.territoryMajors.replaceChildren();
      if (els.territoryList) els.territoryList.replaceChildren();
      return;
    }

    const snapYear = snapshotYearFor(state.yearEnd);
    if (snapYear == null) {
      els.territoryYear.textContent = "此時段尚無疆域資料";
      return;
    }
    if (state.currentSnapshotYear === snapYear && state.currentLabelYear === state.yearEnd && state.territoryLayer) {
      return;
    }

    const fc = data.snapshots[String(snapYear)];
    if (!fc) return;

    if (state.currentSnapshotYear === snapYear && state.territoryLayer) {
      restyleTerritoryLayer(state.territoryLayer);
      state.currentLabelYear = state.yearEnd;
      els.territoryYear.textContent = `顯示 ${formatYear(state.yearEnd)}　快照 ${formatYear(snapYear)}（約）`;
      return;
    }

    const interrupted = cancelTerritoryAnim({ snap: true });
    const { layer, seen } = buildTerritoryLayer(fc);
    const prev = state.territoryLayer;
    const skipAnim = !prev || (interrupted && state.playing && state.playSpeed >= 2);

    state.currentSnapshotYear = snapYear;
    state.currentLabelYear = state.yearEnd;
    els.territoryYear.textContent = `顯示 ${formatYear(state.yearEnd)}　快照 ${formatYear(snapYear)}（約）`;
    renderTerritoryLegend(seen);

    if (skipAnim) {
      if (prev) removeLayerSafe(prev);
      clearOutgoingTerritories();
      if (state.territoryOutgoingGroup) {
        removeLayerSafe(state.territoryOutgoingGroup);
        state.territoryOutgoingGroup = null;
      }
      layer.addTo(state.map);
      if (layer.bringToBack) layer.bringToBack();
      state.territoryLayer = layer;
      return;
    }

    animateTerritorySwap(prev, layer);
  }

  function refresh() {
    const events = visibleEvents();
    renderRange();
    updateTerritories();
    renderMarkers(events);
    renderList(events);
    if (state.selectedId && !events.some((event) => event.id === state.selectedId)) {
      els.detail.hidden = true;
      state.selectedId = null;
    }
  }

  function refreshDuringPlay() {
    const events = visibleEvents();
    renderRange();
    updateTerritories();
    syncMarkers(events);
    renderList(events);
  }

  function setRange(start, end, { fromPlay = false } = {}) {
    let nextStart = Math.min(start, end);
    let nextEnd = Math.max(start, end);
    nextStart = Math.max(YEAR_MIN, Math.min(YEAR_MAX, nextStart));
    nextEnd = Math.max(YEAR_MIN, Math.min(YEAR_MAX, nextEnd));
    const prevEnd = state.yearEnd;
    state.yearStart = nextStart;
    state.yearEnd = nextEnd;
    if (fromPlay) {
      const crossed = state.events.filter((event) => event.year > prevEnd && event.year <= nextEnd);
      showPlayToastsFor(crossed);
      pruneStaleToasts();
      refreshDuringPlay();
    } else {
      // Seeking or scrubbing must never open or delay playback cards.
      if (!state.playing) clearPlayToasts({ immediate: true });
      refresh();
    }
  }

  function shortDesc(text, limit = 90) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit)}…`;
  }

  const TOAST_CATEGORY_WEIGHT = {
    "戰爭": 8, "政治": 7, "外交": 6, "宗教": 5, "文化": 4, "科技": 4, "經濟": 3, "社會": 3,
  };

  function toastYearWindow() {
    const step = yearStep();
    const ticks = state.playSpeed >= 4 ? 4 : state.playSpeed >= 2 ? 6 : 8;
    const floor = state.yearEnd < 1800 ? 18 : 6;
    return Math.max(step * ticks, floor);
  }

  function pruneStaleToasts() {
    const windowYears = toastYearWindow();
    const keep = [];
    state.openToasts.forEach((rec) => {
      const year = rec.event && rec.event.year;
      const behind = Number.isFinite(year) ? state.yearEnd - year : Infinity;
      if (behind > windowYears) {
        if (rec.timer) clearTimeout(rec.timer);
        if (rec.popup) rec.popup.remove();
      } else {
        keep.push(rec);
      }
    });
    state.openToasts = keep;
    state.toastQueue = [];
  }

  function rankToastEvents(events) {
    const scored = events.map((event, index) => ({
      event,
      index,
      weight: TOAST_CATEGORY_WEIGHT[event.category] || 1,
    }));
    scored.sort((a, b) => b.weight - a.weight || a.event.year - b.event.year || a.index - b.index);
    const picked = [];
    const usedRegions = new Set();
    const rest = [];
    scored.forEach((item) => {
      if (!usedRegions.has(item.event.region) && picked.length < MAX_OPEN_TOASTS) {
        usedRegions.add(item.event.region);
        picked.push(item.event);
      } else {
        rest.push(item);
      }
    });
    rest.forEach((item) => {
      if (picked.length < MAX_OPEN_TOASTS) picked.push(item.event);
    });
    return picked;
  }

  function showPlayToastsFor(events) {
    state.toastQueue = [];
    if (!state.playing || !state.showPlayToasts || !events.length) return;
    pruneStaleToasts();
    const openIds = new Set(state.openToasts.map((rec) => rec.event && rec.event.id));
    const incoming = rankToastEvents(events.filter((event) => !openIds.has(event.id)));
    if (!incoming.length) return;
    let room = MAX_OPEN_TOASTS - state.openToasts.length;
    if (room < incoming.length && incoming.length) {
      const need = Math.min(incoming.length, MAX_OPEN_TOASTS) - room;
      const evict = state.openToasts
        .slice()
        .sort((a, b) => (a.event.year - b.event.year) || ((a.openedAt || 0) - (b.openedAt || 0)))
        .slice(0, Math.max(0, need));
      evict.forEach((rec) => {
        if (rec.timer) clearTimeout(rec.timer);
        if (rec.popup) rec.popup.remove();
        const idx = state.openToasts.indexOf(rec);
        if (idx >= 0) state.openToasts.splice(idx, 1);
      });
      room = MAX_OPEN_TOASTS - state.openToasts.length;
    }
    const chosen = incoming.slice(0, Math.max(0, room));
    chosen.forEach((event) => openPlayToast(event, { pan: false }));
    const offscreen = chosen.find((event) => {
      const latlng = L.latLng(event.lat, event.lng);
      return !state.map.getBounds().pad(-0.12).contains(latlng);
    });
    if (offscreen) state.map.panTo([offscreen.lat, offscreen.lng], { animate: true, duration: 0.45 });
  }

  function clearPlayToasts({ immediate = true } = {}) {
    state.toastQueue = [];
    state.openToasts.forEach((rec) => {
      if (rec.timer) clearTimeout(rec.timer);
      if (immediate && rec.popup) {
        rec.popup.remove();
      }
    });
    if (immediate) {
      state.openToasts = [];
      document.querySelectorAll(".leaflet-popup.play-toast, .play-toast").forEach((el) => el.remove());
    }
  }

  function openPlayToast(event, { pan = false } = {}) {
    if (!state.playing || !state.showPlayToasts) return;
    const lag = state.yearEnd - event.year;
    if (lag > toastYearWindow()) return;
    const latlng = L.latLng(event.lat, event.lng);
    if (pan) {
      const padded = state.map.getBounds().pad(-0.18);
      if (!padded.contains(latlng)) {
        state.map.panTo(latlng, { animate: true, duration: 0.45 });
      }
    }
    const color = CATEGORY_COLORS[event.category] || "#9e2b1f";
    const popup = L.popup({
      autoClose: false,
      closeOnClick: false,
      closeButton: false,
      className: "play-toast",
      maxWidth: 280,
      offset: [0, -10],
    })
      .setLatLng(latlng)
      .setContent(
        `<p class="play-toast-year">${formatYear(event.year)} <span class="play-toast-cat" style="background:${color}">${event.category}</span></p>
         <p class="play-toast-title">${event.title}</p>
         <p class="play-toast-desc">${shortDesc(event.description)}</p>`
      );
    popup.addTo(state.map);
    const rec = { popup, timer: null, event, openedAt: performance.now() };
    rec.timer = setTimeout(() => {
      if (rec.popup) rec.popup.remove();
      const idx = state.openToasts.indexOf(rec);
      if (idx >= 0) state.openToasts.splice(idx, 1);
    }, PLAY_TOAST_MS);
    state.openToasts.push(rec);
  }

  function tickMs() {
    return Math.max(40, Math.round(BASE_TICK_MS / state.playSpeed));
  }

  function yearStep() {
    return state.yearEnd < 1800 ? 6 : 2;
  }

  function stopPlay() {
    state.playing = false;
    els.playBtn.setAttribute("aria-pressed", "false");
    els.playBtn.textContent = "依年代播放";
    if (state.playTimer) {
      clearInterval(state.playTimer);
      state.playTimer = null;
    }
    clearPlayToasts({ immediate: true });
  }

  function startPlay() {
    state.playing = true;
    if (state.yearEnd >= YEAR_MAX && state.yearStart <= YEAR_MIN) {
      state.yearStart = YEAR_MIN;
      state.yearEnd = YEAR_MIN;
      refreshDuringPlay();
      showPlayToastsFor(state.events.filter((event) => event.year === YEAR_MIN));
    }
    if (state.yearEnd >= YEAR_MAX) {
      state.yearEnd = Math.max(state.yearStart, YEAR_MIN);
      refreshDuringPlay();
    }
    els.playBtn.setAttribute("aria-pressed", "true");
    els.playBtn.textContent = "停止播放";
    if (state.playTimer) clearInterval(state.playTimer);
    state.playTimer = setInterval(() => {
      if (state.yearEnd >= YEAR_MAX) {
        stopPlay();
        return;
      }
      setRange(state.yearStart, Math.min(YEAR_MAX, state.yearEnd + yearStep()), { fromPlay: true });
    }, tickMs());
  }

  function restartPlayTimer() {
    if (!state.playing) return;
    if (state.playTimer) clearInterval(state.playTimer);
    state.playTimer = setInterval(() => {
      if (state.yearEnd >= YEAR_MAX) {
        stopPlay();
        return;
      }
      setRange(state.yearStart, Math.min(YEAR_MAX, state.yearEnd + yearStep()), { fromPlay: true });
    }, tickMs());
  }

  function initSlider() {
    const onInput = (which) => {
      stopPlay();
      let start = Number(els.yearStart.value);
      let end = Number(els.yearEnd.value);
      if (which === "start" && start > end) start = end;
      if (which === "end" && end < start) end = start;
      setRange(start, end);
    };
    els.yearStart.addEventListener("input", () => onInput("start"));
    els.yearEnd.addEventListener("input", () => onInput("end"));
    els.resetRange.addEventListener("click", () => {
      stopPlay();
      setRange(YEAR_MIN, YEAR_MAX);
    });
    els.playBtn.addEventListener("click", () => {
      if (state.playing) stopPlay();
      else startPlay();
    });
    els.playSpeed.addEventListener("change", () => {
      const value = Number(els.playSpeed.value);
      state.playSpeed = [0.5, 1, 2, 4].includes(value) ? value : 1;
      restartPlayTimer();
    });
    if (els.playToastToggle) {
      els.playToastToggle.addEventListener("change", () => {
        state.showPlayToasts = els.playToastToggle.checked;
        if (!state.showPlayToasts) clearPlayToasts({ immediate: true });
      });
    }
  }

  function initTerritories() {
    els.territoryToggle.addEventListener("change", () => {
      state.showTerritories = els.territoryToggle.checked;
      state.currentSnapshotYear = null;
      state.currentLabelYear = null;
      updateTerritories();
    });
    if (els.territoryExpand) {
      els.territoryExpand.addEventListener("click", () => {
        const open = els.territoryDetails && els.territoryDetails.hidden;
        if (els.territoryDetails) els.territoryDetails.hidden = !open;
        els.territoryExpand.setAttribute("aria-expanded", String(Boolean(open)));
        els.territoryExpand.textContent = open ? "收合圖例" : "展開圖例";
        if (els.territoryPanel) els.territoryPanel.classList.toggle("is-open", Boolean(open));
      });
    }
  }

  function initChrome() {
    els.detailClose.addEventListener("click", closeDetail);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDetail();
        document.body.classList.remove("sidebar-open");
        els.menuToggle.setAttribute("aria-expanded", "false");
        els.backdrop.hidden = true;
      }
    });
    if (els.legend) {
      els.legend.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".legend-toggle");
        if (!btn) return;
        const open = !els.legend.classList.contains("is-open");
        els.legend.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    }
    els.menuToggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("sidebar-open");
      document.body.classList.toggle("sidebar-open", open);
      els.menuToggle.setAttribute("aria-expanded", String(open));
      els.backdrop.hidden = !open;
    });
    els.backdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      els.menuToggle.setAttribute("aria-expanded", "false");
      els.backdrop.hidden = true;
    });
  }


  function panelPadRight() {
    const ui = document.querySelector(".map-ui");
    const width = ui ? ui.getBoundingClientRect().width : 260;
    return Math.round(width + 24);
  }

  function fitEastAsiaView() {
    if (!state.map) return;
    state.map.fitBounds(L.latLngBounds([22, 103], [46, 146]), {
      paddingTopLeft: [8, 8],
      paddingBottomRight: [panelPadRight(), 28],
      maxZoom: 5.5,
      animate: false,
    });
    keepJapanVisible();
  }

  function keepJapanVisible() {
    if (!state.map) return;
    const map = state.map;
    const size = map.getSize();
    if (!size.x || !size.y) return;
    const pad = panelPadRight();
    const anchors = [
      L.latLng(31.6, 130.7),
      L.latLng(34.7, 135.5),
      L.latLng(35.68, 139.76),
      L.latLng(43.06, 141.35),
    ];
    let overflow = 0;
    anchors.forEach((latlng) => {
      const point = map.latLngToContainerPoint(latlng);
      overflow = Math.max(overflow, point.x - (size.x - pad));
    });
    if (overflow > 2) map.panBy([overflow, 0], { animate: false });
  }

  function initMap() {
    state.map = L.map("map", {
      center: [35.2, 130.5],
      zoom: 5,
      minZoom: 5,
      maxZoom: 12,
      zoomSnap: 0.5,
      worldCopyJump: false,
      maxBounds: L.latLngBounds([14, 92], [53, 160]),
      maxBoundsViscosity: 0.85,
      zoomControl: true,
    });

    state.map.createPane("territories");
    state.map.getPane("territories").style.zIndex = 350;
    state.map.getPane("territories").style.pointerEvents = "auto";

    const esriAttr = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, HERE, Garmin, USGS et al.';
    const tileSources = [
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        attribution: esriAttr,
      },
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        attribution: esriAttr,
      },
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics',
      },
    ];

    let sourceIndex = 0;
    let activeLayer = null;
    let switchingTiles = false;

    function addActiveLayer() {
      const source = tileSources[sourceIndex];
      const layer = L.tileLayer(source.url, {
        attribution: source.attribution,
        maxZoom: 12,
      });
      layer.on("tileerror", () => switchTileSource());
      layer.addTo(state.map);
      activeLayer = layer;
    }

    function switchTileSource() {
      if (switchingTiles) return;
      if (sourceIndex >= tileSources.length - 1) return;
      switchingTiles = true;
      const failed = activeLayer;
      sourceIndex += 1;
      addActiveLayer();
      const detach = () => {
        if (failed && state.map.hasLayer(failed)) state.map.removeLayer(failed);
        switchingTiles = false;
      };
      if (activeLayer) activeLayer.once("load", detach);
      setTimeout(detach, 1200);
    }

    addActiveLayer();

    state.cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        const size = count > 8 ? 40 : 32;
        return L.divIcon({
          html: `<div class="custom-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
          className: "",
          iconSize: [size, size],
        });
      },
    });
    document.getElementById("map")._map = state.map;
    document.getElementById("map")._ea = {
      get animating() { return !!(state.territoryAnim && !state.territoryAnim.completed); },
      get snapshot() { return state.currentSnapshotYear; },
      get yearEnd() { return state.yearEnd; },
      get playing() { return state.playing; },
      get showPlayToasts() { return state.showPlayToasts; },
      get toastQueue() { return state.toastQueue.length; },
      get openToasts() { return state.openToasts.length; },
      openToastYears() {
        return state.openToasts.map((rec) => rec.event && rec.event.year).filter((year) => Number.isFinite(year));
      },
      toastWindow() { return toastYearWindow(); },
      majors() { return (els.territoryMajors && els.territoryMajors.textContent) || ""; },
      pathCount() {
        const pane = state.map && state.map.getPane("territories");
        return pane ? pane.querySelectorAll("path").length : 0;
      },
    };
    state.map.on("zoomstart", () => cancelTerritoryAnim({ snap: true }));
    state.map.addLayer(state.cluster);
    // Leave room on the right for the legend / territory panel so Japan stays visible.
    fitEastAsiaView();
    state.map.on("zoomend", () => {
      if (state.map.getZoom() <= state.map.getMinZoom() + 0.05) keepJapanVisible();
    });
  }

  function loadEvents() {
    const data = Array.isArray(window.EVENTS) ? window.EVENTS : [];
    if (!data.length) throw new Error("無法載入事件資料");
    state.events = data
      .filter((event) => Number.isFinite(event.year) && Number.isFinite(event.lat) && Number.isFinite(event.lng))
      .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "zh-Hant"));
  }

  function main() {
    renderFilters();
    renderLegend();
    initMap();
    initSlider();
    initTerritories();
    initChrome();
    try {
      loadEvents();
      refresh();
    } catch (error) {
      els.listCount.textContent = "資料載入失敗";
      console.error(error);
    }
    requestAnimationFrame(() => {
      state.map.invalidateSize();
      fitEastAsiaView();
      keepJapanVisible();
    });
  }

  main();
})();
