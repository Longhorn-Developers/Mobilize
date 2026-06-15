// Rendering layer for reports

import { View } from "react-native";
import { EdgeInsets } from "react-native-safe-area-context";
import ReportModal from "~/src/features/components/ReportModal";
import { Button } from "~/src/features/components/Button";

type ReportOverlayProps = {
  report: ReturnType<typeof import("../hooks/useReportMode").useReportMode>;
  canReport: boolean;
  insets: EdgeInsets;
  insertAvoidanceArea: (data: any) => Promise<any>;
  onEnterReport: () => void;
};

export function ReportOverlay({
  report,
  canReport,
  insets,
  insertAvoidanceArea,
  onEnterReport,
}: ReportOverlayProps) {
  if (report.state.isReportMode) {
    return (
      <>
        <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
        <ReportModal
          className="absolute left-10 right-10"
          style={{ top: insets.top + 25 }}
          aaPoints={report.state.aaPointsReport}
          currentStep={report.state.reportStep}
          setAAPoints={(points) => report.action.setAAPointsReport(points)}
          setCurrentStep={(index) => report.action.setReportStep(index)}
          onSubmit={async (data) => {
            const aaPoints = [...data.aaPoints, data.aaPoints[0]];
            // console.log("AAAAAA" + atob(data.images[0]).length);

            await insertAvoidanceArea({
              name: data.name,
              description: data.description,
              boundary_geojson: {
                type: "Polygon",
                coordinates: [
                  aaPoints.map((point) => [
                    point.longitude ?? 0,
                    point.latitude ?? 0,
                  ]),
                ],
              },
              images: data.images,
            });
          }}
          onExit={() => report.action.resetReport()}
        />
      </>
    );
  }

  if (!canReport) return null;

  return (
    <Button
      className="absolute bottom-4 right-4"
      title="Report"
      onPress={onEnterReport}
      style={{ position: "absolute", bottom: 16, right: 16 }}
    />
  );
}