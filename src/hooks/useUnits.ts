import { useSettings } from '../contexts/SettingsContext';

export const useUnits = () => {
  const { settings } = useSettings();
  
  const formatWeight = (grams: number) => {
    if (settings.unitSystem === 'imperial') {
      return `${(grams * 0.035274).toFixed(1)} oz`;
    }
    return `${grams}g`;
  };
  
  const formatCalories = (kcal: number) => `${Math.round(kcal)} kcal`;
  
  return { formatWeight, formatCalories };
};
