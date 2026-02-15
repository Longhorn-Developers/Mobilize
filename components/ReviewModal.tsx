import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  XIcon,
  StarIcon,
  QuestionIcon,
  DotsThreeIcon,
} from "phosphor-react-native";
import { useState } from "react";
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
  useInsertReview,
  useReviews,
  useUpdateReview,
} from "~/utils/api-hooks";

import { Button } from "./Button";

const TouchableRating = ({
  name,
  defaultValue,
  control,
}: {
  name: "rating";
  defaultValue: number;
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: defaultValue,
    name,
  });

  const stars = [1, 2, 3, 4, 5];

  return stars.map((item) => (
    <TouchableOpacity key={item} onPress={() => field.onChange(item)}>
      <StarIcon
        size={24}
        weight={item <= field.value ? "fill" : "regular"}
        color={item <= field.value ? colors.ut.yellow : "#9CA3AF"} // tw gray-400
      />
    </TouchableOpacity>
  ));
};

// Features - power-assisted doors, manual doors, etc
const FeatureButtons = ({
  name,
  defaultValue,
  control,
}: {
  name: "features";
  defaultValue: string[];
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: defaultValue,
    name,
  });

  const features = ["Power-assisted doors", "Manual doors"];

  const handleSelectFeature = (feature: string) => {
    const newSelectedFeatures = field.value.includes(feature)
      ? field.value.filter((f) => f !== feature)
      : [...field.value, feature];

    field.onChange(newSelectedFeatures);
  };

  return features.map((feature) => (
    <TouchableOpacity
      key={feature}
      className={`rounded-full border-2 px-2 py-1 
        ${!field.value.includes(feature) ? " border-ut-black/50 bg-white" : "border-ut-burntorange/40 bg-ut-burntorange/20"}`}
      onPress={() => {
        handleSelectFeature(feature);
      }}
    >
      <Text className="text-sm">{feature}</Text>
    </TouchableOpacity>
  ));
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

const Rating = ({ rating, size }: { rating: number; size: number }) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View className="flex flex-row">
      {stars.map((item) => (
        <StarIcon
          key={item}
          size={size}
          weight={item <= rating ? "fill" : "regular"}
          color={item <= rating ? colors.ut.yellow : "#9CA3AF"} // tw gray-400
        />
      ))}
    </View>
  );
};


const ReviewCard = ({
  review,
  actionFn
}: {
  review: ReviewEntry,
  actionFn: () => void
}) => {
  const elapsed_seconds: number = (new Date().getTime() - new Date(review.updated_at).getTime()) / 1000;
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
    elapsed_time_msg = ">365d";
  }

  // Consider using grid instead of a nested views
  return (
    <>
      {/* Review Card */}
      <View className="flex flex-col gap-3">
        <View className="flex flex-row justify-between">
          <View className="flex flex-row items-center gap-2">
            {/* Profile Image */}
            <Image
              className="h-6 w-6 rounded-full bg-slate-300"
              source={{ uri: review.profile_avatar_url }}
            />
            {/* Profle Name */}
            <Text className="color-[#3C4145]">
              {review.profile_display_name}
            </Text>
          </View>
          <View className="flex flex-row items-center gap-2">
            {/* Rating */}
            <Rating rating={review.rating} size={18} />
            {/* How Recent (Time) */}
            {/* TODO: elapsed time sys */}
            <Text className="color-slate-400">{elapsed_time_msg} ago</Text>
            {/* Options (current user's review) */}
            <TouchableOpacity
              className="pl-4"
              onPress={actionFn}
            >
              <DotsThreeIcon size={28} weight="bold" color="black" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Review Content */}
        <Text className="max-w-full">{review.content}</Text>
      </View>
    </>
  );
};


const ReviewsList = ({
  reviews,
  userHasReview,
  setMenuState
}: {
  reviews: ReviewEntry[];
  userHasReview: boolean;
  setMenuState: () => void;
}) => {
  return (
    <>
      <View className="flex flex-row items-center justify-center">
        {reviews?.length > 0 || userHasReview ? (
          /* Scrollable Reviews List */
          <FlatList<ReviewEntry>
            data={reviews}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <ReviewCard review={item} actionFn={setMenuState} />}
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
    </>
  );
};

interface ReviewModalProps {
  className?: string;
  poi_id: number;
  entranceName: string;
  buildingName: string;
  activeUserId: number;
  onExit: () => void;
}

const ReviewModal = ({
  className,
  poi_id,
  entranceName,
  buildingName,
  activeUserId,
  onExit,
}: ReviewModalProps) => {
  const { control, handleSubmit } = useForm<Review>();
  const [formState, setFormState] = useState(0);
  const [isMenuActive, setIsMenuActive] = useState(false);

  const bottomTabBarHeight = useBottomTabBarHeight();

  const { mutateAsync: insertReview } = useInsertReview();
  const { mutateAsync: updateReview } = useUpdateReview();
  const { mutateAsync: deleteReview } = useDeleteReview();

  // query reviews from db
  const { data: reviews = [], isLoading } = useReviews(poi_id); // determine most efficient way to 

  const existingReview = reviews.find((review) => review.user_id === activeUserId);
  const isEditMode = !!existingReview;

  const onSubmit = async (data: Review) => {
    if (data.rating === 0) {
      // Warning if no rating selected
      Toast.show({
        type: "error",
        text2: "Please select a rating.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    } else {
      // Post review (insert)
      data.user_id = activeUserId;
      data.poi_id = poi_id;

      // If review exists, edit existing review; otherwise, post new review
      if (isEditMode) {
        updateReview({
          id: existingReview.id,
          rating: data.rating,
          features: JSON.stringify(data.features),
          content: data?.content ?? undefined,
        });
      } else {
        insertReview({
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

  const handleClose = () => {
    onExit();
  };

  return (
    <>
      {/* Main Modal */}
      <View className={`gap-4 rounded-xl bg-white px-8 py-8 ${className}`}>
        {/* Exit Button */}
        <Button
          variant="ghost"
          title=""
          className="absolute right-0 top-8 shadow-none"
          onPress={handleClose}
          icon={<XIcon size={28} color={colors.ut.black + "50"} />}
        />

        {/* Headings */}
        <View className="gap-2">
          <Text className="max-w-64 pt-1 text-3xl font-bold">
            {buildingName}
          </Text>
          <Text className="color-[#616467]">{entranceName}</Text>
        </View>

        {formState === 0 ? (
          // Reviews List Section
          <View className="gap-6">
            {/* Active User Review Card */}
            {existingReview &&
              <ReviewCard
                review={existingReview}
                actionFn={() => setIsMenuActive(prev => !prev)}
              />
            }
            {/* Edit/Delete Menu */}
            {existingReview && isMenuActive &&
              <View className="absolute right-12">
                <View className="z-40 flex flex-col gap-2 rounded-md bg-white px-4 py-3 shadow-md shadow-black/20">
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
                        poi_id: existingReview.poi_id
                      });
                      setIsMenuActive(false);
                    }}
                  >
                    <Text className="text-lg color-red-700">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }

            {/* List of Reviews for a given POI */}
            <ReviewsList
              reviews={reviews.filter(review => review.user_id !== activeUserId)}
              userHasReview={!!existingReview}
              setMenuState={() => setIsMenuActive(prev => !prev)}
            />
            <Button
              className="rounded-xl shadow-none"
              title="Leave a Review"
              onPress={() => {
                // query previously submitted review from user id
                setFormState(1);
              }}
            />
          </View>
        ) : (
          <>
            {/* Rating Section */}
            <View className="gap-2">
              <Text className="">Give a rating</Text>

              {/* Star Functionality */}
              <View className="flex flex-row gap-1">
                <TouchableRating
                  name="rating"
                  defaultValue={existingReview?.rating || 0}
                  control={control}
                />
              </View>
            </View>

            {/* Feature Selection Section */}
            <View className="gap-2">
              <Text className="">Select any features you noticed</Text>

              {/* Feature Buttons */}
              <View className="flex max-w-full flex-row gap-2">
                <FeatureButtons
                  name="features"
                  defaultValue={existingReview?.features || []}
                  control={control}
                />
              </View>
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
            <View className="mt-2 gap-2">
              {/* Submit Button */}
              <Button
                className="gap-2 rounded-xl shadow-none"
                onPress={handleSubmit(onSubmit)}
                title={"Submit"}
              />

              {/* Cancel Button */}
              <Button
                className="rounded-xl shadow-none"
                variant="secondary"
                title={"Cancel"}
                onPress={handleClose}
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
