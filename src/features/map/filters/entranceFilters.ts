import type { SymbolLayer } from "@rnmapbox/maps";
import type { ComponentProps } from "react";

import type { mapIcons } from "~/utils/useMapIcons";

type LayerFilter = NonNullable<ComponentProps<typeof SymbolLayer>["filter"]>;

export type EntranceFilterKey = "autoDoor" | "manualDoor" | "ramp";

export type EntranceFilterOption = {
  key: EntranceFilterKey;
  label: string;
  icon: keyof typeof mapIcons;
};

export const ENTRANCE_FILTER_OPTIONS: readonly EntranceFilterOption[] = [
  { key: "autoDoor", label: "Power-assisted doors", icon: "lightning" },
  { key: "manualDoor", label: "Manual doors", icon: "door" },
  { key: "ramp", label: "Ramps", icon: "ramp_solo" },
];

const SHOW_ALL_DOORS: LayerFilter = ["has", "icon"];
const SHOW_NO_DOORS: LayerFilter = ["!", ["has", "icon"]];
export function getDoorLayerFilter(selected: readonly EntranceFilterKey[]): LayerFilter {
  if (selected.length === 0) return SHOW_ALL_DOORS;
  const doorIcons = selected.filter((key) => key !== "ramp");
  return doorIcons.length > 0 ? ["match", ["get", "icon"], doorIcons, true, false] : SHOW_NO_DOORS;
}
export function isRampLayerVisible(selected: readonly EntranceFilterKey[]): boolean {
  return selected.length === 0 || selected.includes("ramp");
}
