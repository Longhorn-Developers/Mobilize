import { forwardRef } from "react";
import {
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";

type ButtonProps = {
  title: string;
  variant?: "primary" | "disabled";
} & TouchableOpacityProps;

export const Button = forwardRef<View, ButtonProps>(
  ({ title, variant = "primary", ...touchableProps }, ref) => {
    return (
      <TouchableOpacity
        ref={ref}
        {...touchableProps}
        className={`${styles.button} ${variant === "disabled" ? styles.disabledButton : styles.primaryButton} ${touchableProps.className}`}
      >
        <Text
          className={`${styles.buttonText} ${variant === "disabled" ? styles.disabledButtonText : styles.primaryButtonText}`}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  },
);

Button.displayName = "Button";

const styles = {
  button: "items-center rounded-md shadow-md py-2 px-4",
  primaryButton: "bg-ut-burntorange",
  disabledButton: "bg-ut-black/20",
  buttonText: "text-lg font-semibold text-center",
  primaryButtonText: "text-white",
  disabledButtonText: "text-black",
};
