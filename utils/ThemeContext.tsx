import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextType = {
  colorScheme: "light" | "dark";
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: "light",
  themeMode: "system",
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? "light";
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  // Restore persisted preference on mount
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem("theme_mode").then((v) => {
      if (!isMounted) return;
      if (v === "light" || v === "dark" || v === "system") {
        setThemeModeState(v);
        Appearance.setColorScheme(v === "system" ? null : v);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem("theme_mode", mode);
    // Override system color scheme so NativeWind dark: classes activate immediately
    Appearance.setColorScheme(mode === "system" ? null : mode);
  };

  const colorScheme: "light" | "dark" =
    themeMode === "system" ? systemScheme : themeMode;

  return (
    <ThemeContext.Provider value={{ colorScheme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
