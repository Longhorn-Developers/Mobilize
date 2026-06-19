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


const reportFormSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must not exceed 500 characters"),
  poi_id: z.number(),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

interface ReportModeDialogProps {
  className?: string;
  style?: ViewStyle;
  onSubmit: (data: ReportFormData) => Promise<void> | void;
  onExit: () => void;
}

const POIReportForm = ({
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

            {/* Subheading */}
            <Text className="text-sm font-medium">
              Report an Inaccuracy
            </Text>

          </View>
        </View>

    </>
  );
};


export default POIReportForm;