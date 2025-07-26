import colors from "~/types/colors";
import { WarningIcon, XIcon } from "phosphor-react-native";
import { View, Text, TextInput } from "react-native";
import { Button } from "./Button";
import { ReactNode, useState, useEffect } from "react";
import { type LatLng } from "react-native-maps";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const reportFormSchema = z.object({
  aaPoints: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .min(
      3,
      "The selected area does not have enough points. Please place down at least 3 markers to continue.",
    ),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters"),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  className?: string;
  aaPoints: LatLng[];
  onClearAAPoints: () => void;
  onUndoAAPoints: () => void;
  onSubmit: (data: ReportFormData & { aaPoints: LatLng[] }) => void;
  onExit: () => void;
}

export function ReportModal({
  className,
  aaPoints,
  onClearAAPoints,
  onUndoAAPoints,
  onSubmit,
  onExit,
}: ReportModeDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
  });

  // Sync aaPoints with form whenever they change
  useEffect(() => {
    setValue("aaPoints", aaPoints);
  }, [aaPoints, setValue]);

  const handleFormSubmit = (data: ReportFormData) => {
    onSubmit(data);
    onExit();
  };

  // Define steps with form integration
  const steps: ReactNode[] = [
    // Step 1: Mark Avoidance Area Points
    <View key={1}>
      <Text className="font-semibold">
        Please indicate the Avoidance Area (AA) by marking points on the map
      </Text>
      {errors.aaPoints && (
        <Text className="mt-2 text-sm text-red-500">
          {errors.aaPoints.message}
        </Text>
      )}
    </View>,
    // Step 2: Describe the blockage
    <View key={2}>
      <Text className="font-semibold">
        Describe the blockage. What&apos;s the issue?
      </Text>
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <>
            <TextInput
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              className={`mt-2 rounded border px-4 py-3 ${
                errors.description ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Please describe any issues encountered in the blockage's surroundings..."
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              maxLength={500}
            />
            <View className="mt-1 flex-row justify-between">
              <View>
                {errors.description && (
                  <Text className="text-sm text-red-500">
                    {errors.description.message}
                  </Text>
                )}
              </View>
              <Text className="text-sm text-gray-500">
                {value ? value.length : 0}/500
              </Text>
            </View>
          </>
        )}
      />
    </View>,
    // Step 3: Review and submit
    <View key={3}>
      <Text className="mb-4 font-semibold">Review and submit your report.</Text>
    </View>,
  ];

  const validateCurrentStep = async () => {
    switch (currentStep) {
      case 0:
        return await trigger("aaPoints");
      case 1:
        return await trigger("description");
      default:
        return await trigger();
    }
  };

  return (
    <>
      {/* Main Modal */}
      <View className={`gap-4 rounded-lg bg-white px-8 py-6 ${className}`}>
        {/* Exit Button */}
        <Button
          variant="ghost"
          title=""
          className="absolute right-[0.25] top-1"
          onPress={onExit}
        >
          <XIcon size={28} color={colors.ut.gray} />
        </Button>

        {/* Heading Container */}
        <View className="flex-row items-center gap-4">
          {/* Icon Container */}
          <View className="rounded-lg bg-theme-red/20 p-3">
            <WarningIcon size={24} color={colors.theme.red} />
          </View>

          {/* Heading and subheading */}
          <View>
            <Text className="text-4xl font-bold">Avoidance Area</Text>
            <Text className="text-xl font-medium">
              Report a temporary blockage
            </Text>
          </View>
        </View>

        {/* Progress Indicator */}
        <View className="flex-row gap-2">
          {Array.from({ length: steps.length }, (_, index) => (
            <View
              key={index}
              className={`h-2 flex-1 rounded-full ${
                index <= currentStep ? "bg-ut-burntorange" : "bg-ut-black/20"
              }`}
            />
          ))}
        </View>

        {/* Steps */}
        <View>
          {/* Step indicator text */}
          <Text className="mb-2 text-gray-600">
            Step {currentStep + 1} of {steps.length}
          </Text>

          {/* Step content */}
          {steps[currentStep]}
        </View>

        {/* Navigation buttons */}
        <View>
          {/* Next Button */}
          <Button
            title={currentStep === steps.length - 1 ? "Submit" : "Next"}
            onPress={async () => {
              const valid = await validateCurrentStep();
              if (valid) {
                if (currentStep === steps.length - 1) {
                  // Last step submit
                  handleSubmit(handleFormSubmit)();
                } else {
                  // Go to next
                  setCurrentStep(currentStep + 1);
                }
              }
            }}
          />
        </View>
      </View>

      {/* (Undo|Clear) button */}
      {aaPoints.length > 0 ? (
        <ActionButtonGroup
          actions={[
            { label: "Undo", onPress: onUndoAAPoints },
            { label: "Clear", onPress: onClearAAPoints },
          ]}
          className="absolute bottom-4 right-4"
        />
      ) : null}
    </>
  );
}
