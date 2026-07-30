import AsyncStorage from "@react-native-async-storage/async-storage";

export type MapDetailMode = "simple" | "detailed";

const MAP_DETAIL_MODE_KEY = "map_detail_mode";

export async function getStoredMapDetailMode(): Promise<MapDetailMode> {
  const raw = await AsyncStorage.getItem(MAP_DETAIL_MODE_KEY);
  if (raw === "simple" || raw === "detailed") {
    return raw;
  }
  return "detailed";
}

export async function setStoredMapDetailMode(mode: MapDetailMode): Promise<void> {
  await AsyncStorage.setItem(MAP_DETAIL_MODE_KEY, mode);
}
