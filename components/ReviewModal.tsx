import {
  XIcon,
  PencilSimpleLineIcon,
  StarIcon,
  CheckIcon,
} from "phosphor-react-native";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  FlatList,
} from "react-native";

import colors from "~/types/colors";

import { Button } from "./Button";

type Review = {
  id: number;
  author?: string | null; // user id or smth
  date: Date;
  rating: number;
  features: string[];
  content: string;
  location_id: number;
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
  const [rating, setRating] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  const features = ["Power-assisted doors", "Manual doors"];
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set<string>(),
  );

  const handleSelectFeature = (feature: string) => {
    setSelectedFeatures((prevSelectedFeatures) => {
      const newSelectedFeatures = new Set<string>(prevSelectedFeatures);
      if (newSelectedFeatures?.has(feature)) {
        newSelectedFeatures?.delete(feature);
      } else {
        newSelectedFeatures?.add(feature);
      }
      console.log(newSelectedFeatures);
      return newSelectedFeatures;
    });
  };

  const handleSubmit = () => {
    // Export info: review id, author, date, rating, features, content, entrance_id/building_id/etc
    onExit();
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
          <Text className="">Leave a Review: {entranceName}</Text>
        </View>

        {/* Rating Section */}
        <View className="gap-2">
          <Text className="text-slate-500">Give a rating</Text>

          {/* Star Functionality */}
          <View className="flex flex-row gap-1">
            {stars.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  setRating(item);
                }}
              >
                <StarIcon
                  size={24}
                  weight={item <= rating ? "fill" : "regular"}
                  color={item <= rating ? colors.ut.yellow : "#9CA3AF"} // tw gray-400
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Feature Selection Section */}
        <View className="gap-2">
          <Text className="text-slate-500">
            Select any features you noticed
          </Text>

          {/* Feature Buttons */}
          <View className="flex max-w-full flex-row gap-2">
            {features.map((feature) => (
              <TouchableOpacity
                key={feature}
                className={`rounded-full border-2 border-ut-black/50 px-2 py-1 
                  ${!selectedFeatures?.has(feature) ? "bg-white" : "bg-indigo-100"}`}
                onPress={() => {
                  handleSelectFeature(feature);
                }}
              >
                <Text className="text-sm">{feature}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Experience Sharing Section */}
        <View className="gap-4">
          <Text className="text-slate-500">
            Share your experience (optional)
          </Text>
          <TextInput
            className="min-h-36 rounded-xl border-2 border-ut-black/20 p-4 placeholder:color-ut-black/50"
            multiline={true}
            placeholder="How was the accessibility? Any specific details that would help other students?"
          />
        </View>

        {/* Buttons */}
        <View className="mt-2 gap-2">
          {/* Submit Button */}
          <Button
            className="gap-2 rounded-xl shadow-none"
            onPress={() => {
              handleSubmit();
            }}
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
            onPress={() => {
              handleClose();
            }}
          />
        </View>

        {/* Encourage Reviews Message */}
        <View className="flex w-full items-center">
          <Text className="w-80 text-center color-ut-black/50">
            Your review helps make campus more accessible for everyone.
          </Text>
        </View>
      </View>
    </>
  );
};

export default ReviewModal;
