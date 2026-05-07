/* eslint-disable no-undef */
// File: js/model_helpers.js
// Additional helper functions for multi-model system

/**
 * Update scale of active model
 */
function updateModelScale() {
  if (!modelInstances[currentActiveModel]) return;
  
  const activeModel = modelInstances[currentActiveModel];
  const newScale = parseFloat(document.getElementById("scale").value || 1.0);
  
  if (activeModel.entity && activeModel.entity.model) {
    activeModel.entity.model.scale = newScale;
    activeModel.params.scale = newScale;
    console.log(`Model ${currentActiveModel} scale updated to: ${newScale}`);
  }
}

/**
 * Show all models
 */
function showAllModels() {
  modelInstances.forEach((model, index) => {
    model.visible = true;
    model.entity.show = true;
    
    const toggleBtn = document.getElementById(`model-toggle-${index}`);
    if (toggleBtn) {
      toggleBtn.checked = true;
    }
  });
  console.log("All models shown");
}

/**
 * Hide all models
 */
function hideAllModels() {
  modelInstances.forEach((model, index) => {
    model.visible = false;
    model.entity.show = false;
    
    const toggleBtn = document.getElementById(`model-toggle-${index}`);
    if (toggleBtn) {
      toggleBtn.checked = false;
    }
  });
  console.log("All models hidden");
}

/**
 * Remove a specific model
 */
function removeModel(index) {
  if (index < 0 || index >= modelInstances.length) return;
  
  const model = modelInstances[index];
  
  // Remove entity from viewer
  if (model.entity) {
    viewer.entities.remove(model.entity);
  }
  
  // Remove from array
  modelInstances.splice(index, 1);
  
  // Update active model if necessary
  if (currentActiveModel >= modelInstances.length) {
    currentActiveModel = Math.max(0, modelInstances.length - 1);
  }
  
  // Update UI
  updateModelControlsUI();
  
  if (modelInstances.length > 0) {
    switchToModel(currentActiveModel);
  }
  
  console.log(`Model ${index} removed. Remaining: ${modelInstances.length}`);
}

/**
 * Remove all models
 */
function removeAllModels() {
  modelInstances.forEach(model => {
    if (model.entity) {
      viewer.entities.remove(model.entity);
    }
  });
  
  modelInstances.length = 0;
  currentActiveModel = 0;
  
  updateModelControlsUI();
  
  console.log("All models removed");
}

/**
 * Export model configuration
 */
function exportModelConfig() {
  const config = modelInstances.map(model => ({
    name: model.name,
    params: model.params,
    visible: model.visible
  }));
  
  const jsonStr = JSON.stringify(config, null, 2);
  
  // Download as JSON file
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'model_config.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("Model configuration exported");
}

/**
 * Import model configuration from JSON
 */
function importModelConfig(jsonConfig) {
  try {
    const config = JSON.parse(jsonConfig);
    
    // Remove existing models
    removeAllModels();
    
    // Load new models
    config.forEach(modelConfig => {
      addNewModel(modelConfig.params);
    });
    
    console.log(`Imported ${config.length} models`);
  } catch (error) {
    console.error("Error importing config:", error);
    alert("Invalid configuration file");
  }
}

/**
 * Get distance between two models
 */
function getModelDistance(index1, index2) {
  if (index1 < 0 || index1 >= modelInstances.length || 
      index2 < 0 || index2 >= modelInstances.length) {
    return null;
  }
  
  const pos1 = modelInstances[index1].entity.position.getValue(Cesium.JulianDate.now());
  const pos2 = modelInstances[index2].entity.position.getValue(Cesium.JulianDate.now());
  
  const distance = Cesium.Cartesian3.distance(pos1, pos2);
  
  console.log(`Distance between Model ${index1} and Model ${index2}: ${distance.toFixed(2)} meters`);
  return distance;
}

/**
 * Fly to view all models
 */
function viewAllModels() {
  if (modelInstances.length === 0) return;
  
  // Get all model positions
  const positions = modelInstances
    .filter(model => model.visible)
    .map(model => model.entity.position.getValue(Cesium.JulianDate.now()));
  
  if (positions.length === 0) return;
  
  // Calculate bounding sphere
  const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
  
  // Fly to bounding sphere
  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 2,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-30),
      boundingSphere.radius * 3
    )
  });
  
  console.log("Flying to view all models");
}

/**
 * Align models in a line
 */
function alignModelsInLine(axis = 'longitude', spacing = 0.001) {
  if (modelInstances.length < 2) return;
  
  const baseModel = modelInstances[0];
  const baseLat = baseModel.params.latitude;
  const baseLon = baseModel.params.longitude;
  
  modelInstances.forEach((model, index) => {
    if (index === 0) return; // Skip base model
    
    if (axis === 'longitude') {
      model.params.longitude = baseLon + (spacing * index);
      model.params.latitude = baseLat;
    } else {
      model.params.latitude = baseLat + (spacing * index);
      model.params.longitude = baseLon;
    }
    
    // Update position
    const position = Cesium.Cartesian3.fromDegrees(
      model.params.longitude,
      model.params.latitude,
      model.params.height
    );
    model.entity.position = position;
  });
  
  console.log(`Models aligned along ${axis} with ${spacing} spacing`);
  viewAllModels();
}

/**
 * Align models in a grid
 */
function alignModelsInGrid(rows, cols, spacingLat = 0.001, spacingLon = 0.001) {
  if (modelInstances.length === 0) return;
  
  const baseModel = modelInstances[0];
  const baseLat = baseModel.params.latitude;
  const baseLon = baseModel.params.longitude;
  
  let index = 0;
  for (let row = 0; row < rows && index < modelInstances.length; row++) {
    for (let col = 0; col < cols && index < modelInstances.length; col++) {
      const model = modelInstances[index];
      
      model.params.latitude = baseLat + (row * spacingLat);
      model.params.longitude = baseLon + (col * spacingLon);
      
      // Update position
      const position = Cesium.Cartesian3.fromDegrees(
        model.params.longitude,
        model.params.latitude,
        model.params.height
      );
      model.entity.position = position;
      
      index++;
    }
  }
  
  console.log(`Models arranged in ${rows}x${cols} grid`);
  viewAllModels();
}

/**
 * Rotate all models by same angle
 */
function rotateAllModels(headingDelta = 0, pitchDelta = 0, rollDelta = 0) {
  modelInstances.forEach(model => {
    model.params.heading += headingDelta;
    model.params.pitch += pitchDelta;
    model.params.roll += rollDelta;
    
    const position = model.entity.position.getValue(Cesium.JulianDate.now());
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(model.params.heading),
      Cesium.Math.toRadians(model.params.pitch),
      Cesium.Math.toRadians(model.params.roll)
    );
    
    model.entity.orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
  });
  
  console.log(`All models rotated by H:${headingDelta}° P:${pitchDelta}° R:${rollDelta}°`);
}

/**
 * Scale all models by same factor
 */
function scaleAllModels(scaleFactor = 1.0) {
  modelInstances.forEach(model => {
    model.params.scale *= scaleFactor;
    model.entity.model.scale = model.params.scale;
  });
  
  console.log(`All models scaled by factor: ${scaleFactor}`);
}

/**
 * Set all models to same height
 */
function setAllModelsHeight(height = 0) {
  modelInstances.forEach(model => {
    model.params.height = height;
    
    const position = Cesium.Cartesian3.fromDegrees(
      model.params.longitude,
      model.params.latitude,
      height
    );
    model.entity.position = position;
    
    const heightRef = height === 0
      ? Cesium.HeightReference.CLAMP_TO_GROUND
      : Cesium.HeightReference.RELATIVE_TO_GROUND;
    
    model.entity.model.heightReference = heightRef;
    model.entity.heightReference = heightRef;
  });
  
  console.log(`All models set to height: ${height}m`);
}

/**
 * Find nearest model to a point
 */
function findNearestModel(latitude, longitude) {
  if (modelInstances.length === 0) return null;
  
  const targetPos = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
  
  let nearestIndex = 0;
  let minDistance = Infinity;
  
  modelInstances.forEach((model, index) => {
    const modelPos = model.entity.position.getValue(Cesium.JulianDate.now());
    const distance = Cesium.Cartesian3.distance(targetPos, modelPos);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });
  
  console.log(`Nearest model: ${nearestIndex} at distance: ${minDistance.toFixed(2)}m`);
  return nearestIndex;
}

/**
 * Clone a model
 */
function cloneModel(sourceIndex, offsetLat = 0.001, offsetLon = 0.001) {
  if (sourceIndex < 0 || sourceIndex >= modelInstances.length) return;
  
  const source = modelInstances[sourceIndex];
  
  const newConfig = {
    name: `${source.name} (Copy)`,
    url: source.params.url || source.entity.model.uri._value,
    longitude: source.params.longitude + offsetLon,
    latitude: source.params.latitude + offsetLat,
    height: source.params.height,
    scale: source.params.scale,
    heading: source.params.heading,
    pitch: source.params.pitch,
    roll: source.params.roll,
    opacity: source.params.opacity
  };
  
  addNewModel(newConfig);
  
  console.log(`Model ${sourceIndex} cloned`);
}

// Make functions globally available
if (typeof window !== 'undefined') {
  window.updateModelScale = updateModelScale;
  window.showAllModels = showAllModels;
  window.hideAllModels = hideAllModels;
  window.removeModel = removeModel;
  window.removeAllModels = removeAllModels;
  window.exportModelConfig = exportModelConfig;
  window.importModelConfig = importModelConfig;
  window.getModelDistance = getModelDistance;
  window.viewAllModels = viewAllModels;
  window.alignModelsInLine = alignModelsInLine;
  window.alignModelsInGrid = alignModelsInGrid;
  window.rotateAllModels = rotateAllModels;
  window.scaleAllModels = scaleAllModels;
  window.setAllModelsHeight = setAllModelsHeight;
  window.findNearestModel = findNearestModel;
  window.cloneModel = cloneModel;
}