import { forwardRef, ReactNode } from "react";
import { Text, TouchableOpacity, TouchableOpacityProps,
  View, StyleSheet } from "react-native";

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
    const computedDisabled = Boolean(disabled || variant === "disabled");
    const variantStyle = getVariantStyle(variant, computedDisabled);
    const textStyle = getTextVariantStyle(variant, computedDisabled);

    return (
      <TouchableOpacity
        ref={ref}
        style={[styles.button, variantStyle, style]}
        activeOpacity={computedDisabled ? 1 : 0.8}
        disabled={computedDisabled}
        accessibilityState={{ disabled: computedDisabled }}
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
    case "secondary":
      return styles.secondaryButton;
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
    case "secondary":
      return styles.secondaryText;
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
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#BF5700",
  },
  disabledButton: {
    backgroundColor: "#6B7280",
    borderWidth: 0,
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  grayButton: {
    backgroundColor: "#374151",
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
  secondaryText: {
    color: "#BF5700",
  },
  disabledText: {
    color: "rgba(255,255,255,0.8)",
  },
  ghostText: {
    color: "#BF5700",
  },
  grayText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
