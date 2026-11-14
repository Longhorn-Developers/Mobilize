/** Layout styles for My Reports, colors stay in the components since they change with dark mode -R.L. */
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: {
    fontSize: 20,
    textAlign: "center",
    paddingVertical: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 20,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  cardIconTile: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cardSubtitle: { fontSize: 14 },
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
  stateTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});

export default styles;
