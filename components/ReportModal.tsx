import { zodResolver } from "@hookform/resolvers/zod";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  CameraPlusIcon,
  PencilSimpleLineIcon,
  WarningIcon,
  XIcon,
} from "phosphor-react-native";
import { ReactNode, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { LatLng } from "react-native-maps";
import Toast from "react-native-toast-message";
import { z, ZodType } from "zod";

import colors from "~/types/colors";

import { ActionButtonGroup } from "./ActionButtonGroup";
import { Button } from "./Button";

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
  name: z
    .string()
    .min(5, "Name must be at least 5 characters")
    .max(30, "Name must not exceed 30 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters"),
  images: z.array(z.string()).optional(),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  className?: string;
  style?: ViewStyle;
  aaPoints: LatLng[];
  currentStep: number;
  setAAPoints: (points: LatLng[]) => void;
  setCurrentStep: (index: number) => void;
  onSubmit: (data: ReportFormData) => void;
  onExit: () => void;
}

const ReportModal = ({
  className,
  style,
  aaPoints,
  setAAPoints,
  currentStep,
  setCurrentStep,
  onSubmit,
  onExit,
}: ReportModeDialogProps) => {
  const {
    control,
    handleSubmit,
    getFieldState,
    setValue,
    trigger,
    getValues,
    reset: resetForm,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: "",
      description: "",
      aaPoints: [],
    },
  });

  const bottomTabBarHeight = useBottomTabBarHeight();

  // Sync aaPoints with form whenever they change
  useEffect(() => {
    setValue("aaPoints", aaPoints);
  }, [aaPoints, setValue]);

  const handleClose = () => {
    setCurrentStep(0);
    setAAPoints([]);
    resetForm();
    onExit();
  };

  const handleFormSubmit = (data: ReportFormData) => {
    onSubmit(data);
    handleClose();
  };

  // Maps the current step to the specific zod validation
  const getCurrentStepState = async () => {
    switch (currentStep) {
      case 0:
        await trigger("aaPoints");
        return getFieldState("aaPoints");
      case 1:
        await trigger(["name", "description", "images"], {
          shouldFocus: true,
        });
        const nameState = getFieldState("name");
        if (nameState.error) return nameState;
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
        bottomOffset: bottomTabBarHeight + 50,
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
      {/* Description body input */}
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <>
            <View>
              <TextInput
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
                className={`mt-2 rounded-xl border px-4 pb-16 pt-3 ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Please describe any issues encountered in the blockage's surroundings..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                maxLength={500}
              />
              <Text className="absolute bottom-2 right-3 text-xs text-gray-500">
                {value ? value.length : 0}/500
              </Text>
            </View>
            <View className="mb-2 mt-1">
              <View>
                {errors.description && (
                  <Text className="text-sm text-red-500">
                    {errors.description.message}
                  </Text>
                )}
              </View>
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
      <Text className="font-medium">Review the details of your report</Text>
      <TextInput
        multiline={true}
        numberOfLines={4}
        className={`mt-2 rounded-lg border border-gray-300 px-4 py-3`}
        placeholder="Please describe any issues encountered in the blockage's surroundings..."
        value={getValues("description")}
        maxLength={500}
        editable={false}
      />
    </View>,
  ];

  return (
    <>
      {/* Main Modal */}
      <View
        className={`gap-4 rounded-lg bg-white px-8 py-6 ${className}`}
        style={style}
      >
        {/* Exit Button */}
        <Button
          variant="ghost"
          title=""
          className="absolute right-0 top-0"
          onPress={handleClose}
          icon={<XIcon size={28} color={colors.ut.gray} />}
        />

        {/* Heading Container */}
        <View className="flex-row items-center gap-4">
          {/* Icon Container */}
          <View className="rounded-lg bg-theme-red/20 p-3">
            <WarningIcon size={24} color={colors.theme.red} />
          </View>

          {/* Heading and subheading */}
          <View className="flex-1">
            {currentStep === 1 ? (
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    className={`flex-row items-center justify-center border-b pb-1 ${
                      errors.name ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    <PencilSimpleLineIcon
                      size={20}
                      color={colors.ut.gray}
                      style={{ width: 16, height: 16, margin: 4 }}
                    />
                    <TextInput
                      placeholder="Name your report"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      className="flex-1 text-2xl font-bold text-gray-400"
                    />
                  </View>
                )}
              />
            ) : (
              <Text className={`text-2xl font-bold`}>
                {getValues("name") || "Avoidance Area"}
              </Text>
            )}

            {/* Subheading */}
            <Text className="text-sm font-medium">
              Report a temporary blockage
            </Text>

            {/* Name Errors */}
            {errors.name && currentStep === 1 && (
              <Text className="text-sm text-red-500">
                {errors.name.message}
              </Text>
            )}
          </View>
        </View>

        {/* Progress Indicator */}
        <View className="flex-row gap-2">
          {Array.from({ length: steps.length }, (_, index) => (
            <TouchableOpacity
              key={index}
              onPress={
                index <= currentStep ? () => setCurrentStep(index) : undefined
              }
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

        {/* Action Buttons */}
        <View className="gap-2">
          <Button
            title={currentStep === steps.length - 1 ? "Submit" : "Next"}
            variant={aaPoints.length >= 3 ? "primary" : "disabled"}
            onPress={handleNext}
          />
          {currentStep > 0 && (
            <Button
              title="Back"
              variant="gray"
              onPress={() => setCurrentStep(currentStep - 1)}
            />
          )}
        </View>
      </View>

      {aaPoints.length > 0 ? (
        // (Undo|Clear) button
        currentStep === 0 && (
          <ActionButtonGroup
            actions={[
              {
                label: "Undo",
                onPress: () => setAAPoints(aaPoints.slice(0, -1)),
              },
              { label: "Clear", onPress: () => setAAPoints([]) },
            ]}
            className="absolute bottom-4 right-4"
          />
        )
      ) : (
        <PointInteractionHint />
      )}
    </>
  );
};

const PointInteractionHint = () => {
  return (
    <>
      {/* Center Marker Overlay */}

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
  );
};

export default ReportModal;
