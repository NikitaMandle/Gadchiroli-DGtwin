// DEBUG SCRIPT - Copy paste this in browser console (F12)
// Yeh script browser console mein run karo TIF file select karne ke baad

console.log("=== TIF DEBUG CHECK ===");

// 1. Check GeoTIFF library
console.log("1. GeoTIFF Library Check:");
console.log("   GeoTIFF exists:", typeof GeoTIFF !== 'undefined');
if (typeof GeoTIFF !== 'undefined') {
    console.log("   ✓ GeoTIFF library loaded");
} else {
    console.log("   ✗ GeoTIFF library NOT loaded - CHECK HTML!");
}

// 2. Check Cesium viewer
console.log("\n2. Cesium Viewer Check:");
console.log("   Viewer exists:", typeof viewer !== 'undefined');
if (typeof viewer !== 'undefined') {
    console.log("   ✓ Cesium viewer exists");
} else {
    console.log("   ✗ Viewer NOT found");
}

// 3. Check HTML elements
console.log("\n3. HTML Elements Check:");
const tifUpload = document.getElementById('tifUpload');
const tifToggle = document.getElementById('tifToggle');
const tifStatus = document.getElementById('tifStatus');

console.log("   tifUpload input:", tifUpload !== null);
console.log("   tifToggle checkbox:", tifToggle !== null);
console.log("   tifStatus span:", tifStatus !== null);

if (tifUpload) {
    console.log("   Files selected:", tifUpload.files.length);
    if (tifUpload.files.length > 0) {
        console.log("   File name:", tifUpload.files[0].name);
        console.log("   File size:", (tifUpload.files[0].size / 1024 / 1024).toFixed(2), "MB");
    }
}

// 4. Check if function exists
console.log("\n4. Function Check:");
console.log("   loadGeoTIFF exists:", typeof loadGeoTIFF === 'function');
console.log("   initializeTifUpload exists:", typeof initializeTifUpload === 'function');
console.log("   toggleModelType exists:", typeof toggleModelType === 'function');

// 5. Check TIF layer status
console.log("\n5. TIF Layer Status:");
console.log("   tifImageryLayer:", typeof tifImageryLayer !== 'undefined' ? tifImageryLayer : 'not created yet');

// 6. Try to get any console errors
console.log("\n6. Recent Console Errors:");
console.log("   Check above for any red error messages");

console.log("\n=== END DEBUG CHECK ===");
console.log("\nNow try uploading your TIF file and watch the console!");