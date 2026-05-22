import { useSettings } from '../contexts/SettingsContext';

export const useUnits = () => {
  const { settings } = useSettings();
  const isImperial = settings.unitSystem === 'imperial';

  const formatGram = (grams: number) => {
    if (isImperial) {
      return `${(grams * 0.035274).toFixed(1)} oz`;
    }
    return `${Math.round(grams)}g`;
  };

  const formatKg = (kg: number) => {
    if (isImperial) {
      return `${(kg * 2.20462).toFixed(1)} lbs`;
    }
    return `${kg} kg`;
  };

  const formatCm = (cm: number) => {
    if (isImperial) {
      return `${(cm * 0.393701).toFixed(1)} in`;
    }
    return `${cm} cm`;
  };

  const formatWeight = (grams: number) => formatGram(grams);
  const formatCalories = (kcal: number) => `${Math.round(kcal)} kcal`;

  const unitLabel = {
    gram: isImperial ? 'oz' : 'g',
    kg: isImperial ? 'lbs' : 'kg',
    cm: isImperial ? 'in' : 'cm',
  };

  return { formatGram, formatKg, formatCm, formatWeight, formatCalories, unitLabel, isImperial };
};
