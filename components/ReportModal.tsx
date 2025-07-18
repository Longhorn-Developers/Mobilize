import { View, Text } from "react-native";
import { Button } from "./Button";
import { type LatLng } from "react-native-maps";

interface ReportModeDialogProps {
  className?: string;
  isVisible: boolean;
  aaPoints: LatLng[];
  onSubmit: () => void;
  onClearPoints: () => void;
}

export function ReportModal({
  className,
  isVisible,
  aaPoints,
  onSubmit,
  onClearPoints,
}: ReportModeDialogProps) {
  if (!isVisible) return null;

  return (
    <>
      {/* Main Modal */}
      <View
        className={`rounded-lg border border-gray-200 bg-white p-4 shadow-lg ${className}`}
      >
        {/* Heading and subheading */}
        <Text className="mb-2 text-4xl font-bold">Avoidance Area</Text>
        <Text className="mb-4 text-xl font-semibold">
          Report a temporary blockage
        </Text>

        {/* Main content */}
        <Text className="mb-4 text-gray-600">Step 1 of 3</Text>
        <Text className="mb-4 font-semibold">
          Please indicate the problem area by marking five points on the map.
        </Text>

        <Button title="Next" onPress={onSubmit} />
      </View>

      {/* Clear Points Button */}
      {aaPoints.length > 0 && (
        <Button
          className="absolute bottom-4 left-4"
          title="Clear Points"
          onPress={onClearPoints}
        />
      )}
    </>
  );
}
