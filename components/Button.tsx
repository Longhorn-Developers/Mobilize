import { forwardRef, ReactNode } from "react";
import {
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";

type ButtonProps = {
  title?: string;
  children?: ReactNode;
  variant?: "primary" | "disabled" | "ghost" | "gray";
  icon?: ReactNode;
} & TouchableOpacityProps;

export const Button = forwardRef<View, ButtonProps>(
  ({ title, children, variant = "primary", icon, ...touchableProps }, ref) => {
    const getButtonStyle = () => {
      switch (variant) {
        case "disabled":
          return styles.disabledButton;
        case "ghost":
          return styles.ghostButton;
        case "gray":
          return styles.grayButton;
        default:
          return styles.primaryButton;
      }
    };

    const getTextStyle = () => {
      switch (variant) {
        case "disabled":
          return styles.disabledButtonText;
        case "ghost":
          return styles.ghostButtonText;
        case "gray":
          return styles.grayButtonText;
        default:
          return styles.primaryButtonText;
      }
    };

    return (
      <TouchableOpacity
        ref={ref}
        {...touchableProps}
        className={`${styles.button} ${getButtonStyle()} ${touchableProps.className}`}
      >
        {icon}
        {children || (
          <Text className={`${styles.buttonText} ${getTextStyle()}`}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = "Button";

const styles = {
  button: "flex-row justify-center items-center rounded-md shadow-md py-2 px-4",
  primaryButton: "bg-ut-burntorange",
  disabledButton: "bg-ut-black/20",
  ghostButton: "bg-transparent",
  grayButton: "bg-ut-black/20",
  buttonText: "text-lg font-semibold text-center",
  primaryButtonText: "text-white",
  disabledButtonText: "text-black",
  ghostButtonText: "text-ut-burntorange",
  grayButtonText: "font-normal",
};
