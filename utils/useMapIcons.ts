export default function useMapIcons() {
  const icons = {
    point: require("~/assets/map_icons/point.png"),
    autoDoor: require("~/assets/map_icons/auto_door.png"),
    manualDoor: require("~/assets/map_icons/manual_door.png"),
    crosshair: require("~/assets/map_icons/crosshair.png"),
  };
  return icons;
}
