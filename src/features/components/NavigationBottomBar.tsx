import { CaretLeftIcon, CaretRightIcon, SpeakerHighIcon, SpeakerSlashIcon, WarningIcon, XIcon } from "phosphor-react-native";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { formatDistance, formatDuration, formatETA } from "~/src/features/navigation/navigationUtils";

interface NavigationBottomBarProps {
  destinationName: string;
  totalDistanceMi: number;
  totalDurationSec: number;
  currentStepIndex: number;
  totalSteps: number;
  isMuted: boolean;
  isDark: boolean;
  bottomInset: number;
  onReportIncident: () => void;
  onToggleMute: () => void;
  onEnd: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
}

export function NavigationBottomBar({
  destinationName,
  totalDistanceMi,
  totalDurationSec,
  currentStepIndex,
  totalSteps,
  isMuted,
  isDark,
  bottomInset,
  onReportIncident,
  onToggleMute,
  onEnd,
  onNextStep,
  onPrevStep,
}: NavigationBottomBarProps) {
  const bg = isDark ? "#1C1C1E" : "#FFFFFF";
  const textPrimary = isDark ? "#F9FAFB" : "#1A2024";
  const textSecondary = isDark ? "#9CA3AF" : "#64748B";
  const divider = isDark ? "#3A3A3C" : "#E5E7EB";
  const btnBg = isDark ? "#2C2C2E" : "#F3F4F6";
  const accent = "#BF5700";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          paddingBottom: bottomInset + 12,
          shadowColor: isDark ? "#000" : "#333F48",
        },
      ]}
    >
      {/* Destination */}
      <Text style={[styles.destination, { color: textPrimary }]} numberOfLines={1}>
        {destinationName || "Destination"}
      </Text>

      <View style={[styles.divider, { backgroundColor: divider }]} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>ETA</Text>
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {formatETA(totalDurationSec)}
          </Text>
        </View>
        <View style={[styles.statDot, { backgroundColor: divider }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Time</Text>
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {formatDuration(totalDurationSec)}
          </Text>
        </View>
        <View style={[styles.statDot, { backgroundColor: divider }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Distance</Text>
          <Text style={[styles.statValue, { color: textPrimary }]}>
            {formatDistance(totalDistanceMi)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: divider }]} />

      {/* Step navigation (for testing) */}
      <View style={styles.stepRow}>
        <TouchableOpacity
          onPress={onPrevStep}
          disabled={currentStepIndex === 0}
          style={[styles.stepBtn, { opacity: currentStepIndex === 0 ? 0.35 : 1 }]}
          activeOpacity={0.7}
        >
          <CaretLeftIcon size={18} color={textPrimary} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: textSecondary }]}>
          Step {currentStepIndex + 1} of {totalSteps}
        </Text>
        <TouchableOpacity
          onPress={onNextStep}
          disabled={currentStepIndex >= totalSteps - 1}
          style={[styles.stepBtn, { opacity: currentStepIndex >= totalSteps - 1 ? 0.35 : 1 }]}
          activeOpacity={0.7}
        >
          <CaretRightIcon size={18} color={textPrimary} weight="bold" />
        </TouchableOpacity>
      </View>

      <View style={[styles.divider, { backgroundColor: divider }]} />

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: btnBg }]}
          onPress={onToggleMute}
          activeOpacity={0.7}
        >
          {isMuted
            ? <SpeakerSlashIcon size={18} color={textSecondary} weight="bold" />
            : <SpeakerHighIcon size={18} color={accent} weight="bold" />}
          <Text style={[styles.actionLabel, { color: isMuted ? textSecondary : accent }]}>
            {isMuted ? "Unmute" : "Mute"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: btnBg }]}
          onPress={onReportIncident}
          activeOpacity={0.7}
        >
          <WarningIcon size={18} color="#D10000" weight="bold" />
          <Text style={[styles.actionLabel, { color: "#D10000" }]}>Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.endBtn]}
          onPress={onEnd}
          activeOpacity={0.7}
        >
          <XIcon size={18} color="#FFFFFF" weight="bold" />
          <Text style={styles.endLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 25,
  },
  destination: {
    fontFamily: "Roboto Flex",
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "700",
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  stepBtn: {
    padding: 8,
  },
  stepLabel: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionLabel: {
    fontFamily: "Inter",
    fontWeight: "600",
    fontSize: 13,
  },
  endBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#BF5700",
  },
  endLabel: {
    fontFamily: "Inter",
    fontWeight: "700",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
