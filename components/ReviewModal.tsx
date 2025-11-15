import {XIcon} from "phosphor-react-native";
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
  stars: number;
  date: Date;
  content: string;
  location_id: number;
}

interface ReviewModalProps {
  className?: string;
  buildingName: string;
  onExit: () => void;
}

const ReviewModal = ({className, buildingName, onExit}: ReviewModalProps) => {
  const handleClose = () => {
    onExit();
  }

  return (
    <>
      {/* Main Modal */}
      <View className={`gap-4 rounded-lg bg-white pl-10 pr-4 py-10 ${className}`}>

        {/* Headings and Exit Button */}
        <View className="">
          <View className="flex flex-row justify-between">

            <Text className='text-3xl font-bold pt-1'>{buildingName}</Text>

            {/* Exit Button */}
            <Button
              variant="ghost"
              title=""
              className=""
              onPress={handleClose}
              icon={<XIcon size={28} color={colors.ut.gray} />}
            />
          </View>

          <Text className=''>Reviews</Text>
        </View>


      </View>
    </>
  )
}

export default ReviewModal