import { ArrowUpIcon } from "phosphor-react-native";
import { View, Text, StyleSheet } from "react-native";

import { getDirectionIcon, formatBannerDistance } from "~/src/features/navigation/navigationUtils";
import { type ORSStep } from "~/utils/openRouteService";

interface DirectionsBannerProps {
  step: ORSStep | undefined;
  // Distance from the traveler's current position to this step's maneuver —
  // i.e. the previous step's leg length, not this step's own (which describes
  // the leg *after* the maneuver). Undefined for the first step: there's no
  // lead-in distance to call out before the initial "head north" instruction.
  leadDistance: number | undefined;
  isDark: boolean;
  insetTop: number;
}

export function DirectionsBanner({ step, leadDistance, isDark, insetTop }: DirectionsBannerProps) {
  const accent = "#BF5700";
  const bg = isDark ? "#1A2024" : "#FFFFFF";
  const instructionColor = isDark ? "#FFFFFF" : "#1A2024";
  const distanceColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(26,32,36,0.55)";

  const rawInstruction = step?.instruction ?? "Starting navigation…";
  const distPrefix = step && leadDistance !== undefined ? formatBannerDistance(leadDistance) : "";
  // "in 200 feet, turn left on Dean Keeton St"
  const instruction = distPrefix
    ? `${distPrefix}, ${rawInstruction.charAt(0).toLowerCase()}${rawInstruction.slice(1)}`
    : rawInstruction;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insetTop + 12 }]}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          {step
            ? getDirectionIcon(step, accent)
            : <ArrowUpIcon size={28} color={accent} weight="bold" />}
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.instruction, { color: instructionColor }]} numberOfLines={2}>
            {instruction}
          </Text>
          {!distPrefix && step && (
            <Text style={[styles.distance, { color: distanceColor }]}>Arriving soon</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingBottom: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(191,87,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  instruction: {
    fontFamily: "Roboto Flex",
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 22,
  },
  distance: {
    fontFamily: "Inter",
    fontWeight: "500",
    fontSize: 18,
  },
});
