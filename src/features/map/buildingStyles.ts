// Helper function to get building styles

export function getBuildingStyles(isDark: boolean) {
  return {
    buildingExtrusionColor: isDark
      ? (["interpolate", ["linear"], ["get", "Shape__Area"], 0, "#5A5550", 50000, "#4A4540"] as any)
      : (["interpolate", ["linear"], ["get", "Shape__Area"], 0, "#D6D2C4", 50000, "#C8C3B8"] as any),
    labelTextColor: isDark ? "#E5E7EB" : "#3D2B1F",
    labelHaloColor: isDark ? "#1C1C1E" : "#FFFFFF",
  };
}
