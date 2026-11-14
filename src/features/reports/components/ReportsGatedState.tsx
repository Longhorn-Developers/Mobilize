/** Shown instead of the reports when someone is signed out or isn't a UT student, so they know why -R.L. */
import { LockSimpleIcon } from "phosphor-react-native";
import { Text, View } from "react-native";

import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

type ReportsGatedStateProps = {
  isSignedIn: boolean;
};

export function ReportsGatedState({ isSignedIn }: ReportsGatedStateProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? "#F9FAFB" : colors.theme.black;

  const title = isSignedIn ? "Reports are for UT students" : "Sign in to see your reports";
  const body = isSignedIn
    ? "Sign in with your UT Google account (@utexas.edu) to make and see reports."
    : "Reports are only available when you're signed in with a UT account.";

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" },
        ]}
      >
        <LockSimpleIcon size={28} color={textColor} />
      </View>
      <Text style={[styles.stateTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.stateBody, { color: isDark ? "#9CA3AF" : "#64748B" }]}>{body}</Text>
    </View>
  );
}
