import { useImage } from "expo-image";

const imageOptions = {
  maxWidth: 64,
  maxHeight: 64,
};

export default function useMapIcons() {
  const icons = {
    point: useImage(require("~/assets/map_icons/point.svg"), imageOptions),
    autoDoor: useImage(
      require("~/assets/map_icons/auto_door.svg"),
      imageOptions,
    ),
    manualDoor: useImage(
      require("~/assets/map_icons/manual_door.svg"),
      imageOptions,
    ),
    crosshair: useImage(
      require("~/assets/map_icons/crosshair.svg"),
      imageOptions,
    ),
  };
  return icons;
}
