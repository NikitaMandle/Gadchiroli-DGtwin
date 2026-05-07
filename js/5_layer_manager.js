/* eslint-disable no-undef */
// File: js/5_layer_manager.js
// Clean Layer Manager (User KMZ Only)

// ======================================================
// USER KMZ UPLOAD SYSTEM
// ======================================================

let userKmzDataSource = null;


// Handle KMZ Upload
function handleUserKmzUpload(file) {
  if (!file) return;

  showLoading("Loading KMZ file...");
  updateProgress(20);

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const arrayBuffer = e.target.result;

      // Unzip KMZ
      const zip = await JSZip.loadAsync(arrayBuffer);

      let kmlFile = null;
      for (const filename in zip.files) {
        if (filename.toLowerCase().endsWith(".kml")) {
          kmlFile = zip.files[filename];
          break;
        }
      }

      if (!kmlFile) throw new Error("No KML found inside KMZ");

      updateProgress(50);

      const kmlText = await kmlFile.async("text");

      // Convert to blob
      const blob = new Blob([kmlText], {
        type: "application/vnd.google-earth.kml+xml",
      });

      const url = URL.createObjectURL(blob);

      // Load into Cesium
      const dataSource = await Cesium.KmlDataSource.load(url, {
        camera: viewer.scene.camera,
        canvas: viewer.scene.canvas,
        clampToGround: true,
      });

      URL.revokeObjectURL(url);

      // Remove previous KMZ
      if (userKmzDataSource) viewer.dataSources.remove(userKmzDataSource);

      userKmzDataSource = dataSource;
      viewer.dataSources.add(userKmzDataSource);

      updateProgress(90);

      flyToUserKmz();

      document.getElementById("userKmzStatus").textContent = "Loaded";
      document.getElementById("userKmzStatus").className =
        "layer-status status-loaded";

      updateProgress(100);
      hideLoading();

      console.log("✓ User KMZ Loaded");

    } catch (err) {
      console.error(err);
      hideLoading();
      alert("Invalid KMZ file!");
    }
  };

  reader.readAsArrayBuffer(file);
}


// Toggle visibility
function toggleUserKmz() {
  const checkbox = document.getElementById("userKmzToggle");
  if (userKmzDataSource) userKmzDataSource.show = checkbox.checked;
}


// Remove KMZ
function removeUserKmz() {
  if (!userKmzDataSource) return;

  viewer.dataSources.remove(userKmzDataSource);
  userKmzDataSource = null;

  document.getElementById("userKmzStatus").textContent = "Not Loaded";
  document.getElementById("userKmzStatus").className = "layer-status";
  document.getElementById("userKmzToggle").checked = false;

  alert("KMZ removed");
}


// Fly to KMZ
function flyToUserKmz() {
  if (!userKmzDataSource) return;

  viewer.flyTo(userKmzDataSource, {
    duration: 2,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-45),
      500
    ),
  });
}

console.log("✓ Clean Layer Manager Loaded");
