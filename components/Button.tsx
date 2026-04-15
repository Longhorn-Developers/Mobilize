import { forwardRef, ReactNode } from "react";
import {
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  StyleSheet,
} from "react-native";

type ButtonProps = {
  title?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "disabled" | "ghost" | "gray";
  icon?: ReactNode;
} & TouchableOpacityProps;

export const Button = forwardRef<View, ButtonProps>(
<<<<<<< HEAD
  (
    {
      title,
      children,
      variant = "primary",
      icon,
      style,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyle = getVariantStyle(variant, disabled);
    const textStyle = getTextVariantStyle(variant, disabled);
=======
  ({ title, children, variant = "primary", icon, ...touchableProps }, ref) => {
    const getButtonStyle = () => {
      switch (variant) {
        case "disabled":
          return styles.disabledButton;
        case "ghost":
          return styles.ghostButton;
        case "gray":
          return styles.grayButton;
        case "secondary":
          return styles.secondaryButton;
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
        case "secondary":
          return styles.ghostButtonText;
        default:
          return styles.primaryButtonText;
      }
    };
>>>>>>> f8797be6126544728afc887ead7c9e6f0fe7a84f

    return (
      <TouchableOpacity
        ref={ref}
        style={[styles.button, variantStyle, style]}
        activeOpacity={0.8}
        disabled={disabled}
        {...props}
      >
        {icon}
        {children || <Text style={[styles.text, textStyle]}>{title}</Text>}
      </TouchableOpacity>
    );
  }
);

Button.displayName = "Button";

<<<<<<< HEAD
const getVariantStyle = (
  variant: ButtonProps["variant"],
  disabled?: boolean
) => {
  if (disabled) return styles.disabledButton;

  switch (variant) {
    case "ghost":
      return styles.ghostButton;
    case "gray":
      return styles.grayButton;
    default:
      return styles.primaryButton;
  }
=======
const styles = {
  button: "flex-row justify-center items-center rounded-md shadow-md py-2 px-4",
  primaryButton: "bg-ut-burntorange",
  secondaryButton: "border-ut-burntorange border-2",
  disabledButton: "bg-ut-black/20",
  ghostButton: "bg-transparent",
  grayButton: "bg-ut-black/20",
  buttonText: "text-lg font-semibold text-center",
  primaryButtonText: "text-white",
  disabledButtonText: "text-slate-700",
  ghostButtonText: "text-ut-burntorange",
  grayButtonText: "font-normal",
>>>>>>> f8797be6126544728afc887ead7c9e6f0fe7a84f
};

const getTextVariantStyle = (
  variant: ButtonProps["variant"],
  disabled?: boolean
) => {
  if (disabled) return styles.disabledText;

  switch (variant) {
    case "ghost":
      return styles.ghostText;
    case "gray":
      return styles.grayText;
    default:
      return styles.primaryText;
  }
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  // Variants
  primaryButton: {
    backgroundColor: "#BF5700", // UT burnt orange
  },
  disabledButton: {
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  grayButton: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },

  // Text
  text: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryText: {
    color: "white",
  },
  disabledText: {
    color: "black",
  },
  ghostText: {
    color: "#BF5700",
  },
  grayText: {
    fontWeight: "400",
  },
});