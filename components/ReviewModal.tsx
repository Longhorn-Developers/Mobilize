import {
  XIcon,
  QuestionIcon,
  DotsThreeIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  InfoIcon,
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { useForm, useController, Control } from "react-hook-form";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import Toast from "react-native-toast-message";

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

import { Button } from "./Button";
import { Wheelchair } from "~/assets/map_icons/svg_icons";
import MapView, { Marker } from "react-native-maps";
import useMapIcons from "~/utils/useMapIcons";
import { getEntranceLabel } from "~/utils/utils";

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
  firstSelectedPoiId,
  labelPoiMap,
  control,
  onButtonPress,
}: {
  className: string;
  firstSelectedPoiId: number,
  labelPoiMap: [string, any][];
  control: Control<Review>;
  onButtonPress: (entrance: any) => void;
}) => {
  const [selectedEntrance, setSelectedEntrance] = useState(firstSelectedPoiId);
  const { field } = useController({
    control,
    defaultValue: firstSelectedPoiId,
    name: "poi_id",
  });

  return (
    <View className={className}>
      {labelPoiMap.map((entry) => (
        <TouchableOpacity
          key={entry[1].id}
          className={`rounded-full border-2 px-2 py-1
            ${selectedEntrance !== entry[1].id ? "border-ut-black/50 bg-white" : "border-ut-burntorange/40 bg-ut-burntorange/20"}`}
          onPress={() => {
            setSelectedEntrance(entry[1].id);
            onButtonPress(entry[1]);
            field.onChange(entry[1].id);
          }}
        >
          <Text className={`text-sm font-semibold ${selectedEntrance !== entry[1].id ? "color-black" : "color-ut-burntorange"}`}>{entry[0]}</Text>
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
}: {
  name: "content";
  defaultValue: string;
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: defaultValue,
    name,
  });

  return (
    <TextInput
      className="min-h-36 rounded-xl border-2 border-ut-black/20 p-4 placeholder:color-[#616467]"
      multiline={true}
      placeholder="How was the accessibility? Any specific details that would help other students?"
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
  activeUserId: number;
  actionFn: () => void;
}) => {
  const { mutateAsync: upsertVote } = useUpsertVote();
  const { mutateAsync: deleteVote } = useDeleteVote();

  // lol anti-complexity solution: render votes and mutate db separately
  const handleVote = async (vote: 1 | -1) => {
    console.log(review.user_vote);
    try {
      if (review.user_vote === vote) {
        // User already voted this way (remove their vote)
        review.user_vote = 0;
        review.vote_count -= vote;
        await deleteVote(review.id);
      } else {
        if (review.user_vote === -vote) {
          // User voted differently previously (remove old & allow new vote)
          review.vote_count += 2 * vote;
        } else {
          // User hasnt voted yet (allow vote)
          review.vote_count += vote;
        }
        review.user_vote = vote;
        await upsertVote({
          review_id: review.id,
          vote,
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

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
            <Image
              className="h-8 w-8 rounded-full bg-slate-300 mr-2"
              source={{ uri: review.profile_avatar_url }}
            />
            {/* Profile/Display Name */}
            <Text className="color-black font-semibold text-lg">
              {activeUserId === review.user_id ? "Me" : `@${review.profile_display_name}`}
            </Text>
            {/* Dot */}
            <Text className="color-slate-600">•</Text>
            {/* Elapsed Time */}
            <Text className="color-slate-600">{elapsed_time_msg} ago</Text>
          </View>
          {/* Row 2 - Review Content */}
          <Text className="max-w-xs color-slate-600">{review.content}</Text>
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
                <DotsThreeIcon size={28} weight="bold" color="black" />
              </TouchableOpacity>
            ) : (
              /* Upvote / Downvote (other users' reviews) */
              <View className="flex flex-row justify-between items-center border-2 border-slate-200 rounded-full px-1 ml-3 gap-1">
                {/* Upvote */}
                <TouchableOpacity
                  className=""
                  onPress={async () => await handleVote(1)}
                >
                  <ArrowUpIcon size={20} weight="bold" color="#334155" />
                </TouchableOpacity>
                <Text className="color-slate-700 text-lg">
                  {review.vote_count}
                </Text>
                {/* Downvote */}
                <TouchableOpacity
                  className=""
                  onPress={async () => await handleVote(-1)}
                >
                  <ArrowDownIcon size={20} weight="bold" color="#334155" />
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
  activeUserId: number;
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
  entrances,
  onSelectEntrance
}: {
  building: any,
  entrances: any[],
  onSelectEntrance: (entrance: any) => void;
}) => {
  const mapIcons = useMapIcons();

  const coords: [number, number][] = building.geometry.coordinates[0];
  const bldLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const bldLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

  const center = {
    latitude: bldLat,
    longitude: bldLng,
    latitudeDelta: 0.001,
    longitudeDelta: 0.001,
  }

  return (
    <MapView
      style={{ width: "100%", height: 250, borderRadius: 12 }}
      region={center}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
    >
      {/* Entrace POIs for specified building go here */}
      {entrances.map((entrance) => (
        <Marker
          key={entrance.id}
          coordinate={{
            latitude: entrance.location_geojson.coordinates[1],
            longitude: entrance.location_geojson.coordinates[0]
          }}
          image={entrance.metadata?.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor}
          onPress={() => onSelectEntrance(entrance)}
        />
      ))}
    </MapView>
  );
}

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
  const [formState, setFormState] = useState(0);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState(poi_id);
  const [selectedEntranceName, setSelectedEntranceName] = useState<string>(entranceName);

  // Api Client Hooks
  const { mutateAsync: insertReview } = useInsertReview();
  const { mutateAsync: updateReview } = useUpdateReview();
  const { mutateAsync: deleteReview } = useDeleteReview();
  const { data: myProfile } = useMyProfile();

  // query reviews from db
  const { data: reviews = [], isLoading } = useReviews(selectedPoiId);

  const activeUserId = myProfile ? myProfile.id : 9999;
  const labelPoiMap: [string, any][] = entrances.map((entrance) => [getEntranceLabel(entrance, entrances, building), entrance]);
  const features: string[] = ["Power-assisted doors", "Ramps", "Others"];

  const { control, handleSubmit, watch, reset } = useForm<Review>();
  const rating = watch("rating");

  const existingReview = reviews.find(
    (review) => review.user_id === activeUserId,
  );
  const isEditMode = !!existingReview;

  useEffect(() => {
    if (existingReview) {
      reset(existingReview);
    } else {
      reset({rating: 0, features: [], content: ""});
    }
  }, [existingReview, existingReview?.id, selectedPoiId, reset]);

  const handleSelectEntrance = (entrance: any) => {
    // const found = entrances.find()
    setSelectedPoiId(entrance.id);
    setSelectedEntranceName(getEntranceLabel(entrance, entrances, building));
  };

  const handleOutsidePress = () => {
    if (isMenuActive) {
      setIsMenuActive(false);
    }
  };

  const onSubmit = async (data: Review) => {
    if (data.rating === 0) {
      // Warning if no rating selected
      Toast.show({
        type: "error",
        text2: "Please select a rating.",
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    } else {
      // Post review (insert)
      data.user_id = activeUserId;
      data.poi_id = selectedPoiId;

      // If review exists, edit existing review; otherwise, post new review
      if (isEditMode) {
        await updateReview({
          id: existingReview.id,
          rating: data.rating,
          features: JSON.stringify(data.features),
          content: data?.content ?? undefined,
        });
      } else {
        await insertReview({
          user_id: data.user_id,
          poi_id: data.poi_id,
          rating: data.rating,
          features: JSON.stringify(data.features),
          content: data?.content ?? undefined,
        });
      }

      onExit();
    }
  };

  return (
    <>
      {/* Overlay */}
      <View
        className="absolute bottom-0 left-0 right-0 top-0 bg-[#333F48]/50"
        onTouchEnd={() => handleOutsidePress()}
      />

      {/* Main Modal */}
      <View
        className={`top-safe-offset-2 absolute left-6 right-6 z-30 gap-5 rounded-xl bg-white px-8 py-8 ${className}`}
        onTouchEnd={() => handleOutsidePress()}
      >
        {/* Exit Button */}
        <Button
          variant="ghost"
          title=""
          className="absolute right-0 top-3 shadow-none"
          onPress={onExit}
          icon={<XIcon size={28} color={colors.ut.black} />}
        />

        {/* Headings */}
        <View className="gap-2">
          <Text className="mr-4 pt-1 text-3xl font-bold">
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
              <Text className="color-slate-600">
                Select icon to see its reviews.
              </Text>
            </View>
            
            {/* Divider */}
            <View className="border-t border-slate-200" />

            {/* Reviews List Section */}
            <View className="">
              {/* List of Reviews for a given POI */}
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
                                  await deleteReview({
                                    id: existingReview.id,
                                    poi_id: existingReview.poi_id,
                                  });
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
              {/* Leave a Review Button */}
              <Button
                className="rounded-xl shadow-none mt-6"
                title="Leave a Review"
                onPress={() => {
                  // query previously submitted review from user id
                  setFormState(1);
                }}
              />
            </View>
          </>
        ) : (
          <>
            {/* Rating Section */}
            <View className="gap-3">
              <Text className="">Give a rating</Text>

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
                <Text className="">Select the entrance you used</Text>
                <TouchableOpacity
                  // onPress={} show some type of info
                >
                  <InfoIcon size={16} />
                </TouchableOpacity>
              </View>

              {/* Entrance Buttons */}
              <EntranceButtons
                className="flex flex-row flex-wrap gap-2"
                firstSelectedPoiId={selectedPoiId}
                labelPoiMap={labelPoiMap}
                control={control}
                onButtonPress={handleSelectEntrance}
              />
            </View>

            {/* Feature Selection Section */}
            <View className="gap-3">
              <Text className="">Select any accessibility features you noticed</Text>

              {/* Feature Buttons */}
              <FeatureButtons
                className="flex flex-row flex-wrap gap-2"
                features={features}
                control={control}
              />
            </View>

            {/* Experience Sharing Section */}
            <View className="gap-4">
              <Text className="">Share your experience (optional)</Text>
              <ReviewContentInput
                name="content"
                defaultValue={existingReview?.content || ""}
                control={control}
              />
            </View>

            {/* Buttons */}
            <View className="mt-2 gap-3">
              {/* Submit Button */}
              <Button
                className={`gap-2 rounded-xl shadow-none`}
                variant={`${(!rating && (!existingReview || rating === 0)) ? "disabled" : "primary"}`}
                onPress={handleSubmit(onSubmit)}
                title={existingReview ? "Resubmit" : "Submit"}
              />

              {/* Cancel Button */}
              <Button
                className="rounded-xl shadow-none"
                variant="secondary"
                title={"Cancel"}
                onPress={onExit}
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
