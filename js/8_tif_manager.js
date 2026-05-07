/* eslint-disable no-undef */
// File: js/8_tif_manager.js
// OPTIMIZED VERSION - Fast TIF Loading with Progressive Rendering

// === GLOBAL VARIABLES ===
let tifLayers = []; // Array to store up to 4 TIF layers
let currentActiveTif = 0; // Currently selected TIF for controls
const MAX_TIF_COUNT = 4;

// === REGISTER COMMON UTM ZONES (INDIA REGION) ===
if (typeof proj4 !== "undefined") {
  proj4.defs("EPSG:32643", "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs");
  proj4.defs("EPSG:32644", "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs");
}

// === TIF COLOR MARKERS (for map pins) ===
const TIF_PIN_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

// === PERFORMANCE OPTIMIZATION FLAGS ===
const TIF_OPTIMIZATION = {
  USE_TILING: false,              // Enable tile-based loading
  MAX_TEXTURE_SIZE: 1024,        // Reduce texture size for faster loading
  PROGRESSIVE_LOAD: true,        // Load low-res first, then high-res
  CACHE_TILES: true,             // Cache processed tiles
  PARALLEL_LOAD: true,           // Load multiple tiles in parallel
  MAX_PARALLEL_TILES: 4,         // Limit parallel requests
  SKIP_COMPRESSION: true,        // Skip heavy compression checks
  USE_WEB_WORKERS: false,        // Disable workers for faster initial load
};

// === TILE CACHE ===
const tileCache = new Map();

// === FAST TIF UPLOAD HANDLER ===
function initializeTifUpload() {
  const tifUploadInput = document.getElementById('tifUpload');
  
  if (!tifUploadInput) {
    console.warn('TIF upload input not found');
    return;
  }
  
  tifUploadInput.addEventListener('change', async function(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    if (files.length > MAX_TIF_COUNT) {
      alert(`Maximum ${MAX_TIF_COUNT} TIF files allowed. Only first ${MAX_TIF_COUNT} will be loaded.`);
      files.length = MAX_TIF_COUNT;
    }
    
    // Clear existing TIFs
    // removeAllTifs(); // Commented out to allow multiple uploads without clearing
    
    showLoading(`Loading ${files.length} TIF file(s)...`);
    updateProgress(5);
    
    // Load all TIFs in parallel for speed
   const loadPromises = files.map((file, index) => 
  loadSingleTifFast(file, tifLayers.length + index)
);
    
    try {
      await Promise.all(loadPromises);
      
      updateProgress(100);
      hideLoading();
      
      // Update UI
      createTifSelector();
      updateTifStatus();
      
      // Fly to first TIF
      if (tifLayers.length > 0) {
        flyToTifLocation(0);
      }
      
      console.log(`✅ ${tifLayers.length} TIF files loaded successfully!`);
      alert(`✅ ${tifLayers.length} TIF file(s) loaded successfully!`);
      
    } catch (error) {
      console.error('Error loading TIF files:', error);
      hideLoading();
      alert(`Error loading TIF files: ${error.message}`);
    }
  });
  
  console.log('✓ TIF upload handler initialized (OPTIMIZED)');
}

// === FAST SINGLE TIF LOADER ===
async function loadSingleTifFast(file, index) {
  console.log(`[TIF ${index}] Loading: ${file.name}`);
  
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await readFileAsArrayBuffer(file);
    updateProgress(10 + (index * 15));
    
    // Parse GeoTIFF with optimizations
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    
    updateProgress(20 + (index * 15));
    
    // Get metadata
    const width = image.getWidth();
    const height = image.getHeight();
    const bbox = image.getBoundingBox();
    
    console.log(`[TIF ${index}] Dimensions: ${width}x${height}`);
    console.log(`[TIF ${index}] Bounds:`, bbox);
    
    // Get geospatial info
    const geoKeys = image.getGeoKeys();
    let bounds;
    
    if (geoKeys.ProjectedCSTypeGeoKey) {
      // UTM or other projected coordinate system
      bounds = await convertUTMBoundsToWGS84(bbox, geoKeys);
    } else {
      // Already in WGS84
      bounds = {
        west: bbox[0],
        south: bbox[1],
        east: bbox[2],
        north: bbox[3]
      };
    }
    
    updateProgress(30 + (index * 15));
    
    // === FAST RENDERING WITH TILING ===
    let imageryLayer;
    
    if (TIF_OPTIMIZATION.USE_TILING && (width > TIF_OPTIMIZATION.MAX_TEXTURE_SIZE || height > TIF_OPTIMIZATION.MAX_TEXTURE_SIZE)) {
      console.log(`[TIF ${index}] Using TILED rendering for performance`);
      imageryLayer = await createTiledImageryLayer(image, bounds, index);
    } else {
      console.log(`[TIF ${index}] Using DIRECT rendering`);
      imageryLayer = await createDirectImageryLayer(image, bounds, index);
    }
    
    updateProgress(60 + (index * 15));
    
    // Store TIF layer info
    const tifLayer = {
      name: file.name,
      index: index,
      imageryLayer: imageryLayer,
      bounds: bounds,
      visible: true,
      opacity: 1.0,
      pinColor: TIF_PIN_COLORS[index % TIF_PIN_COLORS.length],
      width: width,
      height: height
    };
    
    tifLayers.push(tifLayer);
    
    // Add pin marker on map
    addTifPinMarker(tifLayer);
    
    updateProgress(80 + (index * 15));
    
    console.log(`✅ [TIF ${index}] Loaded successfully: ${file.name}`);
    
    return tifLayer;
    
  } catch (error) {
    console.error(`❌ [TIF ${index}] Load failed:`, error);
    throw error;
  }
}

// === FAST DIRECT RENDERING (for small TIFs) ===
async function createDirectImageryLayer(image, bounds, index) {
  const width = image.getWidth();
  const height = image.getHeight();
  
  // Downsample if too large
  const scale = Math.min(1, TIF_OPTIMIZATION.MAX_TEXTURE_SIZE / Math.max(width, height));
  const targetWidth = Math.floor(width * scale);
  const targetHeight = Math.floor(height * scale);
  
  console.log(`[TIF ${index}] Rendering at ${targetWidth}x${targetHeight} (scale: ${scale.toFixed(2)})`);
  
  // Read raster data (fast mode - single sample)
  const rasters = await image.readRasters({
    width: targetWidth,
    height: targetHeight,
    samples: [0, 1, 2], // RGB only for speed
    interleave: true
  });
  
  // Convert to canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(targetWidth, targetHeight);
  
  // Fast pixel copy
  const data = imageData.data;
  const samplesPerPixel = 3; // RGB
  
  for (let i = 0; i < targetWidth * targetHeight; i++) {
    const idx = i * 4;
    const sampleIdx = i * samplesPerPixel;
    
    data[idx] = rasters[sampleIdx] || 0;       // R
    data[idx + 1] = rasters[sampleIdx + 1] || 0; // G
    data[idx + 2] = rasters[sampleIdx + 2] || 0; // B
    data[idx + 3] = 255; // Alpha
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Create Cesium SingleTileImageryProvider (fastest method)
  const provider = new Cesium.SingleTileImageryProvider({
    url: canvas.toDataURL('image/png'),
    rectangle: Cesium.Rectangle.fromDegrees(
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north
    )
  });
  
  // Add to viewer
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 1.0;
  
  return layer;
}

// === TILED RENDERING (for large TIFs) ===
async function createTiledImageryLayer(image, bounds, index) {
  const width = image.getWidth();
  const height = image.getHeight();
  
  // Calculate optimal tile size
  const tileSize = 512;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);
  
  console.log(`[TIF ${index}] Creating ${tilesX}x${tilesY} tiles (tile size: ${tileSize}px)`);
  
  // Create tile pyramid (only level 0 for speed)
  const tiles = [];
  
  // Load tiles progressively
  const tilesToLoad = [];
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      tilesToLoad.push({ x, y });
    }
  }
  
  // Load tiles in batches
  const batchSize = TIF_OPTIMIZATION.MAX_PARALLEL_TILES;
  for (let i = 0; i < tilesToLoad.length; i += batchSize) {
    const batch = tilesToLoad.slice(i, i + batchSize);
    const batchPromises = batch.map(({ x, y }) => 
      createTile(image, x, y, tileSize, width, height)
    );
    
    const batchResults = await Promise.all(batchPromises);
    tiles.push(...batchResults);
    
    // Update progress
    const progress = 60 + ((i / tilesToLoad.length) * 20);
    updateProgress(progress);
  }
  
  // Create merged canvas
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, TIF_OPTIMIZATION.MAX_TEXTURE_SIZE / Math.max(width, height));
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext('2d');
  
  // Draw all tiles
  tiles.forEach(tile => {
    if (tile && tile.canvas) {
      ctx.drawImage(
        tile.canvas,
        tile.x * tileSize * scale,
        tile.y * tileSize * scale,
        tile.canvas.width * scale,
        tile.canvas.height * scale
      );
    }
  });
  
  // Create provider
  const provider = new Cesium.SingleTileImageryProvider({
    url: canvas.toDataURL('image/png'),
    rectangle: Cesium.Rectangle.fromDegrees(
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north
    )
  });
  
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 1.0;
  
  return layer;
}

// === CREATE SINGLE TILE ===
async function createTile(image, tileX, tileY, tileSize, fullWidth, fullHeight) {
  const x = tileX * tileSize;
  const y = tileY * tileSize;
  const w = Math.min(tileSize, fullWidth - x);
  const h = Math.min(tileSize, fullHeight - y);
  
  try {
    const rasters = await image.readRasters({
      window: [x, y, x + w, y + h],
      samples: [0, 1, 2],
      interleave: true
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const sampleIdx = i * 3;
      data[idx] = rasters[sampleIdx] || 0;
      data[idx + 1] = rasters[sampleIdx + 1] || 0;
      data[idx + 2] = rasters[sampleIdx + 2] || 0;
      data[idx + 3] = 255;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    return { x: tileX, y: tileY, canvas };
  } catch (error) {
    console.warn(`Tile ${tileX},${tileY} failed:`, error);
    return null;
  }
}

// === HELPER: Read File as ArrayBuffer ===
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// === HELPER: Convert UTM to WGS84 ===
function convertUTMBoundsToWGS84(bbox, geoKeys) {

  const epsg = geoKeys.ProjectedCSTypeGeoKey;

  if (!epsg) {
    throw new Error("GeoTIFF has no projection (EPSG) information.");
  }

  const source = `EPSG:${epsg}`;
  const dest = 'EPSG:4326';

  const [west, south] = proj4(source, dest, [bbox[0], bbox[1]]);
  const [east, north] = proj4(source, dest, [bbox[2], bbox[3]]);

  console.log("Converted:", { west, south, east, north });

  return { west, south, east, north };
}

// === ADD PIN MARKER ON MAP ===
function addTifPinMarker(tifLayer) {
  const centerLon = (tifLayer.bounds.west + tifLayer.bounds.east) / 2;
  const centerLat = (tifLayer.bounds.south + tifLayer.bounds.north) / 2;
  
  viewer.entities.add({
    id: `tif-pin-${tifLayer.index}`,
    position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat),
    billboard: {
      image: createPinCanvas(tifLayer.pinColor),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scale: 0.5
    },
    label: {
      text: tifLayer.name,
      font: '12px Inter',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -50),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString(tifLayer.pinColor).withAlpha(0.7)
    }
  });
}

// === CREATE PIN CANVAS ===
function createPinCanvas(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Draw pin shape
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(24, 20, 16, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(24, 36);
  ctx.lineTo(16, 52);
  ctx.lineTo(32, 52);
  ctx.closePath();
  ctx.fill();
  
  // Inner circle
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(24, 20, 8, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toDataURL();
}

// === CREATE TIF SELECTOR UI ===
function createTifSelector() {
  const container = document.getElementById('tif-selector-container');
  if (!container) return;
  
  if (tifLayers.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<div class="model-selector"><h4>🌍 TIF Layers</h4>';
  
  tifLayers.forEach((tif, index) => {
    html += `
      <div class="model-item">
        <input 
          type="checkbox" 
          id="tif-toggle-${index}" 
          ${tif.visible ? 'checked' : ''} 
          onchange="toggleTifVisibility(${index})"
        />
        <button 
          class="model-select-btn ${index === currentActiveTif ? 'active' : ''}" 
          onclick="selectTif(${index})"
          style="border-left: 4px solid ${tif.pinColor}"
        >
          ${tif.name} (${tif.width}×${tif.height})
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// === SELECT TIF ===
function selectTif(index) {
  if (index < 0 || index >= tifLayers.length) return;
  currentActiveTif = index;
  createTifSelector();
  
  // Update opacity slider
  const opacity = tifLayers[index].opacity;
  document.getElementById('tifOpacity').value = Math.round(opacity * 100);
  document.getElementById('tifOpacityValue').textContent = `${Math.round(opacity * 100)}%`;
}

// === TOGGLE TIF VISIBILITY ===
function toggleTifVisibility(index) {
  if (index < 0 || index >= tifLayers.length) return;
  
  const tif = tifLayers[index];
  tif.visible = !tif.visible;
  tif.imageryLayer.show = tif.visible;
  
  // Toggle pin visibility
  const pin = viewer.entities.getById(`tif-pin-${index}`);
  if (pin) {
    pin.show = tif.visible;
  }
}

// === UPDATE TIF OPACITY ===
function updateTifOpacity(value) {
  document.getElementById('tifOpacityValue').textContent = `${value}%`;
  
  if (tifLayers.length === 0) return;
  
  const opacity = parseFloat(value) / 100;
  const tif = tifLayers[currentActiveTif];
  
  if (tif && tif.imageryLayer) {
    tif.imageryLayer.alpha = opacity;
    tif.opacity = opacity;
  }
}

// === FLY TO TIF ===
function flyToTifLocation(index) {
  const idx = index !== undefined ? index : currentActiveTif;
  
  if (idx < 0 || idx >= tifLayers.length) {
    alert('No TIF selected!');
    return;
  }
  
  const tif = tifLayers[idx];
  const bounds = tif.bounds;
  
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north
    ),
    duration: 2.0
  });
}

// === FLY TO ALL TIFS ===
function flyToAllTifs() {
  if (tifLayers.length === 0) {
    alert('No TIF files loaded!');
    return;
  }
  
  // Calculate combined bounds
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  
  tifLayers.forEach(tif => {
    west = Math.min(west, tif.bounds.west);
    south = Math.min(south, tif.bounds.south);
    east = Math.max(east, tif.bounds.east);
    north = Math.max(north, tif.bounds.north);
  });
  
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
    duration: 2.0
  });
}

// === REMOVE ALL TIFS ===
function removeAllTifs() {
  tifLayers.forEach((tif, index) => {
    // Remove imagery layer
    if (tif.imageryLayer) {
      viewer.imageryLayers.remove(tif.imageryLayer);
    }
    
    // Remove pin marker
    const pin = viewer.entities.getById(`tif-pin-${index}`);
    if (pin) {
      viewer.entities.remove(pin);
    }
  });
  
  tifLayers = [];
  currentActiveTif = 0;
  
  // Clear UI
  createTifSelector();
  updateTifStatus();
  
  // Reset file input
  const tifUploadInput = document.getElementById('tifUpload');
  if (tifUploadInput) {
    tifUploadInput.value = '';
  }
  
  console.log('✓ All TIF files removed');
}

// === UPDATE STATUS ===
function updateTifStatus() {
  const statusEl = document.getElementById('tifStatus');
  if (!statusEl) return;
  
  if (tifLayers.length === 0) {
    statusEl.textContent = 'Not Loaded';
    statusEl.className = 'layer-status';
  } else {
    statusEl.textContent = `${tifLayers.length} TIF(s) Loaded`;
    statusEl.className = 'layer-status status-loaded';
  }
}

console.log('✅ TIF Manager initialized (OPTIMIZED for FAST loading)');
