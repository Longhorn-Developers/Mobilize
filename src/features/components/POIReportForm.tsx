import { zodResolver } from "@hookform/resolvers/zod";
import {
  CameraPlusIcon,
  PencilSimpleLineIcon,
  WarningIcon,
  XIcon,
} from "phosphor-react-native";
import { ReactNode, useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  Modal,
  Dimensions, 
  Platform,
  Image
} from "react-native";
import Toast from "react-native-toast-message";
import { z, ZodType } from "zod";

import colors from "~/types/colors";

import { ActionButtonGroup } from "./ActionButtonGroup";
import { Button } from "./Button";

import { POIReportData } from "./POIBottomSheet";


const reportFormSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters"),
  poi_id: z.number(),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  data?: POIReportData;
  className?: string;
  style?: ViewStyle;
  onSubmit: (data: ReportFormData) => Promise<void> | void;
  onExit: () => void;
}

const POIReportForm = ({
  data,
  className,
  style,
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
      description: "",
      poi_id: undefined,
    },
  });

  const bottomTabBarHeight = 50;

  useEffect(() => {
    if (data) {
      setValue("poi_id", data.id);
    }
  }, []);

  {/* Form Functionality --------------------------------------------------------*/}

  const handleClose = () => {
    resetForm();
    onExit();
  };

  const handleFormSubmit = (data: ReportFormData) => {
    Promise.resolve(onSubmit(data))
      .then(() => {
        handleClose();
      })
      .catch((error: any) => {
        Toast.show({
          type: "error",
          text2: error?.message ?? "Could not submit report. Please try again.",
          position: "bottom",
          bottomOffset: bottomTabBarHeight + 50,
        });
      });
  };

  return (
    <>
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

          <View className="flex-col gap-1">

            {/* Heading */}
            <Text className={`text-2xl font-bold`}>
                Report Inaccuracy
            </Text>

            {/* Subheading */}
            <Text className="text-sm font-medium">
              {data ? `${data.buildingName}` : ""}
            </Text>

          </View>
        </View>

        {/* Text Input */}
        <Text className="font-medium">What's inaccurate about this landmark?</Text>
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
                placeholder="Please describe any inaccuracies about this landmark..."
                placeholderTextColor="#a7a7a7"
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
      
      {/* Buttons */}
      <View className="flex-row justify-content gap-4">
        <Button
          title="Cancel"
          variant="gray"
          className="flex-1"
          onPress={handleClose}
        />
        <Button
          title="Submit Report"
          className="flex-1"
          onPress={() => handleSubmit(handleFormSubmit)()}
        />
      </View>

      </View>

    </>
  );
};


export default POIReportForm;