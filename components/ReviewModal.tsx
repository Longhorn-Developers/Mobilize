import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  XIcon,
  StarIcon,
  CheckIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  QuestionIcon
} from "phosphor-react-native";
import { useEffect, useState } from "react";
import { useForm, useController, Control } from "react-hook-form";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image } from "react-native";
import Toast from "react-native-toast-message";

import colors from "~/types/colors";
import { Review } from "~/types/database";

import { Button } from "./Button";

const TouchableRating = ({
  name,
  control,
}: {
  name: "rating";
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: 0,
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

const FeatureButtons = ({
  name,
  control,
}: {
  name: "features";
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: [],
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
      className={`rounded-full border-2 border-ut-black/50 px-2 py-1 
        ${!field.value.includes(feature) ? "bg-white" : "bg-indigo-100"}`}
      onPress={() => {
        handleSelectFeature(feature);
      }}
    >
      <Text className="text-sm">{feature}</Text>
    </TouchableOpacity>
  ));
};

interface ReviewEntry {
  id: string;
  avatar_url: string;
  name: string;
}

const ReviewsList = ({ location_id }: { location_id: string }) => {
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    // fetch reviews by building name/ some other location id through cloudflare worker
    // next json then next setReviews
    console.log(`[ReviewsList] fetching reviews for "${location_id}"`);
  }, [location_id]);

  return (
    <View className="flex flex-row justify-center items-center min-h-20">
      {(reviews?.length > 0) ? (
      /* Reviews List */
      <FlatList<ReviewEntry>
        data={reviews}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View>
            <Image className="rounded-full" source={{ uri: item.avatar_url}} />
            <Text>
              {item.name}
            </Text>

          </View>
        )}
      />) : (
        /* No Reviews */
        <View className="flex flex-row items-center gap-4">
          <QuestionIcon size={32} color="#64748b" />
          <View className="flex flex-col gap-1">
            <Text className="text-slate-500">
              No reviews found.
            </Text>
            <Text className="text-slate-500">
              Be the first to write a review!
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const ReviewContentInput = ({
  name,
  control,
}: {
  name: "content";
  control: Control<Review>;
}) => {
  const { field } = useController({
    control,
    defaultValue: "",
    name,
  });

  return (
    <TextInput
      className="min-h-36 rounded-xl border-2 border-ut-black/20 p-4 placeholder:color-ut-black/50"
      multiline={true}
      placeholder="How was the accessibility? Any specific details that would help other students?"
      onChangeText={field.onChange}
      maxLength={280}
    />
  );
};

interface ReviewModalProps {
  className?: string;
  entranceName: string;
  buildingName: string;
  onExit: () => void;
}

const ReviewModal = ({
  className,
  entranceName,
  buildingName,
  onExit,
}: ReviewModalProps) => {
  const { control, handleSubmit } = useForm<Review>();
  const [formState, setFormState] = useState(0);

  const bottomTabBarHeight = useBottomTabBarHeight();

  const onSubmit = (data: Review) => {
    if (data.rating === 0) {
      /* TODO: Should error if no rating selected */
      console.log("[onSubmit] rating not selected!");
      Toast.show({
        type: "error",
        text2: "Please select a rating.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    } else {
      // Insert info: review id, author, rating, features, content, entrance_id/building_id/etc
      data.id = 1; // Won't be needed
      data.user_id = 1; // Somehow get user from session data
      data.location_id = `${buildingName}-${entranceName}`;

      console.log(JSON.stringify(data));
      Toast.show({
        type: "success",
        text2:
          "Thank you for your review! Your insights are helpful in shaping the community’s experience.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight * 6,
      });

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
          <Text className="">
            {formState === 0 ? "Reviews:" : "Leave a Review:"} {entranceName}
          </Text>
        </View>

        {formState === 0 ? (
          <>
            <ReviewsList location_id={buildingName} />
            <TouchableOpacity
              className="w-full rounded-full bg-ut-burntorange/20"
              onPress={() => {
                setFormState((prevFormState: number) => {
                  return prevFormState + 1;
                });
              }}
            >
              <View className="flex flex-row justify-between px-4 py-1">
                <Text className="pt-1 leading-none text-ut-burntorange">
                  Leave a Review
                </Text>
                <ArrowRightIcon
                  size={20}
                  color={colors.ut.burntorange}
                  weight="bold"
                />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Rating Section */}
            <View className="gap-2">
              <Text className="text-slate-500">Give a rating</Text>

              {/* Star Functionality */}
              <View className="flex flex-row gap-1">
                <TouchableRating name="rating" control={control} />
              </View>
            </View>

            {/* Feature Selection Section */}
            <View className="gap-2">
              <Text className="text-slate-500">
                Select any features you noticed
              </Text>

              {/* Feature Buttons */}
              <View className="flex max-w-full flex-row gap-2">
                <FeatureButtons name="features" control={control} />
              </View>
            </View>

            {/* Experience Sharing Section */}
            <View className="gap-4">
              <Text className="text-slate-500">
                Share your experience (optional)
              </Text>
              <ReviewContentInput name="content" control={control} />
            </View>

            {/* Buttons */}
            <View className="mt-2 gap-2">
              {/* Submit Button */}
              <Button
                className="gap-2 rounded-xl shadow-none"
                onPress={handleSubmit(onSubmit)}
              >
                <CheckIcon size={28} color="white" />
                <Text className="text-lg font-semibold text-white">
                  Submit Review
                </Text>
              </Button>

              {/* Cancel Button */}
              <Button
                className="rounded-xl shadow-none"
                variant="gray"
                title={"Cancel"}
                onPress={handleClose}
              />
            </View>

            {/* Encourage Reviews Message */}
            <View className="flex w-full items-center">
              <Text className="w-80 text-center color-ut-black/50">
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
