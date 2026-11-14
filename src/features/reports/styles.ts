/** Layout styles for My Reports, colors stay in the components since they change with dark mode -R.L. */
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: {
    fontSize: 20,
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 14 },
});

export default styles;
