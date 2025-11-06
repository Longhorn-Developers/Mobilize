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
import { View, Text, TouchableOpacity, TextInput, Image } from "react-native";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import colors from "~/types/colors";
import { ActionButtonGroup } from "./ActionButtonGroup";
import * as turf from "@turf/turf";
import { useAvoidanceArea, useAvoidanceAreaReports } from "~/utils/api-hooks";

type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

const sqftInMeters = 10.764; // 1 square meter = 10.764 square feet

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
  // const { user } = useAuth();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<boolean | null>(null);
  const [polygon, setPolygon] = useState<Polygon | null>(null);

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

  // Use new API hooks
  const { data: avoidanceArea, isLoading } = useAvoidanceArea(areaId);
  const { data: reports } = useAvoidanceAreaReports(areaId);

  // Effect to convert boundary_geojson to Polygon
  useEffect(() => {
    if (avoidanceArea?.boundary_geojson) {
      setPolygon({
        type: "Polygon",
        coordinates: [avoidanceArea.boundary_geojson.coordinates[0]],
      });
    }
  }, [avoidanceArea?.boundary_geojson]);

  // const { mutateAsync: addReport } = useInsertMutation(
  //   supabase.from("avoidance_area_reports"),
  //   ["id"],
  //   "avoidance_area_id",
  //   {
  //     onSuccess: () => {
  //       console.log("Report added successfully");
  //     },
  //     onError: (error) => {
  //       console.error("Error adding report:", error);
  //     },
  //   },
  // );

  const formatTimeAgo = (dateStr: string | Date) => {
    const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInSeconds < 1) return "now";
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
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
    // addReport([
    //   {
    //     user_id: user ? user.id : null,
    //     avoidance_area_id: areaId,
    //     description: data.content,
    //   },
    // ]);
    reset();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!avoidanceArea) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Area not found.</Text>
      </View>
    );
  }

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
          <Text className="text-3xl font-bold">{avoidanceArea.name}</Text>
          <Text className="text-lg font-medium text-gray-600">
            Temporary Blockage
          </Text>
        </View>
      </View>

      {/* Location */}
      <View className="flex-row items-center gap-2">
        <MapPinIcon size={20} />
        <Text className="text-lg font-medium">Location not available</Text>
        <Text className="text-3xl text-theme-majorgridline">•</Text>
        <Text className="text-lg text-gray-500">
          {polygon &&
            (turf.area(polygon) * sqftInMeters).toLocaleString(undefined, {
              maximumFractionDigits: 0,
              minimumFractionDigits: 0,
            })}{" "}
          sqft
        </Text>
      </View>

      {/* Avoidance Area Details */}
      <View className="gap-2">
        {/* User header row */}
        <View className="flex-row justify-between">
          {/* User Profile Pic and Username */}
          <View className="flex-row items-center gap-2">
            {/* Profile Pic */}
            <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-300">
              {avoidanceArea.profile_avatar_url ? (
                <Image
                  source={{ uri: avoidanceArea.profile_avatar_url }}
                  className="h-full w-full rounded-full"
                />
              ) : (
                <Text className="text-center text-gray-500">
                  {avoidanceArea.profile_display_name?.[0].toLocaleUpperCase() ||
                    "A"}
                </Text>
              )}
            </View>

            {/* Author Username */}
            <Text className="text-lg text-gray-600">
              @{avoidanceArea.profile_display_name || "anonymous"}
            </Text>

            {/* Created At */}
            <Text className="text-lg text-gray-500">
              {formatTimeAgo(avoidanceArea.created_at)}
            </Text>
          </View>

          {/* Upvote/Downvote */}
          <View className="flex-row">
            <ArrowDownIcon size={24} color={colors.ut.gray} />
            <ArrowUpIcon size={24} color={colors.ut.gray} />
          </View>
        </View>

        {/* Description */}
        {avoidanceArea.description ? (
          <Text className="text-md text-gray-800">
            {avoidanceArea.description}
          </Text>
        ) : (
          <Text className="text-md italic text-gray-500">
            No description provided
          </Text>
        )}

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
                  className: `py-1 px-3 ${selectedStatus === true ? "bg-ut-burntorange" : "bg-ut-burntorange/15"}`,
                  textClassName: `${selectedStatus === true ? "text-white" : "text-ut-burntorange"}`,
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
                      @{report.profile_display_name || "anonymous"}
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
