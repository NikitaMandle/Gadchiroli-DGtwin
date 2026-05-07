/* eslint-disable no-undef */
// File: js/4_model_manager_simple_safe.js
// SIMPLE SAFE MODEL MANAGER — Sequential loading without FPS complications
// Focus: ONE model at a time, memory limits, auto-cleanup
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// SIMPLE SAFETY CONFIG
// ═══════════════════════════════════════════════════════════════════
const SAFE_CONFIG = {
  // LOADING
  MAX_CONCURRENT_LOADS: 1,        // ONE at a time - safest
  LOAD_DELAY_MS: 500,             // 500ms between loads
  MAX_QUEUE_SIZE: 25,             // Allow up to 25 in queue
  
  // MEMORY
  MAX_ACTIVE_MODELS: 8,           // Max 8 models in scene
  CACHE_LIMIT_MB: 120,            // 120MB limit
  AUTO_CLEANUP_THRESHOLD: 100,    // Auto-cleanup at 100MB
  
  // AUTO-UNLOAD
  AUTO_UNLOAD_DISTANCE: 10000,    // 10km
  UNLOAD_HIDDEN_ON_MEMORY: true,  // Unload hidden models when memory high
  
  // LOD
  USE_LOD: true,
  LOD_NEAR: 1000,    // <1km: Full
  LOD_MID: 5000,     // 1-5km: Medium  
  LOD_FAR: 10000,    // 5-10km: Low
};

// ═══════════════════════════════════════════════════════════════════
// GLOBALS
// ═══════════════════════════════════════════════════════════════════
const modelInstances = [];
let currentActiveModel = -1;
let pendingTxtModelIndex = -1;
window.modelEntity = null;

const loadQueue = [];
let activeLoads = 0;
let totalCacheSize = 0;
let lastLoadTime = 0;

// ═══════════════════════════════════════════════════════════════════
// MODEL CATALOG
// ═══════════════════════════════════════════════════════════════════
// const MODEL_CATALOG = [
//   {
//     name: "Model 1 - 1st Half",
//     url: "Blender files/1.1st half.glb",
//     longitude: 79.971458,
//     latitude: 19.510650,
//     height: 1,
//     scale: 1.0,
//     heading: 115,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 1,
//     sizeMB: 5
//   },
//   {
//     name: "Model 2 - 2.1 Half",
//     url: "Blender files/1.2 half.glb",
//     longitude: 79.975364,
//     latitude: 19.518371,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 2,
//     sizeMB: 5
//   },
//   {
//     name: "Model 3 - 2.2 Half",
//     url: "Blender files/2.1 half.glb",
//     longitude: 79.975161,
//     latitude: 19.520304,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 2,
//     sizeMB: 5
//   },
//   {
//     name: "Model 4 - 3rd Half",
//     url: "Blender files/2.2 half.glb",
//     longitude: 79.962751,
//     latitude: 19.514676,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 2,
//     sizeMB: 5
//   },
//   {
//     name: "Model 5",
//     url: "Blender files/3 full.glb",
//     longitude: 79.962751,
//     latitude: 19.514677,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 8
//   },
//   {
//     name: "Model 6",
//     url: "Blender files/4 full.glb",
//     longitude: 79.968000,
//     latitude: 19.515000,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 8
//   },
//   {
//     name: "Model 7",
//     url: "Blender files/5 full.glb",
//     longitude: 79.963098,
//     latitude: 19.509564,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 8
//   },
//   {
//     name: "Model 8",
//     url: "Blender files/6 full.glb",
//     longitude: 79.962796,
//     latitude: 19.512129,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 8
//   },
//   {
//     name: "Model 9",
//     url: "Blender files/7.1 half.glb",
//     longitude: 79.972593,
//     latitude: 19.531612,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 5
//   },
//   {
//     name: "Model 10",
//     url: "Blender files/7.2 half.glb",
//     longitude: 79.967587,
//     latitude: 19.527409,
//     height: 29,
//     scale: 1.0,
//     heading: 105,
//     pitch: 92,
//     roll: 15,
//     opacity: 1.0,
//     priority: 3,
//     sizeMB: 5
//   }
// ];

const MODEL_CATALOG = [];
const catalogState = [];

// ═══════════════════════════════════════════════════════════════════
// TOAST NOICATIONS
// ═══════════════════════════════════════════════════════════════════
function showToast(message, type) {
  type = type || "info";
  const existing = document.getElementById("model-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "model-toast";
  
  const colors = {
    error: "#ff4444",
    success: "#00FF94",
    warning: "#FFA500",
    info: "#00D9FF",
    loading: "#6495ED"
  };
  
  toast.style.cssText = `
    position:fixed;bottom:20px;right:20px;padding:12px 20px;
    border-radius:8px;font-size:13px;font-weight:700;z-index:99999;
    max-width:320px;background:${colors[type]};color:#000;
    box-shadow:0 4px 16px rgba(0,0,0,0.4);
    font-family:system-ui,-apple-system,sans-serif;
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  if (type !== "loading") {
    setTimeout(() => toast.remove(), 3000);
  }
}

function removeToast() {
  const t = document.getElementById("model-toast");
  if (t) t.remove();
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════
function loadDefaultModels() {
  console.log("✅ Simple Safe Model Manager initialized");
  console.log(`Config: ${SAFE_CONFIG.MAX_CONCURRENT_LOADS} concurrent, ${SAFE_CONFIG.MAX_ACTIVE_MODELS} max active, ${SAFE_CONFIG.CACHE_LIMIT_MB}MB limit`);
  
  renderCatalogUI();
  startAutoCleanup();
  
  setTimeout(() => {
    if (typeof loadKMZLayers === "function") loadKMZLayers();
  }, 500);
}

function loadDefaultModel() {
  loadDefaultModels();
}

// ═══════════════════════════════════════════════════════════════════
// AUTO CLEANUP & LOD
// ═══════════════════════════════════════════════════════════════════
function startAutoCleanup() {
  setInterval(() => {
    if (!viewer || !viewer.camera) return;
    
    const cameraPos = viewer.camera.positionCartographic;
    
    // Update distances and LOD
    catalogState.forEach((cs, idx) => {
      if (cs.state !== "loaded") return;
      
      const config = MODEL_CATALOG[idx];
      const modelPos = Cesium.Cartographic.fromDegrees(
        config.longitude,
        config.latitude,
        config.height
      );
      
      const distance = Cesium.Cartographic.distance(cameraPos, modelPos);
      cs.lastDistance = distance;
      
      // Auto-unload if too far
      if (distance > SAFE_CONFIG.AUTO_UNLOAD_DISTANCE) {
        autoUnloadModel(idx);
        return;
      }
      
      // Update LOD
      if (SAFE_CONFIG.USE_LOD) {
        updateLOD(idx, distance);
      }
    });
    
    // Check memory and cleanup if needed
    checkMemory();
    enforceModelLimit();
    
  }, 3000); // Every 3 seconds
}

function updateLOD(catalogIdx, distance) {
  const cs = catalogState[catalogIdx];
  const inst = modelInstances[cs.instanceIndex];
  if (!inst || !inst.entity.model) return;
  
  let newLOD = 0;
  if (distance > SAFE_CONFIG.LOD_FAR) newLOD = 2;
  else if (distance > SAFE_CONFIG.LOD_MID) newLOD = 1;
  
  if (cs.lodLevel === newLOD) return;
  cs.lodLevel = newLOD;
  
  const model = inst.entity.model;
  switch (newLOD) {
    case 2: // Far
      model.maximumScale = 3000;
      model.minimumPixelSize = 24;
      break;
    case 1: // Medium
      model.maximumScale = 6000;
      model.minimumPixelSize = 40;
      break;
    case 0: // Near
      model.maximumScale = 10000;
      model.minimumPixelSize = 64;
      break;
  }
}

function checkMemory() {
  const usedMB = totalCacheSize / (1024 * 1024);
  
  if (usedMB >= SAFE_CONFIG.AUTO_CLEANUP_THRESHOLD) {
    console.log(`⚠️ Memory at ${Math.round(usedMB)}MB - running cleanup`);
    
    // Unload hidden models first
    let cleaned = false;
    catalogState.forEach((cs, idx) => {
      if (cs.state !== "loaded") return;
      const inst = modelInstances[cs.instanceIndex];
      if (inst && !inst.visible) {
        unloadCatalogModel(idx);
        cleaned = true;
      }
    });
    
    // If still high, unload farthest
    if (!cleaned && usedMB >= SAFE_CONFIG.AUTO_CLEANUP_THRESHOLD) {
      unloadFarthestModel();
    }
  }
}

function unloadFarthestModel() {
  let farthestIdx = -1;
  let maxDist = 0;
  
  catalogState.forEach((cs, idx) => {
    if (cs.state !== "loaded") return;
    if (cs.instanceIndex === currentActiveModel) return;
    if (cs.lastDistance > maxDist) {
      maxDist = cs.lastDistance;
      farthestIdx = idx;
    }
  });
  
  if (farthestIdx >= 0) {
    console.log(`🗑️ Auto-unloading farthest model: ${MODEL_CATALOG[farthestIdx].name}`);
    unloadCatalogModel(farthestIdx);
  }
}

function enforceModelLimit() {
  const loaded = catalogState.filter(s => s.state === "loaded").length;
  if (loaded <= SAFE_CONFIG.MAX_ACTIVE_MODELS) return;
  
  console.log(`⚠️ Too many models (${loaded}/${SAFE_CONFIG.MAX_ACTIVE_MODELS}) - unloading oldest`);
  
  // Find oldest non-active model
  let oldestIdx = -1;
  let oldestTime = Infinity;
  
  catalogState.forEach((cs, idx) => {
    if (cs.state !== "loaded") return;
    if (cs.instanceIndex === currentActiveModel) return;
    const inst = modelInstances[cs.instanceIndex];
    if (inst && inst.loadedAt < oldestTime) {
      oldestTime = inst.loadedAt;
      oldestIdx = idx;
    }
  });
  
  if (oldestIdx >= 0) {
    unloadCatalogModel(oldestIdx);
  }
}

// ═══════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
function addToLoadQueue(catalogIdx) {
  const config = MODEL_CATALOG[catalogIdx];
  const cs = catalogState[catalogIdx];
  
  if (cs.state !== "unloaded") return;
  
  // Check queue limit
  if (loadQueue.length >= SAFE_CONFIG.MAX_QUEUE_SIZE) {
    showToast("⚠️ Queue full! Wait for current loads.", "warning");
    const cb = document.getElementById(`catalog-cb-${catalogIdx}`);
    if (cb) cb.checked = false;
    return;
  }
  
  // Check memory
  const projectedMB = (totalCacheSize / (1024*1024)) + config.sizeMB;
  if (projectedMB > SAFE_CONFIG.CACHE_LIMIT_MB) {
    showToast(`⚠️ Not enough memory. Unload some models first.`, "warning");
    const cb = document.getElementById(`catalog-cb-${catalogIdx}`);
    if (cb) cb.checked = false;
    return;
  }
  
  loadQueue.push({
    catalogIdx,
    priority: config.priority || 5,
    addedAt: Date.now()
  });
  
  loadQueue.sort((a, b) => a.priority - b.priority);
  
  cs.state = "queued";
  renderCatalogUI();
  
  console.log(`📋 Queued: ${config.name} (position ${loadQueue.length})`);
  
  processLoadQueue();
}

function processLoadQueue() {
  // Don't load if already loading
  if (activeLoads >= SAFE_CONFIG.MAX_CONCURRENT_LOADS) return;
  if (loadQueue.length === 0) return;
  
  // Enforce delay
  const timeSince = Date.now() - lastLoadTime;
  if (timeSince < SAFE_CONFIG.LOAD_DELAY_MS) {
    setTimeout(processLoadQueue, SAFE_CONFIG.LOAD_DELAY_MS - timeSince);
    return;
  }
  
  const next = loadQueue.shift();
  if (!next) return;
  
  activeLoads++;
  lastLoadTime = Date.now();
  
  loadModelNow(next.catalogIdx);
}

// ═══════════════════════════════════════════════════════════════════
// MODEL LOADING
// ═══════════════════════════════════════════════════════════════════
function loadModelNow(catalogIdx) {
  const config = MODEL_CATALOG[catalogIdx];
  const cs = catalogState[catalogIdx];
  
  cs.state = "loading";
  renderCatalogUI();
  
  showToast(`⏳ Loading ${config.name}...`, "loading");
  
  try {
    const position = Cesium.Cartesian3.fromDegrees(
      config.longitude,
      config.latitude,
      config.height
    );
    
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(config.heading),
      Cesium.Math.toRadians(config.pitch),
      Cesium.Math.toRadians(config.roll)
    );
    
    const entity = viewer.entities.add({
      name: config.name,
      position: position,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(position, hpr),
      model: {
        uri: config.url,
        scale: config.scale,
        minimumPixelSize: 64,
        maximumScale: 10000,
        allowPicking: false,
        show: true,
        heightReference: config.height === 0 
          ? Cesium.HeightReference.CLAMP_TO_GROUND 
          : Cesium.HeightReference.RELATIVE_TO_GROUND,
        shadows: Cesium.ShadowMode.DISABLED,
        color: Cesium.Color.WHITE.withAlpha(config.opacity),
        colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
        colorBlendAmount: 0.5,
        incrementallyLoadTextures: true,
        runAnimations: false
      }
    });
    
    const sizeBytes = config.sizeMB * 1024 * 1024;
    totalCacheSize += sizeBytes;
    
    const instanceIdx = modelInstances.length;
    modelInstances.push({
      name: config.name,
      entity: entity,
      params: { ...config },
      visible: true,
      catalogIdx: catalogIdx,
      sizeBytes: sizeBytes,
      loadedAt: Date.now()
    });
    
    cs.state = "loaded";
    cs.instanceIndex = instanceIdx;
    
    currentActiveModel = instanceIdx;
    window.modelEntity = entity;
    applyParamsToUI(config);
    
    activeLoads--;
    
    removeToast();
    showToast(`✅ ${config.name} loaded!`, "success");
    
    renderCatalogUI();
    updateLegacyStatus();
    
    // Auto fly to model after loading
    setTimeout(() => {
      flyToCatalogModel(catalogIdx);
    }, 400);
    
    // Continue queue
    setTimeout(processLoadQueue, SAFE_CONFIG.LOAD_DELAY_MS);
    
  } catch (err) {
    console.error(`❌ Load failed:`, err);
    cs.state = "error";
    activeLoads--;
    
    removeToast();
    showToast(`❌ Failed to load ${config.name}`, "error");
    
    renderCatalogUI();
    setTimeout(processLoadQueue, SAFE_CONFIG.LOAD_DELAY_MS);
  }
}

// ═══════════════════════════════════════════════════════════════════
// UNLOAD
// ═══════════════════════════════════════════════════════════════════
function unloadCatalogModel(catalogIdx) {
  const cs = catalogState[catalogIdx];
  if (cs.state !== "loaded") return;
  
  const inst = modelInstances[cs.instanceIndex];
  if (inst) {
    viewer.entities.remove(inst.entity);
    totalCacheSize -= inst.sizeBytes || 0;
    modelInstances[cs.instanceIndex] = null;
  }
  
  if (currentActiveModel === cs.instanceIndex) {
    currentActiveModel = -1;
    window.modelEntity = null;
  }
  
  cs.state = "unloaded";
  cs.instanceIndex = -1;
  
  renderCatalogUI();
  updateLegacyStatus();
}

function autoUnloadModel(catalogIdx) {
  const cs = catalogState[catalogIdx];
  if (cs.state !== "loaded") return;
  if (cs.instanceIndex === currentActiveModel) return;
  
  const inst = modelInstances[cs.instanceIndex];
  if (!inst || !inst.visible) return;
  
  console.log(`🔄 Auto-unloading ${MODEL_CATALOG[catalogIdx].name} (>10km)`);
  unloadCatalogModel(catalogIdx);
  
  const cb = document.getElementById(`catalog-cb-${catalogIdx}`);
  if (cb) cb.checked = false;
}

// ═══════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════
function renderCatalogUI() {
  const container = document.getElementById("model-controls");
  if (!container) return;
  
  const loadedCount = catalogState.filter(s => s.state === "loaded").length;
  const queuedCount = loadQueue.length;
  const memMB = Math.round(totalCacheSize / (1024 * 1024));
  const memPct = Math.round((memMB / SAFE_CONFIG.CACHE_LIMIT_MB) * 100);
  
  const statusColor = memPct > 80 ? "#ff4444" : memPct > 60 ? "#FFA500" : "#00FF94";
  
  let html = `
    <div style="background:rgba(0,0,0,0.9);padding:15px;border-radius:10px;margin-bottom:15px;border:2px solid ${statusColor};">
      <div style="color:#00D9FF;font-weight:700;font-size:14px;margin-bottom:10px;">
        🚀 SAFE MODEL MANAGER
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div style="color:#8B9DB5;">
          📊 Active: <span style="color:#fff;font-weight:600;">${loadedCount}/${SAFE_CONFIG.MAX_ACTIVE_MODELS}</span>
        </div>
        <div style="color:#8B9DB5;">
          🔄 Queue: <span style="color:#fff;font-weight:600;">${queuedCount}</span>
        </div>
        <div style="color:#8B9DB5;">
          💾 Memory: <span style="color:${statusColor};font-weight:600;">${memMB}MB (${memPct}%)</span>
        </div>
        <div style="color:#8B9DB5;">
          ⚡ Loading: <span style="color:#fff;font-weight:600;">${activeLoads > 0 ? '🔄' : '✓'}</span>
        </div>
      </div>
    </div>
  `;
  
  MODEL_CATALOG.forEach((config, i) => {
    const cs = catalogState[i];
    const isLoaded = cs.state === "loaded";
    const isLoading = cs.state === "loading";
    const isQueued = cs.state === "queued";
    const isError = cs.state === "error";
    const isActive = isLoaded && cs.instanceIndex === currentActiveModel;
    
    let badge = "";
    let badgeColor = "#8B9DB5";
    
    if (isQueued) {
      const qPos = loadQueue.findIndex(q => q.catalogIdx === i) + 1;
      badge = `Queue #${qPos}`;
      badgeColor = "#FFA500";
    } else if (isLoading) {
      badge = "Loading...";
      badgeColor = "#00D9FF";
    } else if (isLoaded) {
      const distKm = Math.round(cs.lastDistance / 1000);
      badge = `Loaded | ${distKm}km | LOD${cs.lodLevel}`;
      badgeColor = "#00FF94";
    } else if (isError) {
      badge = "Error";
      badgeColor = "#ff4444";
    } else {
      badge = "Click to load";
      badgeColor = "#8B9DB5";
    }
    
    let actionBtns = "";
    if (isLoaded) {
      actionBtns = `
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button onclick="selectCatalogModel(${i})" style="flex:1;padding:6px;background:${isActive?'linear-gradient(135deg,#00D9FF,#00FF94)':'rgba(0,217,255,0.1)'};color:${isActive?'#000':'#fff'};border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">
            ${isActive ? '▶ Active' : '✏️ Edit'}
          </button>
          <button onclick="flyToCatalogModel(${i})" style="padding:6px 10px;background:rgba(0,217,255,0.1);color:#00D9FF;border:none;border-radius:6px;cursor:pointer;font-size:11px;">📍</button>
          <button onclick="unloadCatalogModel(${i})" style="padding:6px 10px;background:rgba(255,68,68,0.1);color:#ff4444;border:none;border-radius:6px;cursor:pointer;font-size:11px;">🗑️</button>
        </div>
      `;
    }
    
    const cardBg = isLoaded ? "rgba(0,217,255,0.05)" : isError ? "rgba(255,68,68,0.05)" : "rgba(0,0,0,0.2)";
    const cardBorder = isLoaded ? "rgba(0,217,255,0.3)" : isError ? "rgba(255,68,68,0.3)" : "rgba(139,157,181,0.15)";
    
    html += `
      <div style="background:${cardBg};border:1px solid ${cardBorder};border-radius:10px;padding:12px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;">
            <input 
              type="checkbox" 
              id="catalog-cb-${i}" 
              onchange="onCatalogCheckbox(${i}, this)" 
              ${isLoaded || isLoading || isQueued ? 'checked' : ''} 
              ${isLoading || isQueued ? 'disabled' : ''} 
              style="width:18px;height:18px;cursor:pointer;"
            >
            <span style="color:#fff;font-weight:600;font-size:13px;">${config.name}</span>
          </label>
        </div>
        <div style="font-size:11px;color:${badgeColor};margin-bottom:4px;">
          ${badge}
        </div>
        <div style="font-size:10px;color:#8B9DB5;">
          📁 ~${config.sizeMB}MB
        </div>
        ${actionBtns}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function onCatalogCheckbox(catalogIdx, checkbox) {
  const cs = catalogState[catalogIdx];
  
  if (checkbox.checked) {
    if (cs.state === "loaded") {
      const inst = modelInstances[cs.instanceIndex];
      if (inst) {
        inst.entity.show = true;
        inst.visible = true;
      }
      return;
    }
    addToLoadQueue(catalogIdx);
  } else {
    if (cs.state === "loaded") {
      const inst = modelInstances[cs.instanceIndex];
      if (inst) {
        inst.entity.show = false;
        inst.visible = false;
      }
    } else if (cs.state === "queued") {
      const qIdx = loadQueue.findIndex(q => q.catalogIdx === catalogIdx);
      if (qIdx >= 0) {
        loadQueue.splice(qIdx, 1);
        cs.state = "unloaded";
      }
    }
    renderCatalogUI();
  }
}

// ═══════════════════════════════════════════════════════════════════
// OTHER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
function selectCatalogModel(catalogIdx) {
  const cs = catalogState[catalogIdx];
  if (cs.state !== "loaded") return;
  const inst = modelInstances[cs.instanceIndex];
  if (!inst) return;
  currentActiveModel = cs.instanceIndex;
  window.modelEntity = inst.entity;
  applyParamsToUI(inst.params);
  renderCatalogUI();
  showToast(`✏️ ${inst.name} active`, "info");
}

function flyToCatalogModel(catalogIdx) {
  const cs = catalogState[catalogIdx];
  if (cs.state !== "loaded") return;
  const inst = modelInstances[cs.instanceIndex];
  if (!inst) return;
  const p = inst.params;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.height + 800),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
    duration: 2.0
  });
}

function applyParamsToUI(p) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && v !== undefined) el.value = v;
  };
  set("longitude", p.longitude);
  set("latitude", p.latitude);
  set("height", p.height);
  set("heading", p.heading);
  set("pitch", p.pitch);
  set("roll", p.roll);
  set("scale", p.scale);
}

function applyParamsToEntity(inst) {
  if (!inst || !inst.entity) return;
  const p = inst.params;
  const position = Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.height);
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(p.heading || 0),
    Cesium.Math.toRadians(p.pitch || 0),
    Cesium.Math.toRadians(p.roll || 0)
  );
  inst.entity.position = position;
  inst.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
  if (inst.entity.model) {
    inst.entity.model.scale = p.scale || 1.0;
    inst.entity.model.color = Cesium.Color.WHITE.withAlpha(p.opacity || 1.0);
  }
}

function updateLegacyStatus() {
  const loaded = catalogState.filter(s => s.state === "loaded").length;
  const statusEl = document.getElementById("modelStatus");
  if (statusEl) {
    statusEl.textContent = loaded > 0 ? `${loaded} Model(s)` : "No Models";
    statusEl.className = loaded > 0 ? "layer-status status-loaded" : "layer-status";
  }
}

function updateModelPosition() {
  if (currentActiveModel < 0 || !modelInstances[currentActiveModel]) return;
  const inst = modelInstances[currentActiveModel];
  inst.params.longitude = parseFloat(document.getElementById("longitude").value) || inst.params.longitude;
  inst.params.latitude = parseFloat(document.getElementById("latitude").value) || inst.params.latitude;
  inst.params.height = parseFloat(document.getElementById("height").value) || 0;
  applyParamsToEntity(inst);
}

function updateModelOrientation() {
  if (currentActiveModel < 0 || !modelInstances[currentActiveModel]) return;
  const inst = modelInstances[currentActiveModel];
  inst.params.heading = parseFloat(document.getElementById("heading").value) || 0;
  inst.params.pitch = parseFloat(document.getElementById("pitch").value) || 0;
  inst.params.roll = parseFloat(document.getElementById("roll").value) || 0;
  applyParamsToEntity(inst);
}

function updateModelScale() {
  if (currentActiveModel < 0 || !modelInstances[currentActiveModel]) return;
  const inst = modelInstances[currentActiveModel];
  inst.params.scale = parseFloat(document.getElementById("scale").value) || 1.0;
  if (inst.entity && inst.entity.model) inst.entity.model.scale = inst.params.scale;
}

function updateModelOpacity(value) {
  const opacity = parseFloat(value) / 100;
  const lb = document.getElementById("modelOpacityValue");
  if (lb) lb.textContent = value + "%";
  if (currentActiveModel >= 0 && modelInstances[currentActiveModel]) {
    const inst = modelInstances[currentActiveModel];
    inst.params.opacity = opacity;
    if (inst.entity && inst.entity.model) {
      inst.entity.model.color = Cesium.Color.WHITE.withAlpha(opacity);
    }
  }
}

function resetToGroundLevel() {
  document.getElementById("height").value = "0";
  updateModelPosition();
}

function centerOnModel() {
  if (currentActiveModel < 0 || !modelInstances[currentActiveModel]) return;
  const inst = modelInstances[currentActiveModel];
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(inst.params.longitude, inst.params.latitude, inst.params.height + 800),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-30), roll: 0 },
    duration: 1.5
  });
}

function optimizeMemory() {
  let count = 0;
  catalogState.forEach((cs, idx) => {
    if (cs.state !== "loaded") return;
    const inst = modelInstances[cs.instanceIndex];
    if (inst && !inst.visible) {
      unloadCatalogModel(idx);
      count++;
    }
  });
  
  if (viewer && viewer.scene) viewer.scene.requestRender();
  
  const memMB = Math.round(totalCacheSize / (1024 * 1024));
  showToast(
    count > 0 ? `⚡ Freed ${count} models - ${memMB}MB used` : `✓ Optimized - ${memMB}MB used`,
    count > 0 ? "success" : "info"
  );
  renderCatalogUI();
}

console.log("✅ Simple Safe Model Manager loaded");