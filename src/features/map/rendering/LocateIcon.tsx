import { NavigationArrowIcon } from "phosphor-react-native";
import { View } from "react-native";

//the icon is rotated to match the figma R.L.
const ROTATION_DEG = 45;

export default function LocateIcon({ size = 44 }: { size?: number }) {
    return (
        <View style={{ transform: [{ rotate: `${ROTATION_DEG}deg` }] }}>
            <NavigationArrowIcon size={size} color="#FFFFFF" weight="regular" />
        </View>
    );
}