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
  isDark?: boolean;
} & TouchableOpacityProps;

export const Button = forwardRef<View, ButtonProps>(
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
