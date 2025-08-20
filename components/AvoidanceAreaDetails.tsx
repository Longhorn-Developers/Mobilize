import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  WarningIcon,
  MapPinIcon,
  XIcon,
  CaretUpIcon,
  CaretDownIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  PaperPlaneRightIcon,
} from "phosphor-react-native";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import colors from "~/types/colors";
import { ActionButtonGroup } from "./ActionButtonGroup";
import {
  useInsertMutation,
  useQuery,
} from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import { useAuth } from "~/utils/AuthProvider";

// Comment form schema
const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(280, "Comment must be less than 280 characters")
    .trim(),
});

type CommentFormData = z.infer<typeof commentSchema>;

const AvoidanceAreaDetails = ({ areaId }: { areaId: string }) => {
  const { user, signOut } = useAuth();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<boolean | null>(null);

  const { data: avoidanceArea } = useQuery(
    supabase
      .from("avoidance_areas")
      .select(
        `
        user_id,
        name,
        created_at,
        profiles (
          display_name
        )
      `,
      )
      .eq("id", areaId)
      .single(),
  );

  const { data: reports } = useQuery(
    supabase
      .from("avoidance_area_reports")
      .select(
        `
        id,
        user_id,
        description,
        updated_at,
        profiles (
          display_name
        )
      `,
      )
      .eq("avoidance_area_id", areaId),
  );

  const { mutateAsync: addReport } = useInsertMutation(
    supabase.from("avoidance_area_reports"),
    ["id"],
    "",
    {
      onSuccess: () => {
        console.log("Report added successfully");
      },
      onError: (error) => {
        console.error("Error adding report:", error);
      },
    },
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      content: "",
    },
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleStatusUpdate = (stillPresent: boolean) => {
    setSelectedStatus(stillPresent);
    // In real app, this would update the database
    console.log(`Status updated: ${stillPresent}`);
  };

  const handleAddComment = (data: CommentFormData) => {
    addReport([
      {
        user_id: user?.id,
        avoidance_area_id: areaId,
        description: data.content,
      },
    ]);
    reset();
  };

  return (
    <BottomSheetScrollView
      className="px-8 py-4"
      contentContainerClassName={"gap-2"}
    >
      {/* Heading Container */}
      <View className="flex-row items-center gap-4">
        {/* Icon Container */}
        <View className="rounded-lg bg-theme-red/20 p-3">
          <WarningIcon size={32} color={colors.theme.red} />
        </View>

        {/* Heading and subheading */}
        <View className="flex-1">
          <Text className="text-3xl font-bold">{avoidanceArea?.name}</Text>
          <Text className="text-lg font-medium text-gray-600">
            Temporary Blockage
          </Text>
        </View>
      </View>

      {/* Location */}
      <View className="flex-row items-center gap-2">
        <MapPinIcon size={20} />
        <Text className="text-lg font-medium">NULL</Text>
        <Text className="text-3xl text-theme-majorgridline">•</Text>
        <Text className="text-lg text-gray-500">NULL sft</Text>
      </View>

      {/* Avoidance Area Details */}
      <View className="gap-2">
        {/* User header row */}
        <View className="flex-row justify-between">
          {/* User Profile Pic and Username */}
          <View className="flex-row items-center gap-2">
            {/* Profile Pic */}
            <View className="h-6 w-6 rounded-full bg-gray-300" />

            {/* Author Username */}
            <Text className="text-lg text-gray-600">
              {avoidanceArea?.profiles?.display_name || "@anonymous"}
            </Text>

            {/* Created At */}
            <Text className="text-lg text-gray-500">
              {avoidanceArea?.created_at &&
                formatTimeAgo(avoidanceArea?.created_at)}
            </Text>
          </View>

          {/* Upvote/Downvote */}
          <View className="flex-row">
            <ArrowDownIcon size={24} color={colors.ut.gray} />
            <ArrowUpIcon size={24} color={colors.ut.gray} />
          </View>
        </View>

        {/* Description */}
        <Text className="text-lg text-gray-800">NULL</Text>

        {/* Status Question */}
        <View className="flex-row items-center justify-between rounded-lg bg-ut-burntorange/20 px-4 py-2">
          <Text className="text-sm text-ut-burntorange">
            Is the blockage still present?
          </Text>
          <View className="flex-row items-center gap-2">
            <ActionButtonGroup
              className="gap-2"
              actions={[
                {
                  label: "Yes",
                  onPress: () => handleStatusUpdate(true),
                  className: `py-1 px-3 ${selectedStatus ? "bg-ut-burntorange" : "bg-ut-burntorange/15"}`,
                  textClassName: `${selectedStatus ? "text-white" : "text-ut-burntorange"}`,
                },
                {
                  label: "No",
                  onPress: () => handleStatusUpdate(false),
                  className: `py-1 px-3 ${selectedStatus === false ? "bg-ut-burntorange" : "bg-ut-burntorange/15"}`,
                  textClassName: `${selectedStatus === false ? "text-white" : "text-ut-burntorange"}`,
                },
              ]}
            />
            <TouchableOpacity>
              <XIcon size={16} color={colors.ut.burntorange} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Comments Section */}
      <View>
        <TouchableOpacity
          onPress={() => setCommentsExpanded(!commentsExpanded)}
          className="flex-row items-center justify-between py-2"
        >
          <Text className="text-lg font-medium text-gray-600">
            Comments ({reports ? reports.length : 0})
          </Text>
          {commentsExpanded ? (
            <CaretUpIcon size={20} />
          ) : (
            <CaretDownIcon size={20} />
          )}
        </TouchableOpacity>

        {commentsExpanded && (
          <View className="gap-4 border-t border-gray-200 py-4">
            {/* Existing Comments */}
            {(reports || []).map((report) => (
              <View key={report.id} className="flex-row gap-3">
                <View className="h-8 w-8 rounded-full bg-gray-300" />
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-medium text-gray-700">
                      @{report.profiles?.display_name || "anonymous"}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {formatTimeAgo(report.updated_at)}
                    </Text>
                  </View>
                  <Text className="text-gray-800">{report.description}</Text>
                </View>
              </View>
            ))}

            {/* Add Comment */}
            <View className="gap-2">
              <View className="flex-row items-center gap-2 rounded-3xl bg-gray-100 px-4 py-2">
                <View className="h-8 w-8 rounded-full bg-gray-300" />
                <Controller
                  control={control}
                  name="content"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="flex-1 pb-2 text-lg"
                      placeholder="Add comment"
                      value={value}
                      numberOfLines={4}
                      onChangeText={onChange}
                      multiline
                    />
                  )}
                />
                <TouchableOpacity
                  onPress={handleSubmit(handleAddComment)}
                  disabled={!isValid}
                  className={`ml-2 ${isValid ? "opacity-100" : "opacity-50"}`}
                >
                  <PaperPlaneRightIcon
                    size={24}
                    weight="fill"
                    color={isValid ? colors.ut.burntorange : colors.ut.black}
                  />
                </TouchableOpacity>
              </View>
              {errors.content && (
                <Text className="px-4 text-sm text-red-500">
                  {errors.content.message}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Avoidance Area ID (for debugging) */}
      <View className="border-t border-gray-200 pt-4">
        <Text className="text-sm font-medium text-gray-500">Area ID:</Text>
        <Text className="text-sm text-gray-400">{areaId}</Text>
      </View>
    </BottomSheetScrollView>
  );
};

export default AvoidanceAreaDetails;
