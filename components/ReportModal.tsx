import { View, Text, TextInput } from "react-native";
import { Button } from "./Button";
import { type LatLng } from "react-native-maps";
import { ReactNode, useState } from "react";


interface Step {
  content: ReactNode;
}


interface ReportModeDialogProps {
  className?: string;
  isVisible: boolean;
  aaPoints: LatLng[];
  description: string;
  onDescriptionChange: (value: string) => void;
  onClearPoints: () => void;
  onSubmit: () => void;
}

export function ReportModal({
  className,
  isVisible,
  aaPoints,
  description,
  onDescriptionChange,
  onClearPoints,
  onSubmit,
}: ReportModeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [desc, updateDesc] = useState(description ?? ""); // initialize with prop if needed

  if (!isVisible) return null;

  // Steps moved inside so we can use desc state
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
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="mt-2 rounded border border-gray-300 px-4 py-3"
            placeholder="Please describe any issues encountered in the blockage's surroundings..."
            value={description} // coming from parent
            onChangeText={(text) => onDescriptionChange(text)} // notify parent
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

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const canGoPrevious = currentStep > 0;

  return (
    <>
      <View
        className={`rounded-lg border border-gray-200 bg-white p-4 shadow-lg ${className}`}
      >
        <Text className="mb-2 text-4xl font-bold">Avoidance Area</Text>
        <Text className="mb-4 text-xl font-semibold">
          Report a temporary blockage
        </Text>

        {/* Progress Indicator */}
        <View className="mb-4 flex-row gap-2">
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              className={`h-2 flex-1 rounded-full ${
                index <= currentStep ? "bg-ut-burntorange" : "bg-ut-black/20"
              }`}
            />
          ))}
        </View>

        <Text className="mb-4 text-gray-600">
          Step {currentStep + 1} of {totalSteps}
        </Text>

        {/* Step Content */}
        <View className="mb-4">{steps[currentStep].content}</View>

        {/* Navigation Buttons */}
        <View className="flex-row justify-between gap-2">
          {canGoPrevious && (
            <Button
              title="Previous"
              variant="disabled"
              onPress={() => setCurrentStep(currentStep - 1)}
            />
          )}
          <Button
            title={isLastStep ? "Submit" : "Next"}
            variant="primary"
            onPress={() => {
              if (isLastStep) {
                // Send description to parent or API here
                console.log("Submitted description:", desc);
                updateDesc("");
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

