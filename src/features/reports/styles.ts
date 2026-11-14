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
  cardAddDetailButton: {
    borderWidth: 1,
    borderColor: "#BF5700",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardAddDetailText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#BF5700",
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  textInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  photoTile: {
    width: 72,
    height: 72,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
  },
  sheetActionButton: { flex: 1 },
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
