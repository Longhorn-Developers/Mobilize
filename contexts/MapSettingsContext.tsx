import React, { createContext, useContext, useState, ReactNode } from "react";

type MapTheme = "light" | "dark";
type MapType = "standard" | "terrain" | "satellite" | "hybrid";

interface MapSettings {
  theme: MapTheme;
  mapType: MapType;
  showsTraffic: boolean;
  showsBuildings: boolean;
  showsCompass: boolean;
}

interface MapSettingsContextType {
  settings: MapSettings;
  setTheme: (theme: MapTheme) => void;
  setMapType: (mapType: MapType) => void;
  setShowsTraffic: (value: boolean) => void;
  setShowsBuildings: (value: boolean) => void;
  setShowsCompass: (value: boolean) => void;
}

const MapSettingsContext = createContext<MapSettingsContextType | undefined>(undefined);

export function MapSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MapSettings>({
    theme: "light",
    mapType: "standard",
    showsTraffic: false,
    showsBuildings: true,
    showsCompass: true,
  });

  const updateSettings = (updates: Partial<MapSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  return (
    <MapSettingsContext.Provider
      value={{
        settings,
        setTheme: (theme) => updateSettings({ theme }),
        setMapType: (mapType) => updateSettings({ mapType }),
        setShowsTraffic: (value) => updateSettings({ showsTraffic: value }),
        setShowsBuildings: (value) => updateSettings({ showsBuildings: value }),
        setShowsCompass: (value) => updateSettings({ showsCompass: value }),
      }}
    >
      {children}
    </MapSettingsContext.Provider>
  );
}

export function useMapSettings() {
  const context = useContext(MapSettingsContext);
  if (!context) {
    throw new Error("useMapSettings must be used within MapSettingsProvider");
  }
  return context;
}

