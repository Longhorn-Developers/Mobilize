// Rendering layer for reports

import { View } from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";
import { Button } from "~/src/features/components/Button";
import POIReportForm from "../../components/POIReportForm";

type POIReportOverlayProps = {
  report: ReturnType<typeof import("../hooks/usePOIReportMode").usePOIReportMode>;
  insets: EdgeInsets;
};

export function POIReportOverlay({
  report,
  insets,
}: POIReportOverlayProps) {
  if (report.state.isPOIReportMode) {
    return (
      <>
        <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
        <POIReportForm
          className="absolute left-10 right-10"
          style={{ top: insets.top + 25 }}
          onSubmit={async (data) => {
            console.log("tried submitting poi report", data);
          }}
          onExit={() => report.action.resetReport()}
        />
      </>
    );
  }
}