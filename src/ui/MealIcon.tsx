import {
  Coffee,
  Moon,
  Sun,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';
import type { MealType } from '../domain/types';

const mealIcons: Record<MealType, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Coffee,
};

export function MealIcon({
  mealType,
  size = 19,
}: {
  mealType: MealType;
  size?: number;
}) {
  const Icon = mealIcons[mealType];
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}
