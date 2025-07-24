import colors from "~/types/colors";
import { WarningIcon } from "phosphor-react-native";
import { View, Text, TextInput } from "react-native";
import { Button } from "./Button";
import { type LatLng } from "react-native-maps";
import { ReactNode, useState } from "react";

interface Step {
  content: ReactNode;
}

const steps: Step[] = [
  {
    content: (
      <Text className="font-semibold">
        Please indicate the problem area by marking five points on the map.
      </Text>
    ),
  },
  {
    content: (
      <View>
        <Text className="font-semibold">
          Describe the blockage. What&apos;s the issue?
        </Text>
        <TextInput
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
          className="mt-2 rounded border border-gray-300 px-4 py-3"
          placeholder="Please describe any issues encountered in the blockage's surroundings..."
        />
      </View>
    ),
  },
  {
    content: (
      <Text className="font-semibold">Review and submit your report.</Text>
    ),
  },
];

interface ReportModeDialogProps {
  className?: string;
  isVisible: boolean;
  aaPoints: LatLng[];
  onClearPoints: () => void;
  onSubmit: () => void;
}

export function ReportModal({
  className,
  isVisible,
  aaPoints,
  onClearPoints,
  onSubmit,
}: ReportModeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = steps.length;
  const canGoPrevious = currentStep > 0;
  const isLastStep = currentStep === totalSteps - 1;

  if (!isVisible) return null;

  return (
    <>
      {/* Main Modal */}
      <View
        className={`rounded-lg border border-gray-200 bg-white p-4 shadow-lg ${className} gap-4`}
      >
        {/* Heading Container */}
        <View className="flex-row items-center gap-4">
          {/* Icon Container */}
          <View className="rounded-lg bg-theme-red/20 p-3">
            <WarningIcon size={24} color={colors.theme.red} />
          </View>

          {/* Heading and subheading */}
          <View>
            <Text className="text-4xl font-bold">Avoidance Area</Text>
            <Text className="text-xl font-semibold">
              Report a temporary blockage
            </Text>
          </View>
        </View>

        {/* Progress Indicator */}
        <View className="flex-row gap-2">
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              className={`h-2 flex-1 rounded-full ${
                index <= currentStep ? "bg-ut-burntorange" : "bg-ut-black/20"
              }`}
            />
          ))}
        </View>

        {/* Step indicator text */}
        <Text className="text-gray-600">
          Step {currentStep + 1} of {totalSteps}
        </Text>

        {/* Step content */}
        <View>{steps[currentStep]?.content}</View>

        {/* Navigation buttons */}
        <View className="flex-row justify-between gap-2">
          {canGoPrevious && currentStep > 0 && (
            <Button
              title="Previous"
              variant="disabled"
              onPress={() => setCurrentStep(currentStep - 1)}
            />
          )}

          <Button
            title={isLastStep ? "Submit" : "Next"}
            variant={"primary"}
            onPress={() => {
              if (isLastStep) {
                onSubmit();
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
          />
        </View>
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
