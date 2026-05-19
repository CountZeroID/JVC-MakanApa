import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'id' | 'en';
export type UnitSystem = 'metric' | 'imperial';

export interface Settings {
  language: Language;
  unitSystem: UnitSystem;
  darkMode: boolean;
  naraNotifications: boolean;
}

const defaultSettings: Settings = {
  language: 'id',
  unitSystem: 'metric',
  darkMode: false,
  naraNotifications: false,
};

const SettingsContext = createContext<{
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}>({
  settings: defaultSettings,
  updateSetting: () => {},
});

export const SettingsProvider = ({ children, initialSettings }: { children: ReactNode; initialSettings?: Partial<Settings> }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved), ...initialSettings };
      } catch (e) {
        return { ...defaultSettings, ...initialSettings };
      }
    }
    return { ...defaultSettings, ...initialSettings };
  });

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('settings', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
