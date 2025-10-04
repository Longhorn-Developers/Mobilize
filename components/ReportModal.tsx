import colors from "~/types/colors";
import {
  CameraPlusIcon,
  PencilSimpleLineIcon,
  PlusCircleIcon,
  WarningIcon,
  XIcon,
  TrashIcon,
  CaretDownIcon,
} from "phosphor-react-native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  Image,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Button } from "./Button";
import { ReactNode, useEffect, useState } from "react";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodType } from "zod";
import Toast from "react-native-toast-message";
import { Coordinates } from "expo-maps";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "~/utils/AuthProvider";

const reportFormSchema = z.object({
  aaPoints: z
    .array(
      z.object({
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }) satisfies ZodType<Coordinates>,
    )
    .min(
      3,
      "The selected area does not have enough points. Please place down at least 3 markers to continue.",
    ),
  name: z
    .string()
    .min(5, "Name must be at least 5 characters")
    .max(30, "Name must not exceed 30 characters")
    .default("Avoidance Area"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  images: z.array(z.string()).optional(),
  tags: z.array(z.enum(["scooter", "construction", "event", "other"])).optional(),
});

const AVAILABLE_TAGS = ["scooter", "construction", "event", "other"] as const;

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  className?: string;
  style?: ViewStyle;
  aaPoints: Coordinates[];
  currentStep: number;
  setAAPoints: (points: Coordinates[]) => void;
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
    formState: { errors, isDirty },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: "Avoidance Area",
      description: "",
      aaPoints: [],
      images: [],
      tags: [],
    },
  });

  const { user } = useAuth();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [polygonArea, setPolygonArea] = useState<number>(0);

  // Sync aaPoints with form whenever they change
  useEffect(() => {
    setValue("aaPoints", aaPoints);
    
    // Calculate polygon area
    if (aaPoints.length >= 3) {
      // Simple polygon area calculation using Shoelace formula
      let area = 0;
      for (let i = 0; i < aaPoints.length; i++) {
        const j = (i + 1) % aaPoints.length;
        area += (aaPoints[i].latitude || 0) * (aaPoints[j].longitude || 0);
        area -= (aaPoints[j].latitude || 0) * (aaPoints[i].longitude || 0);
      }
      area = Math.abs(area) / 2;
      // Convert to approximate square meters (rough estimation)
      const areaSqMeters = area * 111320 * 111320;
      setPolygonArea(areaSqMeters);
    } else {
      setPolygonArea(0);
    }
  }, [aaPoints, setValue]);

  // Sync selected images with form
  useEffect(() => {
    setValue("images", selectedImages);
  }, [selectedImages, setValue]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need camera roll permissions to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    if (isDirty || aaPoints.length > 0) {
      setShowExitConfirm(true);
    } else {
      confirmExit();
    }
  };

  const confirmExit = () => {
    setCurrentStep(0);
    setAAPoints([]);
    setSelectedImages([]);
    resetForm();
    setShowExitConfirm(false);
    onExit();
  };

  const handleFormSubmit = (data: ReportFormData) => {
    const submissionData = {
      ...data,
      user_id: user?.id || null,
      created_at: new Date().toISOString(),
    };
    onSubmit(submissionData);
    confirmExit();
  };

  // Maps the current step to the specific zod validation
  const getCurrentStepState = async () => {
    switch (currentStep) {
      case 0:
        await trigger("aaPoints");
        return getFieldState("aaPoints");
      case 1:
        await trigger(["name"], { shouldFocus: true });
        return getFieldState("name");
      case 2:
        // Description and images are optional
        return { error: null };
      case 3:
        // Tags are optional
        return { error: null };
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
    <View key={1} className="gap-3">
      <Text className="font-medium">
        Please indicate the Avoidance Area (AA) by marking points on the map
      </Text>
      {aaPoints.length >= 3 && (
        <View className="rounded-lg bg-gray-50 p-3">
          <Text className="text-sm font-medium text-gray-700">Area Preview:</Text>
          <Text className="text-sm text-gray-600">
            {aaPoints.length} points • ~{Math.round(polygonArea)} sq meters
          </Text>
        </View>
      )}
    </View>,

    // Step 2: Name the area
    <View key={2} className="gap-3">
      <Text className="font-medium">Name your temporary blockage</Text>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <View className="relative">
            <TextInput
              placeholder="Enter a name for this area"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              className={`rounded-xl border px-4 py-3 pr-10 ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
              maxLength={50}
            />
            <CaretDownIcon 
              size={20} 
              color={colors.ut.gray} 
              style={{ position: 'absolute', right: 12, top: 12 }}
            />
            {errors.name && (
              <Text className="mt-1 text-sm text-red-500">
                {errors.name.message}
              </Text>
            )}
          </View>
        )}
      />
    </View>,

    // Step 3: Add details (description and photos)
    <View key={3} className="gap-4">
      <Text className="font-medium">Add details (optional)</Text>
      
      {/* Description */}
      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, onBlur, value } }) => (
          <View>
            <Text className="mb-2 text-sm font-medium text-gray-700">Description</Text>
            <View className="relative">
              <TextInput
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
                className={`rounded-xl border px-4 pb-8 pt-3 ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Describe the blockage and any issues in the surrounding area..."
                onBlur={onBlur}
                onChangeText={onChange}
                value={value || ""}
                maxLength={500}
              />
              <Text className="absolute bottom-2 right-3 text-xs text-gray-500">
                {(value || "").length}/500
              </Text>
            </View>
            {errors.description && (
              <Text className="mt-1 text-sm text-red-500">
                {errors.description.message}
              </Text>
            )}
          </View>
        )}
      />

      {/* Photos */}
      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700">Photos</Text>
        <Button
          variant="gray"
          title="Add Photo"
          onPress={pickImage}
          icon={<CameraPlusIcon style={{ marginRight: 4 }} size={20} />}
        />
        
        {/* Image Preview */}
        {selectedImages.length > 0 && (
          <ScrollView horizontal className="mt-3" showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {selectedImages.map((uri, index) => (
                <View key={index} className="relative">
                  <Image source={{ uri }} className="h-20 w-20 rounded-lg" />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1"
                  >
                    <XIcon size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>,

    // Step 4: Add tags
    <View key={4} className="gap-4">
      <Text className="font-medium">Add tags (optional)</Text>
      <Text className="text-sm text-gray-600">
        Select tags that best describe this blockage:
      </Text>
      
      <Controller
        control={control}
        name="tags"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => {
              const isSelected = value?.includes(tag) || false;
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => {
                    const currentTags = value || [];
                    const newTags = isSelected
                      ? currentTags.filter(t => t !== tag)
                      : [...currentTags, tag];
                    onChange(newTags);
                  }}
                  className={`rounded-full px-4 py-2 ${
                    isSelected 
                      ? "bg-ut-burntorange" 
                      : "bg-gray-200"
                  }`}
                >
                  <Text className={`capitalize ${
                    isSelected ? "text-white" : "text-gray-700"
                  }`}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    </View>,

    // Step 5: Review and submit
    <View key={5} className="gap-4">
      <Text className="font-medium">Review your report</Text>
      
      <View className="rounded-lg bg-gray-50 p-4 gap-3">
        <View>
          <Text className="font-medium text-gray-700">Name:</Text>
          <Text className="text-gray-600">{getValues("name") || "Avoidance Area"}</Text>
        </View>
        
        {getValues("description") && (
          <View>
            <Text className="font-medium text-gray-700">Description:</Text>
            <Text className="text-gray-600">{getValues("description")}</Text>
          </View>
        )}
        
        {getValues("tags")?.length > 0 && (
          <View>
            <Text className="font-medium text-gray-700">Tags:</Text>
            <View className="flex-row flex-wrap gap-1 mt-1">
              {getValues("tags")?.map((tag, index) => (
                <View key={index} className="rounded-full bg-ut-burntorange/20 px-2 py-1">
                  <Text className="text-xs capitalize text-ut-burntorange">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        <View>
          <Text className="font-medium text-gray-700">Area:</Text>
          <Text className="text-gray-600">
            {aaPoints.length} points • ~{Math.round(polygonArea)} sq meters
          </Text>
        </View>
        
        {selectedImages.length > 0 && (
          <View>
            <Text className="font-medium text-gray-700">Photos:</Text>
            <Text className="text-gray-600">{selectedImages.length} image(s) attached</Text>
          </View>
        )}
      </View>
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
            <Text className={`text-2xl font-bold`}>
              {getValues("name") || "Avoidance Area"}
            </Text>

            {/* Subheading */}
            <Text className="text-sm font-medium">
              Report a temporary blockage
            </Text>
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
      
      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="mx-8 rounded-lg bg-white p-6">
            <Text className="mb-2 text-lg font-bold text-gray-900">
              Discard Changes?
            </Text>
            <Text className="mb-6 text-gray-600">
              You have unsaved changes. Are you sure you want to exit without saving?
            </Text>
            <View className="flex-row gap-3">
              <Button
                title="Continue Editing"
                variant="gray"
                className="flex-1"
                onPress={() => setShowExitConfirm(false)}
              />
              <Button
                title="Discard"
                variant="primary"
                className="flex-1"
                onPress={confirmExit}
              />
            </View>
          </View>
        </View>
      </Modal>
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
