/* eslint-disable no-undef */
// File: js/7_main.js
// Yeh file saare event listeners ko attach karti hai aur app ko start karti hai.

let glbModels = [];
let currentActiveGlb = 0;

let uploadedLatitude = null;
let uploadedLongitude = null;

let uploadedHeightOffset = 0;   // NEW

let uploadedHeading = 0;
let uploadedPitch = 0;
let uploadedRoll = 0;

function getNumberInputValue(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function getCurrentModelOrientation() {
  return {
    heading: getNumberInputValue("heading", uploadedHeading),
    pitch: getNumberInputValue("pitch", uploadedPitch),
    roll: getNumberInputValue("roll", uploadedRoll),
  };
}

function utmToLatLon(easting, northing, zoneNumber, northernHemisphere = true) {

  const a = 6378137.0;
  const e = 0.081819191;
  const e1sq = 0.006739497;
  const k0 = 0.9996;

  const x = easting - 500000.0;
  let y = northing;

  if (!northernHemisphere) {
    y -= 10000000.0;
  }

  const m = y / k0;
  const mu = m / (a * (1 - Math.pow(e,2)/4 - 3*Math.pow(e,4)/64 - 5*Math.pow(e,6)/256));

  const e1 = (1 - Math.sqrt(1 - e*e)) / (1 + Math.sqrt(1 - e*e));

  const j1 = 3*e1/2 - 27*Math.pow(e1,3)/32;
  const j2 = 21*Math.pow(e1,2)/16 - 55*Math.pow(e1,4)/32;
  const j3 = 151*Math.pow(e1,3)/96;
  const j4 = 1097*Math.pow(e1,4)/512;

  const fp = mu + j1*Math.sin(2*mu) + j2*Math.sin(4*mu) +
             j3*Math.sin(6*mu) + j4*Math.sin(8*mu);

  const c1 = e1sq * Math.pow(Math.cos(fp),2);
  const t1 = Math.pow(Math.tan(fp),2);
  const r1 = a*(1-e*e)/Math.pow(1-e*e*Math.pow(Math.sin(fp),2),1.5);
  const n1 = a/Math.sqrt(1-e*e*Math.pow(Math.sin(fp),2));

  const d = x/(n1*k0);

  const lat = fp - (n1*Math.tan(fp)/r1) *
      (d*d/2 -
       (5+3*t1+10*c1-4*c1*c1-9*e1sq)*Math.pow(d,4)/24 +
       (61+90*t1+298*c1+45*t1*t1-252*e1sq-3*c1*c1)*Math.pow(d,6)/720);

  const lon = (d -
      (1+2*t1+c1)*Math.pow(d,3)/6 +
      (5-2*c1+28*t1-3*c1*c1+8*e1sq+24*t1*t1)*Math.pow(d,5)/120) / Math.cos(fp);

  const lonOrigin = (zoneNumber - 1)*6 - 180 + 3;

  return {
    latitude: lat * 180/Math.PI,
    longitude: lonOrigin + lon * 180/Math.PI
  };
}

viewer.scene.globe.depthTestAgainstTerrain = false;
viewer.scene.requestRenderMode = false;
viewer.scene.maximumRenderTimeChange = Infinity;

viewer.scene.postProcessStages.fxaa.enabled = false;  // sharp
viewer.scene.highDynamicRange = false;                // avoid washout
viewer.scene.globe.enableLighting = false;            // no dark shading
viewer.scene.fog.enabled = false;

viewer.resolutionScale = 2.0;                         // sharper render
viewer.scene.globe.show = true;



document
  .getElementById("heading")
  .addEventListener("input", debounce(updateModelOrientation, 300));
document
  .getElementById("pitch")
  .addEventListener("input", debounce(updateModelOrientation, 300));
document
  .getElementById("roll")
  .addEventListener("input", debounce(updateModelOrientation, 300));
document
  .getElementById("longitude")
  .addEventListener("input", debounce(updateModelPosition, 300));
document
  .getElementById("latitude")
  .addEventListener("input", debounce(updateModelPosition, 300));
document
  .getElementById("height")
  .addEventListener("input", debounce(updateModelPosition, 300));
document.getElementById("scale").addEventListener(
  "input",
  debounce(() => {
    if (modelEntity) {
      modelEntity.model.scale = parseFloat(
        document.getElementById("scale").value || 1.0
      );
    }
  }, 300)
);

// === NEW: KMZ Upload Event Listener ===
document.getElementById("kmzUpload").addEventListener("change", function(event) {
  const file = event.target.files[0];
  if (file) {
    handleUserKmzUpload(file);
  }
});
// === END: KMZ Upload Event Listener ===

//location file listener
document.getElementById("fileInput").addEventListener("change", function(event) {

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {

    const lines = e.target.result.trim().split("\n");

    if (lines.length < 2) {
      alert("Invalid UTM file");
      return;
    }

    // First line: WGS84 UTM 44N
    const header = lines[0].trim();
    const match = header.match(/UTM\s+(\d+)([NS])/);

    if (!match) {
      alert("Invalid UTM zone format");
      return;
    }

    const zoneNumber = parseInt(match[1]);
    const isNorthern = match[2] === "N";

    // Second line: easting northing height heading pitch roll.
    // If heading/pitch/roll are not provided, keep the UI defaults so GLB files stay flat.
let easting, northing, height = 0;
let orientation = getCurrentModelOrientation();
let heading = orientation.heading;
let pitch = orientation.pitch;
let roll = orientation.roll;
let hasHeadingFromFile = false;
let hasPitchFromFile = false;
let hasRollFromFile = false;

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].trim().split(/\s+/);

  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    easting = parseFloat(parts[0]);
    northing = parseFloat(parts[1]);

    if (parts.length >= 3 && !isNaN(parts[2]))
      height = parseFloat(parts[2]);

    if (parts.length >= 4 && !isNaN(parts[3])) {
      heading = parseFloat(parts[3]);
      hasHeadingFromFile = true;
    }

    if (parts.length >= 5 && !isNaN(parts[4])) {
      pitch = parseFloat(parts[4]);
      hasPitchFromFile = true;
    }

    if (parts.length >= 6 && !isNaN(parts[5])) {
      roll = parseFloat(parts[5]);
      hasRollFromFile = true;
    }

    break;
  }
}


    if (isNaN(easting) || isNaN(northing)) {
      alert("Invalid UTM coordinates");
      return;
    }

    const result = utmToLatLon(easting, northing, zoneNumber, isNorthern);

    uploadedLatitude = result.latitude;
    uploadedLongitude = result.longitude;

    document.getElementById("latitude").value = uploadedLatitude;
    document.getElementById("longitude").value = uploadedLongitude;

    console.log("Converted:", uploadedLatitude, uploadedLongitude);

    uploadedHeightOffset = height;

    const txtHasZeroOrientation =
      hasHeadingFromFile &&
      hasPitchFromFile &&
      hasRollFromFile &&
      heading === 0 &&
      pitch === 0 &&
      roll === 0;

    if (txtHasZeroOrientation) {
      orientation = getCurrentModelOrientation();
      heading = orientation.heading;
      pitch = orientation.pitch;
      roll = orientation.roll;
    }
   
uploadedHeading = heading;
uploadedPitch = pitch;
uploadedRoll = roll;
document.getElementById("height").value = height;
document.getElementById("heading").value = uploadedHeading;
document.getElementById("pitch").value = uploadedPitch;
document.getElementById("roll").value = uploadedRoll;

  };

  reader.readAsText(file);
});


//end of location file listener

// === NEW: GLB Upload Event Listener ===
document.getElementById("modelUpload").addEventListener("change", function (event) {

  const file = event.target.files[0];
  if (!file) return;

  if (uploadedLatitude === null || uploadedLongitude === null) {
    alert("Upload location file first!");
    return;
  }

  const reader = new FileReader();

reader.onload = function (e) {

  const blob = new Blob([e.target.result], { type: "model/gltf-binary" });
  const modelUrl = URL.createObjectURL(blob);

  const cartographic = Cesium.Cartographic.fromDegrees(
    uploadedLongitude,
    uploadedLatitude
  );

  Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartographic])
    .then(function (updatedPositions) {
      const terrainHeight = updatedPositions[0].height;
      const orientationValues = getCurrentModelOrientation();
      uploadedHeading = orientationValues.heading;
      uploadedPitch = orientationValues.pitch;
      uploadedRoll = orientationValues.roll;


      const finalHeight = terrainHeight + uploadedHeightOffset;

const position = Cesium.Cartesian3.fromDegrees(
  uploadedLongitude,
  uploadedLatitude,
  finalHeight
);


      const orientation = Cesium.Transforms.headingPitchRollQuaternion(
  position,
  new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(uploadedHeading),
    Cesium.Math.toRadians(uploadedPitch),
    Cesium.Math.toRadians(uploadedRoll)
  )
);

     const entity = viewer.entities.add({
  position: position,
  orientation: orientation,
  model: {
    uri: modelUrl,
    scale: 1.0,
    minimumPixelSize: 0,
    shadows: Cesium.ShadowMode.DISABLED
  }
     });
      
      // ADD THIS
const modelData = {
  name: file.name,
  index: glbModels.length,
  entity: entity,
  visible: true
};

glbModels.push(modelData);
createGlbSelector();

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    uploadedLongitude,
    uploadedLatitude,
    300
  )
});

    })
    .catch(function(error){
      console.error("Terrain sampling failed:", error);
    });
};


  reader.readAsArrayBuffer(file);  // 🔥 IMPORTANT: BINARY
});

// === END: GLB Upload Event Listener ===


window.addEventListener("beforeunload", function () {
  for (const url in textureUrlCache) {
    URL.revokeObjectURL(textureUrlCache[url]);
  }

  if (currentModelUrl) {
    URL.revokeObjectURL(currentModelUrl);
  }
});

console.log("=== Cesium 3D Model + KMZ Layers Viewer Initialized ===");
console.log("Layer Stacking Order:");
console.log("  1. Cesium Globe (base)");
console.log("  2. .glb Model / TIF Imagery (toggle)");
console.log("  3. Roads KMZ (paths.kmz)");
console.log("  4. Houses KMZ (HOUSES polygon.kmz)");
console.log("  5. User Uploaded KMZ (with auto fly-to)");
console.log("Features:");
console.log("  ✓ Depth testing enabled to prevent z-fighting");
console.log("  ✓ Height offsets for proper layer stacking");
console.log("  ✓ Model opacity control (doesn't affect globe)");
console.log("  ✓ Individual layer visibility toggles");
console.log("  ✓ TIF/GeoTIFF support with mutual exclusivity");
console.log("  ✓ User KMZ upload with automatic fly-to location");
console.log("  ✓ Tree database integration with click-to-view");

// =================================================================
// === UPDATED: GET LAT/LONG ON CLICK + TREE SEARCH ===
// =================================================================
viewer.screenSpaceEventHandler.setInputAction(function(click) {
  const pickedObject = viewer.scene.pick(click.position);
  
  // Check if houses layer entity was clicked
  if (
    Cesium.defined(pickedObject) &&
    Cesium.defined(pickedObject.id) &&
    pickedObject.id instanceof Cesium.Entity &&
    housesDataSource && 
    housesDataSource.entities.contains(pickedObject.id)
  ) {
    const clickedEntity = pickedObject.id;
    const houseId = clickedEntity.name;
    const propertyData = getCustomHouseData(houseId);
    addPinAndFlyToEntity(clickedEntity, propertyData);
    return;
  }
  
  // For everything else (including models), get terrain coordinates
  const cartesian = viewer.camera.pickEllipsoid(click.position);
  
  if (cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    
    console.log(`Clicked: Lat ${latitude.toFixed(6)}, Long ${longitude.toFixed(6)}`);
    
    // === NEW: Check for nearby trees ===
    if (typeof treeDatabase !== 'undefined' && typeof findNearbyTree === 'function') {
      const nearbyTree = findNearbyTree(latitude, longitude, 0.0001); // ~10 meter radius
      
      if (nearbyTree) {
        // Tree found! Show tree info instead of just coordinates
        showTreeInfo(nearbyTree, latitude, longitude);
      } else {
        // No tree found, show coordinates as before
        alert(`No tree found at this location\n\nLatitude: ${latitude.toFixed(6)}\nLongitude: ${longitude.toFixed(6)}`);
      }
    } else {
      // Tree database not loaded, show coordinates only
      alert(`Latitude: ${latitude.toFixed(6)}\nLongitude: ${longitude.toFixed(6)}`);
    }
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
// === END: GET LAT/LONG ON CLICK + TREE SEARCH ===

// === BADLAAV 4: Hide search results when clicking outside ===
document.addEventListener("click", function (event) {
  const searchContainer = document.getElementById("search-container");
  if (!searchContainer.contains(event.target)) {
    document.getElementById("search-results").innerHTML = "";
  }
});
// === END BADLAAV 4 ===

// === TIF INITIALIZATION ===
// Initialize TIF upload handler
initializeTifUpload();
console.log("✓ TIF upload handler initialized");
// === END TIF INITIALIZATION ===

function createGlbSelector() {
  const container = document.getElementById("glb-selector-container");
  if (!container) return;

  if (glbModels.length === 0) {
    container.innerHTML = "";
    return;
  }

  let html = '<div class="model-selector"><h4>📦 GLB Models</h4>';

  glbModels.forEach((model, index) => {
    html += `
      <div class="model-item">
        <input 
          type="checkbox"
          ${model.visible ? "checked" : ""}
          onchange="toggleGlbVisibility(${index})"
        />
        <button 
          class="model-select-btn ${index === currentActiveGlb ? "active" : ""}"
          onclick="selectGlb(${index})"
        >
          ${model.name}
        </button>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
}

function toggleGlbVisibility(index) {
  const model = glbModels[index];
  model.visible = !model.visible;

  if (model.entity) {
    model.entity.show = model.visible;
  }
}

function selectGlb(index) {
  currentActiveGlb = index;
  createGlbSelector();

  const model = glbModels[index];
  if (model.entity) {
    viewer.flyTo(model.entity);
  }
}

// Sabse aakhir mein, default model load karo
loadDefaultModel();

// Optional: Load default TIF if you have a default.tif file
// Uncomment the line below if you want to auto-load a default TIF
// loadDefaultTIF();
