import {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
} from "@rnmapbox/maps";
import {
  XIcon,
  QuestionIcon,
  DotsThreeIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  InfoIcon,
} from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { useForm, useController, Control } from "react-hook-form";
import {
  ActivityIndicator,
  Pressable,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import Toast from "react-native-toast-message";

import { Wheelchair } from "~/assets/map_icons/svg_icons";
import colors from "~/types/colors";
import { Review, ReviewEntry } from "~/types/database";
import {
  useDeleteReview,
  useDeleteVote,
  useInsertReview,
  useMyProfile,
  useReviews,
  useUpdateReview,
  useUpsertVote,
} from "~/utils/api-hooks";
import { useTheme } from "~/utils/ThemeContext";
import useMapIcons from "~/utils/useMapIcons";
import { getEntranceLabel } from "~/utils/utils";

import { Button } from "./Button";

const MINI_MAP_STYLE_URL = "mapbox://styles/mapbox/outdoors-v12";
const MINI_MAP_HEIGHT = 250;
const MINI_MAP_ZOOM = 18;

const miniMapFillLayerStyle = {
  fillColor: "rgba(191,87,0,0.18)",
};

const miniMapLineLayerStyle = {
  lineColor: "#BF5700",
  lineWidth: 2,
};

const TouchableRating = ({
  control,
}: {
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: 0,
    name: "rating",
  });

  const ratingIcons = [1, 2, 3, 4, 5];

  return ratingIcons.map((item) => (
    <TouchableOpacity key={item} onPress={() => field.onChange(item)}>
      <Wheelchair color={item <= field.value ? colors.ut.burntorange : "#9CA3AF"} />
    </TouchableOpacity>
  ));
};

// Entrances
const EntranceButtons = ({
  className,
  selectedPoiId,
  labelPoiMap,
  control,
  onButtonPress,
}: {
  className: string;
  selectedPoiId: number,
  labelPoiMap: [string, any][];
  control: Control<Review>;
  onButtonPress: (entrance: any) => void;
}) => {
  const { field } = useController({
    control,
    defaultValue: selectedPoiId,
    name: "poi_id",
  });

  useEffect(() => {
    field.onChange(selectedPoiId);
  }, [field, selectedPoiId]);

  return (
    <View className={className}>
      {labelPoiMap.map((entry) => (
        <TouchableOpacity
          key={entry[1].id}
          className={`rounded-full border-2 px-2 py-1
            ${selectedPoiId !== entry[1].id ? "border-ut-black/50 bg-white" : "border-ut-burntorange/40 bg-ut-burntorange/20"}`}
          onPress={() => {
            onButtonPress(entry[1]);
            field.onChange(entry[1].id);
          }}
        >
          <Text className={`text-sm font-semibold ${selectedPoiId !== entry[1].id ? "color-black" : "color-ut-burntorange"}`}>{entry[0]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Features - power-assisted doors, manual doors, etc
const FeatureButtons = ({
  className,
  features,
  control,
}: {
  className: string;
  features: string[];
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: [],
    name: "features",
  });

  const handleSelectFeature = (feature: string) => {
    const newSelectedFeatures = field.value.includes(feature)
      ? field.value.filter((f) => f !== feature)
      : [...field.value, feature];

    field.onChange(newSelectedFeatures);
  };

  return (
    <View className={className}>
      {features.map((feature) => (
        <TouchableOpacity
          key={feature}
          className={`rounded-full border-2 px-2 py-1 
            ${!field.value.includes(feature) ? "border-ut-black/50 bg-white" : "border-ut-burntorange/40 bg-ut-burntorange/20"}`}
          onPress={() => {
            handleSelectFeature(feature);
          }}
        >
          <Text className={`text-sm font-semibold ${!field.value.includes(feature) ? "color-black" : "color-ut-burntorange"}`}>{feature}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ReviewContentInput = ({
  name,
  defaultValue,
  control,
  isDark,
}: {
  name: "content";
  defaultValue: string;
  control: Control<Review>;
  isDark: boolean;
}) => {
  const { field } = useController({
    control,
    defaultValue: defaultValue,
    name,
  });

  return (
    <TextInput
      className={`min-h-36 rounded-xl border-2 p-4 ${
        isDark
          ? "border-neutral-700 bg-neutral-900 text-gray-100"
          : "border-ut-black/20 bg-white text-black"
      }`}
      multiline={true}
      placeholder="How was the accessibility? Any specific details that would help other students?"
      placeholderTextColor={isDark ? "#9CA3AF" : "#616467"}
      value={field.value ?? undefined}
      onChangeText={field.onChange}
      maxLength={280}
    />
  );
};

const ReviewCard = ({
  review,
  activeUserId,
  actionFn,
}: {
  review: ReviewEntry;
  activeUserId: number | null;
  actionFn: () => void;
}) => {
  const { mutateAsync: upsertVote } = useUpsertVote();
  const { mutateAsync: deleteVote } = useDeleteVote();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [isVoting, setIsVoting] = useState(false);
  const displayName = review.profile_display_name?.trim() || "UT Student";
  const avatarUrl = review.profile_avatar_url || "";

  const handleVote = async (vote: 1 | -1) => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      const currentVote = review.user_vote ?? 0;
      if (currentVote === vote) {
        await deleteVote(review.id);
      } else {
        await upsertVote({
          review_id: review.id,
          vote,
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsVoting(false);
    }
  };

  const currentVote = review.user_vote ?? 0;

  const elapsed_seconds: number =
    (new Date().getTime() - new Date(review.updated_at).getTime()) / 1000;
  let elapsed_time_msg: string = "";

  if (elapsed_seconds < 60) {
    elapsed_time_msg = Math.round(elapsed_seconds) + "s";
  } else if (elapsed_seconds < 3600) {
    elapsed_time_msg = Math.round(elapsed_seconds / 60) + "m";
  } else if (elapsed_seconds < 86400) {
    elapsed_time_msg = Math.round(elapsed_seconds / 3600) + "h";
  } else if (elapsed_seconds < 31536000) {
    elapsed_time_msg = Math.round(elapsed_seconds / 86400) + "d";
  } else {
    elapsed_time_msg = ">1y";
  }

  // Consider using grid instead of a nested views
  return (
    <View className="-z-10">
      {/* Review Card */}
      <View className="flex flex-row">
        <View className="flex flex-col gap-3">
          {/* Row 1 */}
          <View className="flex flex-row items-center gap-1">
            {/* Profile Image */}
            {avatarUrl ? (
              <Image
                className="mr-2 h-8 w-8 rounded-full bg-slate-300"
                source={{ uri: avatarUrl }}
              />
            ) : (
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-slate-300">
                <Text className="text-xs font-bold text-slate-700">
                  {displayName[0]?.toUpperCase() ?? "U"}
                </Text>
              </View>
            )}
            {/* Profile/Display Name */}
            <Text className={`text-lg font-semibold ${isDark ? "color-gray-100" : "color-black"}`}>
              {activeUserId === review.user_id ? "Me" : `@${displayName}`}
            </Text>
            {/* Dot */}
            <Text className={isDark ? "color-slate-400" : "color-slate-600"}>•</Text>
            {/* Elapsed Time */}
            <Text className={isDark ? "color-slate-400" : "color-slate-600"}>{elapsed_time_msg} ago</Text>
          </View>
          {/* Row 2 - Review Content */}
          <Text className={`max-w-xs ${isDark ? "color-slate-300" : "color-slate-600"}`}>
            {review.content}
          </Text>
          {/* Row 3 */}
          <View className="flex flex-row items-center gap-2">
            {/* Rating */}
            {/* <Rating rating={review.rating} size={18} /> */}
            <Wheelchair size={30} />
            <Text className="color-slate-700 text-lg">{review.rating}</Text>
            {/* Options (placement) */}
            {activeUserId === review.user_id ? (
              /* Options (current user's review) */
              <TouchableOpacity className="pl-4" onPress={actionFn}>
                <DotsThreeIcon size={28} weight="bold" color={isDark ? "#F3F4F6" : "black"} />
              </TouchableOpacity>
            ) : (
              /* Upvote / Downvote (other users' reviews) */
              <View className="flex flex-row justify-between items-center border-2 border-slate-200 rounded-full px-1 ml-3 gap-1">
                {/* Upvote */}
                <TouchableOpacity
                  className=""
                  disabled={isVoting}
                  onPress={async () => await handleVote(1)}
                >
                  <ArrowUpIcon
                    size={20}
                    weight="bold"
                    color={currentVote === 1 ? "#BF5700" : isDark ? "#CBD5E1" : "#334155"}
                  />
                </TouchableOpacity>
                <Text className={`text-lg ${isDark ? "color-slate-200" : "color-slate-700"}`}>
                  {review.vote_count}
                </Text>
                {/* Downvote */}
                <TouchableOpacity
                  className=""
                  disabled={isVoting}
                  onPress={async () => await handleVote(-1)}
                >
                  <ArrowDownIcon
                    size={20}
                    weight="bold"
                    color={currentVote === -1 ? "#BF5700" : isDark ? "#CBD5E1" : "#334155"}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const ReviewsList = ({
  className,
  reviews,
  activeUserId,
  userHasReview,
  ListHeaderComponent,
}: {
  className: string;
  reviews: ReviewEntry[];
  activeUserId: number | null;
  userHasReview: boolean;
  ListHeaderComponent: React.ComponentType<any> | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | null | undefined;
}) => {
  return (
    <View className={className}>
      <View className="flex flex-row items-center justify-center">
        {reviews?.length > 0 || userHasReview ? (
          /* Scrollable Reviews List */
          <FlatList<ReviewEntry>
            data={reviews}
            keyExtractor={(item) => item.id.toString()}
            ItemSeparatorComponent={() => <View className="pt-10" />}
            ListHeaderComponent={ListHeaderComponent}
            showsVerticalScrollIndicator={true}
            renderItem={({ item }) => (
              <ReviewCard
                review={item}
                activeUserId={activeUserId}
                actionFn={() => {
                  // Update review's vote
                }}
              />
            )}
          />
        ) : (
          /* No Reviews */
          <View className="flex flex-row items-center gap-4 py-4">
            <QuestionIcon size={32} color="#64748b" />
            <Text className="text-slate-500">
              No reviews found.
              {"\n"}
              Be the first to write a review!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const MiniMap = ({
  building,
  selectedEntrance,
  entrances,
  onSelectEntrance,
}: {
  building: any;
  selectedEntrance: number | null;
  entrances: any[];
  onSelectEntrance: (entrance: any) => void;
}) => {
  const mapIcons = useMapIcons();

  const buildingFeature = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: building?.geometry
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: building.geometry,
            },
          ]
        : [],
    }),
    [building],
  );

  const centerCoordinate = useMemo(() => {
    const coords: [number, number][] = building?.geometry?.coordinates?.[0] ?? [];
    if (coords.length === 0) {
      return [-97.733, 30.282] as [number, number];
    }

    const bldLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const bldLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return [bldLng, bldLat] as [number, number];
  }, [building]);

  return (
    <View
      style={{
        width: "100%",
        height: MINI_MAP_HEIGHT,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <MapView
        style={{ flex: 1 }}
        styleURL={MINI_MAP_STYLE_URL}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
      >
        <Camera
          animationMode="none"
          defaultSettings={{
            centerCoordinate,
            zoomLevel: MINI_MAP_ZOOM,
          }}
        />

        <ShapeSource id="review-mini-building" shape={buildingFeature}>
          <FillLayer id="review-mini-building-fill" style={miniMapFillLayerStyle} />
          <LineLayer id="review-mini-building-line" style={miniMapLineLayerStyle} />
        </ShapeSource>

        {entrances.map((entrance) => {
          const isSelected = selectedEntrance === entrance.id;
          const iconSource = entrance.metadata?.auto_opene
            ? mapIcons.autoDoor
            : mapIcons.manualDoor;

          return (
            <PointAnnotation
              key={`review-mini-entrance-${entrance.id}`}
              id={`review-mini-entrance-${entrance.id}`}
              coordinate={[
                entrance.location_geojson.coordinates[0],
                entrance.location_geojson.coordinates[1],
              ]}
              onSelected={() => onSelectEntrance(entrance)}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onSelectEntrance(entrance)}
              >
                <View
                  style={{
                    borderRadius: 999,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: "#BF5700",
                    backgroundColor: isSelected ? "rgba(255,255,255,0.96)" : "transparent",
                    padding: isSelected ? 4 : 0,
                    shadowColor: "#BF5700",
                    shadowOpacity: isSelected ? 0.2 : 0,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <Image
                    source={iconSource}
                    style={{
                      width: isSelected ? 26 : 22,
                      height: isSelected ? 26 : 22,
                    }}
                  />
                </View>
              </TouchableOpacity>
            </PointAnnotation>
          );
        })}
      </MapView>
    </View>
  );
};

interface ReviewModalProps {
  className?: string;
  poi_id: number;
  entrances: any[];
  entranceName: string;
  building: any;
  buildingName: string;
  onExit: () => void;
}

const ReviewModal = ({
  className,
  poi_id,
  entrances,
  entranceName,
  building,
  buildingName,
  onExit,
}: ReviewModalProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [formState, setFormState] = useState(0);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState(poi_id);
  const [selectedEntranceName, setSelectedEntranceName] = useState<string>(entranceName);
  const [editingReview, setEditingReview] = useState<ReviewEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedPoiId(poi_id);
    setSelectedEntranceName(entranceName);
  }, [poi_id, entranceName]);

  // Api Client Hooks
  const { mutateAsync: insertReview } = useInsertReview();
  const { mutateAsync: updateReview } = useUpdateReview();
  const { mutateAsync: deleteReview } = useDeleteReview();
  const { data: myProfile, isLoading: isProfileLoading } = useMyProfile();

  // query reviews from db
  const {
    data: reviews = [],
    isLoading: isReviewsLoading,
    isError: isReviewsError,
  } = useReviews(selectedPoiId);

  const activeUserId = myProfile?.id ?? null;
  const labelPoiMap: [string, any][] = entrances.map((entrance) => [getEntranceLabel(entrance, entrances, building), entrance]);
  const features: string[] = ["Power-assisted doors", "Ramps", "Others"];

  const { control, handleSubmit, watch, reset } = useForm<Review>();
  const rating = watch("rating");

  const existingReview =
    activeUserId == null
      ? undefined
      : reviews.find((review) => review.user_id === activeUserId);
  const isEditMode = !!editingReview;

  useEffect(() => {
    if (formState === 1) {
      return;
    }
    if (existingReview) {
      reset(existingReview);
    } else {
      reset({rating: 0, features: [], content: ""});
    }
  }, [editingReview, existingReview, existingReview?.id, formState, selectedPoiId, reset]);

  const handleSelectEntrance = (entrance: any) => {
    // const found = entrances.find()
    setSelectedPoiId(entrance.id);
    setSelectedEntranceName(getEntranceLabel(entrance, entrances, building));
  };

  const handleOutsidePress = () => {
    if (isMenuActive) {
      setIsMenuActive(false);
      return;
    }
    setFormState(0);
    setEditingReview(null);
    onExit();
  };

  const handleOpenReviewForm = () => {
    if (!myProfile?.id) {
      Toast.show({
        type: "error",
        text2: "Your profile is still loading. Please try again in a moment.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
      return;
    }

    setEditingReview(existingReview ?? null);
    setFormState(1);
  };

  const onSubmit = async (data: Review) => {
    if (!myProfile?.id) {
      Toast.show({
        type: "error",
        text2: "We couldn't load your profile yet. Please try again in a moment.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
      return;
    }

    if (data.rating === 0) {
      // Warning if no rating selected
      Toast.show({
        type: "error",
        text2: "Please select a rating.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
      return;
    }

    const serializedFeatures = JSON.stringify(data.features ?? []);
    const normalizedPoiId = Number(selectedPoiId);
    if (!Number.isFinite(normalizedPoiId) || normalizedPoiId <= 0) {
      Toast.show({
        type: "error",
        text2: "Please select a valid entrance.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingReview && editingReview.poi_id !== normalizedPoiId) {
        await insertReview({
          user_id: myProfile.id,
          poi_id: normalizedPoiId,
          rating: data.rating,
          features: serializedFeatures,
          content: data?.content ?? undefined,
        });
        await deleteReview({
          id: editingReview.id,
          poi_id: editingReview.poi_id,
        });
      } else if (editingReview) {
        await updateReview({
          id: editingReview.id,
          poi_id: normalizedPoiId,
          rating: data.rating,
          features: serializedFeatures,
          content: data?.content ?? undefined,
        });
      } else {
        await insertReview({
          user_id: myProfile.id,
          poi_id: normalizedPoiId,
          rating: data.rating,
          features: serializedFeatures,
          content: data?.content ?? undefined,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: "error",
        text2: error?.message ?? "Could not submit review. Please try again.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
      return;
    } finally {
      setIsSubmitting(false);
    }

    setIsMenuActive(false);
    setEditingReview(null);
    onExit();
  };

  const isSubmitDisabled = !myProfile?.id || rating === 0 || isSubmitting;

  return (
    <>
      {/* Overlay */}
      <Pressable
        className="absolute bottom-0 left-0 right-0 top-0 bg-[#333F48]/50"
        onPress={handleOutsidePress}
      />

      {/* Main Modal */}
      <View
        className={`top-safe-offset-2 absolute left-6 right-6 z-30 gap-5 rounded-xl px-8 py-8 ${className}`}
        style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}
      >
        {/* Exit Button */}
        <TouchableOpacity
          accessibilityLabel="Close review modal"
          accessibilityRole="button"
          className="absolute right-2 top-2 z-10 rounded-full p-2"
          hitSlop={12}
          onPress={() => {
            setIsMenuActive(false);
            setFormState(0);
            setEditingReview(null);
            onExit();
          }}
        >
          <XIcon size={28} color={isDark ? "#F3F4F6" : colors.ut.black} />
        </TouchableOpacity>

        {/* Headings */}
        <View className="gap-2">
          <Text className={`mr-4 pt-1 text-3xl font-bold ${isDark ? "text-gray-100" : "text-black"}`}>
            {buildingName}
          </Text>
        </View>

        {formState === 0 ? (
          <>
            {/* Entrance Map (focuses on Building/Area of selected entrance) */}
            <View className="flex flex-col items-center gap-3">
              {/* Minimap */}
              <MiniMap
                building={building}
                selectedEntrance={selectedPoiId}
                entrances={entrances}
                onSelectEntrance={handleSelectEntrance}
              />
              {/* Entrance Label */}
              <View className="absolute bottom-12 p-2 rounded-md bg-white shadow-md shadow-slate-300">
                <Text className="px-10 py-1 color-ut-burntorange font-semibold">
                  {selectedEntranceName}
                </Text>
              </View>
              {/* Map Instruction */}
              <Text className={isDark ? "color-slate-300" : "color-slate-600"}>
                Select icon to see its reviews.
              </Text>
            </View>
            
            {/* Divider */}
            <View className="border-t border-slate-200" />

            {/* Reviews List Section */}
            <View className="">
              {/* List of Reviews for a given POI */}
              {isReviewsLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="small" color={colors.ut.burntorange} />
                  <Text className="mt-2 color-slate-500">Loading reviews...</Text>
                </View>
              ) : isReviewsError ? (
                <View className="items-center py-8">
                  <Text className="text-center color-slate-500">
                    Could not load reviews right now.
                  </Text>
                </View>
              ) : (
                <ReviewsList
                  className="max-h-80"
                  reviews={reviews.filter(
                    (review) => review.user_id !== activeUserId,
                  )}
                  activeUserId={activeUserId}
                  userHasReview={!!existingReview}
                  ListHeaderComponent={
                    // Active User Review Card
                    existingReview && (
                      <View className="mb-6">
                        <ReviewCard
                          review={existingReview}
                          activeUserId={activeUserId}
                          actionFn={() => setIsMenuActive((prev) => !prev)}
                        />

                        {/* Edit/Delete Menu */}
                        <View className="">
                          {existingReview && isMenuActive && (
                            <View className="absolute -bottom-2 left-1/3">
                              <View className="flex flex-col gap-2 rounded-lg bg-white px-4 py-3 shadow-md shadow-black/20">
                                {/* Edit Button */}
                                <TouchableOpacity
                                  onPress={() => {
                                    setIsMenuActive(false);
                                    setEditingReview(existingReview);
                                    setFormState(1);
                                  }}
                                >
                                  <Text className="text-lg color-gray-500">Edit</Text>
                                </TouchableOpacity>
                                {/* Divider */}
                                <View className="border-t border-slate-600" />
                                {/* Delete Button (current functionality: soft delete-change update deleted_at field) */}
                                <TouchableOpacity
                                  onPress={async () => {
                                    try {
                                      await deleteReview({
                                        id: existingReview.id,
                                        poi_id: existingReview.poi_id,
                                      });
                                    } catch (error: any) {
                                      Toast.show({
                                        type: "error",
                                        text2: error?.message ?? "Could not delete review.",
                                        position: "bottom",
                                        bottomOffset: 40 * 3,
                                      });
                                    }
                                    setIsMenuActive(false);
                                  }}
                                >
                                  <Text className="text-lg color-red-700">Delete</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    )
                  }
                />
              )}
              {/* Leave a Review Button */}
              <Button
                className="rounded-xl shadow-none mt-6"
                title={isProfileLoading ? "Loading profile..." : "Leave a Review"}
                disabled={isProfileLoading || isReviewsLoading || !myProfile?.id}
                onPress={handleOpenReviewForm}
              />
              {!isProfileLoading && !myProfile?.id ? (
                <Text className="mt-2 text-center color-slate-500">
                  Sign in and complete profile setup to leave a review.
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {/* Rating Section */}
            <View className="gap-3">
              <Text className={isDark ? "text-gray-100" : "text-black"}>Give a rating</Text>

              {/* Star Functionality */}
              <View className="flex flex-row gap-2">
                <TouchableRating
                  control={control}
                />
              </View>
            </View>

            {/* Entrance Selection Section */}
            <View className="gap-3">
              <View className="flex flex-row gap-2">
                <Text className={isDark ? "text-gray-100" : "text-black"}>Select the entrance you used</Text>
                <TouchableOpacity
                  // onPress={} show some type of info
                >
                  <InfoIcon size={16} />
                </TouchableOpacity>
              </View>

              {/* Entrance Buttons */}
              <EntranceButtons
                className="flex flex-row flex-wrap gap-2"
                selectedPoiId={selectedPoiId}
                labelPoiMap={labelPoiMap}
                control={control}
                onButtonPress={handleSelectEntrance}
              />
            </View>

            {/* Feature Selection Section */}
            <View className="gap-3">
              <Text className={isDark ? "text-gray-100" : "text-black"}>Select any accessibility features you noticed</Text>

              {/* Feature Buttons */}
              <FeatureButtons
                className="flex flex-row flex-wrap gap-2"
                features={features}
                control={control}
              />
            </View>

            {/* Experience Sharing Section */}
            <View className="gap-4">
              <Text className={isDark ? "text-gray-100" : "text-black"}>Share your experience (optional)</Text>
              <ReviewContentInput
                name="content"
                defaultValue={editingReview?.content || ""}
                control={control}
                isDark={isDark}
              />
            </View>

            {/* Buttons */}
            <View className="mt-2 gap-3">
              {/* Submit Button */}
              <Button
                className={`gap-2 rounded-xl shadow-none`}
                variant={isSubmitDisabled ? "disabled" : "primary"}
                disabled={isSubmitDisabled}
                onPress={handleSubmit(onSubmit)}
                title={isSubmitting ? "Submitting..." : isEditMode ? "Resubmit" : "Submit"}
              />

              {/* Cancel Button */}
              <Button
                className="rounded-xl shadow-none"
                variant="secondary"
                title={"Cancel"}
                onPress={() => {
                  setFormState(0);
                  setEditingReview(null);
                }}
              />
            </View>

            {/* Encourage Reviews Message */}
            <View className="flex w-full items-center">
              <Text className="w-80 text-center color-[#616467]">
                Your review helps make campus more accessible for everyone.
              </Text>
            </View>
          </>
        )}
      </View>
    </>
  );
};

export default ReviewModal;
