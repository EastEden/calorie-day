import { ACTIVITY_LEVELS, GOALS } from './constants';
import type {
  CalculatedTargets,
  Nutrition,
  TargetSettings,
  UserProfile,
} from './types';

const activityFactors = new Map(
  ACTIVITY_LEVELS.map((item) => [item.value, item.factor]),
);

const proteinFactors = new Map(
  ACTIVITY_LEVELS.map((item) => [item.value, item.proteinFactor]),
);

const goalFactors = new Map(GOALS.map((item) => [item.value, item.factor]));

export function calculateTargets(profile: UserProfile): CalculatedTargets {
  const sexOffset = profile.sex === 'male' ? 5 : -161;
  const bmr =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    sexOffset;
  const activityFactor = activityFactors.get(profile.activityLevel) ?? 1.2;
  const goalFactor = goalFactors.get(profile.goal) ?? 1;
  const tdee = bmr * activityFactor;
  const rawCalories = Math.max(0, tdee * goalFactor);
  const caloriesKcal = Math.max(0, Math.round(rawCalories / 10) * 10);

  const proteinFactor = proteinFactors.get(profile.activityLevel) ?? 1.0;
  const proteinG = Math.max(
    0,
    Math.round(profile.weightKg * proteinFactor),
  );
  const fatG = Math.max(0, Math.round((caloriesKcal * 0.25) / 9));
  const remainingKcal = caloriesKcal - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(0, Math.round(remainingKcal / 4));

  return {
    target: {
      kcal: caloriesKcal,
      proteinG,
      carbsG,
      fatG,
    },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalFactor,
  };
}

export function resolveTargets(
  profile: UserProfile | null,
  settings: TargetSettings,
): Nutrition | null {
  if (settings.mode === 'manual' && settings.manual) {
    return settings.manual;
  }

  if (!profile) {
    return null;
  }

  return calculateTargets(profile).target;
}

export function getTargetSourceLabel(
  profile: UserProfile | null,
  settings: TargetSettings,
): string {
  if (settings.mode === 'manual' && settings.manual) {
    return '手动目标';
  }

  return profile ? '自动推荐' : '尚未设置';
}
