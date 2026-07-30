// Utility functions for handling Points of Interest (POIs)

export function getPOISubtype(poi: any): string {
    switch (poi.poi_type) {
      case "accessible_entrance":
        return `accessible_entrance__${poi.metadata?.auto_opene ? "auto" : "manual"}`;
      default:
        return poi.poi_type;
    }
  }
  
export const isEntrancePoi = (poi: any) => {
    const poiType = String(poi?.poi_type ?? "").toLowerCase();
    return poiType.includes("entrance") && !poiType.includes("ramp");
  };