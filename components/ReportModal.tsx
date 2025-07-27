import colors from "~/types/colors";
import {
  CameraPlusIcon,
  PlusCircleIcon,
  WarningIcon,
  XIcon,
} from "phosphor-react-native";
import { View, Text, TextInput } from "react-native";
import { Button } from "./Button";
import { ReactNode, useState, useEffect } from "react";
import { type LatLng } from "react-native-maps";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodType } from "zod";
import Toast from "react-native-toast-message";

const reportFormSchema = z.object({
  aaPoints: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }) satisfies ZodType<LatLng>,
    )
    .min(
      3,
      "The selected area does not have enough points. Please place down at least 3 markers to continue.",
    ),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters"),
  images: z.array(z.string()).optional(),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  className?: string;
  aaPoints: LatLng[];
  onClearAAPoints: () => void;
  onUndoAAPoints: () => void;
  onSubmit: (data: ReportFormData) => void;
  onExit: () => void;
}

const ReportModal = ({
  className,
  aaPoints,
  onClearAAPoints,
  onUndoAAPoints,
  onSubmit,
  onExit,
}: ReportModeDialogProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const {
    control,
    handleSubmit,
    getFieldState,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
  });

  // Sync aaPoints with form whenever they change
  useEffect(() => {
    setValue("aaPoints", aaPoints);
  }, [aaPoints, setValue]);

  const handleFormSubmit = (data: ReportFormData) => {
    onSubmit(data);
    Toast.show({
      type: "success",
      topOffset: 100,
      text2:
        "Thank you for your review! Your insights are helpful in shaping the community’s experience.",
    });
    onExit();
  };

  // Maps the current step to the specific zod validation
  const getCurrentStepState = async () => {
    switch (currentStep) {
      case 0:
        await trigger("aaPoints");
        return getFieldState("aaPoints");
      case 1:
        await trigger(["description", "images"], { shouldFocus: true });
        return getFieldState("description");
      default:
        return getFieldState("aaPoints");
    }
  };

  const handleNext = async () => {
    const state = await getCurrentStepState();
    if (!state.error) {
      if (currentStep === steps.length - 1) {
        // Last step submit
        handleSubmit(handleFormSubmit)();
      } else {
        // Go to next
        setCurrentStep(currentStep + 1);
      }
    } else {
      Toast.show({
        type: "error",
        text2: state.error.message || "Please fill out the required fields.",
        position: "bottom",
        bottomOffset: 100,
      });
    }
  };

  // Each step of the report process
  const steps: ReactNode[] = [
    // Step 1: Mark Avoidance Area Points
    <View key={1}>
      <Text className="font-medium">
        Please indicate the Avoidance Area (AA) by marking points on the map
      </Text>
    </View>,

    // Step 2: Describe the blockage
    <View key={2}>
      <Text className="font-medium">
        Describe the blockage. What&apos;s the issue?
      </Text>
      {/* Description body input */}
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
            <View className="mb-2 mt-1 flex-row justify-between">
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
      {/* Add Photo Input */}
      <Controller
        control={control}
        name="images"
        render={({ field: { onBlur } }) => (
          <Button
            variant="gray"
            onBlur={onBlur}
            title="Add Photo"
            icon={<CameraPlusIcon style={{ marginRight: 4 }} size={20} />}
          />
        )}
      />
    </View>,

    // Step 3: Review and submit
    <View key={3}>
      <Text className="font-medium">Review the details of your report.</Text>
    </View>,
  ];

  return (
    <>
      {/* Main Modal */}
      <View className={`gap-4 rounded-lg bg-white px-8 py-6 ${className}`}>
        {/* Exit Button */}
        <Button
          variant="ghost"
          title=""
          className="absolute right-0 top-1"
          onPress={onExit}
          icon={<XIcon size={28} color={colors.ut.gray} />}
        />

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

        {/* Next/Submit Button */}
        <Button
          title={currentStep === steps.length - 1 ? "Submit" : "Next"}
          onPress={handleNext}
        />
      </View>

      {aaPoints.length > 0 ? (
        // (Undo|Clear) button
        <ActionButtonGroup
          actions={[
            { label: "Undo", onPress: onUndoAAPoints },
            { label: "Clear", onPress: onClearAAPoints },
          ]}
          className="absolute bottom-4 right-4"
        />
      ) : (
        // Interaction hint
        <>
          {/* Center Marker Overlay */}
          <View className="pointer-events absolute bottom-0 left-0 right-0 top-[20%] items-center justify-center">
            {/* The marker itself */}
            <PlusCircleIcon size={48} color={colors.theme.red} />
          </View>

          {/* Tooltip Overlay */}
          <View
            className="pointer-events-none absolute left-0 right-0 top-3/4 items-center"
            style={{ marginTop: 40 }}
          >
            {/* Arrow */}
            <View className="absolute top-[-8] h-4 w-4 rotate-45 transform bg-white" />
            {/* Tooltip Box */}
            <View className="rounded-lg bg-white px-8 py-3">
              <Text className="text-center text-sm text-ut-gray">
                Drag to navigate to the relevant points.{"\n"}
                Click to mark the area.
              </Text>
            </View>
          </View>
        </>
      )}
    </>
  );
};

export default ReportModal;
