/* eslint-disable no-undef */
// =====================================================
// TREE MANAGER — GPU OPTIMIZED VERSION
// =====================================================

// ---------------- GLOBALS ----------------
let treePointCollection = null;
let activeTreeDatabase = null;
let treeLayerVisible = false;


// ---------------- DATASET SWITCHER ----------------
function loadHector(type) {

  if (type === "ALL") {
    activeTreeDatabase = {
      ...treeDatabase_40H,
      ...treeDatabase_20H1,
      ...treeDatabase_20H2
    };
  } 
  else if (type === "40H") activeTreeDatabase = treeDatabase_40H;
  else if (type === "20H1") activeTreeDatabase = treeDatabase_20H1;
  else if (type === "20H2") activeTreeDatabase = treeDatabase_20H2;

  loadTreeDataset(activeTreeDatabase, type);
}


// ---------------- MAIN LOADER (GPU) ----------------
function loadTreeDataset(database, label) {

  if (!database) {
    alert("Tree dataset not available!");
    return;
  }

  showLoading(`Preparing ${label} trees...`);
  updateProgress(5);

  removeAllTrees();

  // GPU primitive collection
  treePointCollection = viewer.scene.primitives.add(
    new Cesium.PointPrimitiveCollection()
  );

  const keys = Object.keys(database);
  const total = keys.length;

  let added = 0;

  for (let i = 0; i < total; i++) {

    const tree = database[keys[i]];

    // skip invalid coordinates
    if (!Number.isFinite(tree.Latitude) || !Number.isFinite(tree.Longitude))
      continue;

    const isTimber = tree["Remarks (Timber/Fuel)"] === "T";

treePointCollection.add({
  position: Cesium.Cartesian3.fromDegrees(tree.Longitude, tree.Latitude),

  pixelSize: 10,

  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,

  scaleByDistance: new Cesium.NearFarScalar(
    100.0, 2.0,
    20000.0, 0.7
  ),

  translucencyByDistance: new Cesium.NearFarScalar(
    100.0, 1.0,
    50000.0, 0.15
  ),

  color: isTimber ? Cesium.Color.LIME : Cesium.Color.ORANGE,
  outlineColor: Cesium.Color.BLACK,
  outlineWidth: 1
});



    added++;

    // progress update (cheap)
    if (i % 3000 === 0)
      updateProgress(Math.floor((i / total) * 100));
  }

  updateProgress(100);
  hideLoading();

  treeLayerVisible = true;
  document.getElementById("treeLayerToggle").checked = true;

  document.getElementById("treeLayerStatus").textContent =
    `Loaded ${label} (${added.toLocaleString()} trees)`;
  document.getElementById("treeLayerStatus").className =
    "layer-status status-loaded";

  console.log(`✓ ${label} loaded: ${added} trees`);
enableTreeClick();

}


// ---------------- VISIBILITY ----------------
function toggleTreeLayer() {

  const checkbox = document.getElementById("treeLayerToggle");

  if (!treePointCollection) {
    if (checkbox.checked) loadHector("ALL");
    return;
  }

  treePointCollection.show = checkbox.checked;
  treeLayerVisible = checkbox.checked;
}


// ---------------- REMOVE ----------------
function removeAllTrees() {

  if (treePointCollection) {
    viewer.scene.primitives.remove(treePointCollection);
    treePointCollection = null;
  }

  treeLayerVisible = false;

  document.getElementById("treeLayerToggle").checked = false;
  document.getElementById("treeLayerStatus").textContent = "Not Loaded";
  document.getElementById("treeLayerStatus").className = "layer-status";
}


// ---------------- NEARBY SEARCH ----------------
function findNearbyTree(clickLat, clickLon, radiusDegrees = 0.0001) {

  if (!activeTreeDatabase) return null;

  let closestTree = null;
  let minDistance = Infinity;

  for (const id in activeTreeDatabase) {

    const tree = activeTreeDatabase[id];
    if (!Number.isFinite(tree.Latitude) || !Number.isFinite(tree.Longitude))
      continue;

    const distance =
      (clickLat - tree.Latitude) ** 2 +
      (clickLon - tree.Longitude) ** 2;

    if (distance < radiusDegrees && distance < minDistance) {
      minDistance = distance;
      closestTree = tree;
    }
  }

  return closestTree;
}


console.log("✓ Tree Manager (GPU Optimized) Ready");

// =====================================================
// TREE CLICK PICK HANDLER
// =====================================================

let treeClickHandler = null;

function enableTreeClick() {

  if (treeClickHandler) return;

  treeClickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  treeClickHandler.setInputAction(function (click) {

    if (!treeLayerVisible || !activeTreeDatabase) return;

    const cartesian = viewer.camera.pickEllipsoid(
      click.position,
      viewer.scene.globe.ellipsoid
    );

    if (!cartesian) return;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

    const clickLat = Cesium.Math.toDegrees(cartographic.latitude);
    const clickLon = Cesium.Math.toDegrees(cartographic.longitude);

    const tree = findNearbyTree(clickLat, clickLon, 0.00015);

    if (!tree) {
      viewer.selectedEntity = undefined;
      return;
    }

    showTreePopup(tree, clickLat, clickLon);

  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

enableTreeClick();

// =====================================================
// TREE POPUP INFO
// =====================================================

function showTreePopup(tree, clickLat, clickLon) {

  const distMeters = Math.sqrt(
    (clickLat - tree.Latitude) ** 2 +
    (clickLon - tree.Longitude) ** 2
  ) * 111320; // deg → meters approx

  const description = `
    <div style="font-family: sans-serif; line-height:1.6">
      <h3 style="margin:0 0 8px 0">🌳 Tree Details</h3>

      
     

      <b>Latitude:</b> ${tree.Latitude.toFixed(6)}<br>
      <b>Longitude:</b> ${tree.Longitude.toFixed(6)}<br>

      <b>Distance from click:</b> ${distMeters.toFixed(2)} meters<br>
      <b>Girth:</b> ${tree["Girth (Circumference)"]} cm
    </div>
  `;

  viewer.selectedEntity = new Cesium.Entity({
    name: "Tree Info",
    position: Cesium.Cartesian3.fromDegrees(tree.Longitude, tree.Latitude),
    description: description
  });
}
