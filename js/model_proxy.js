// Acts like Cesium Entity but controls Primitive internally
function createModelProxy(primitive, params) {
  return {
    primitive: primitive,
    model: {
      set scale(val) {
        params.scale = val;
        primitive.scale = val;
      },
      get scale() {
        return params.scale;
      },
      set color(val) {
        primitive.color = val;
      }
    },
    set position(cartesian) {
      params.longitude = Cesium.Math.toDegrees(
        Cesium.Cartographic.fromCartesian(cartesian).longitude
      );
      params.latitude = Cesium.Math.toDegrees(
        Cesium.Cartographic.fromCartesian(cartesian).latitude
      );
      params.height = Cesium.Cartographic.fromCartesian(cartesian).height;
      updatePrimitiveMatrix(primitive, params);
    }
  };
}
