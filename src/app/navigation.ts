import {
  CalendarDays,
  Salad,
  Settings2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '../i18n';

export type AppTab = 'diary' | 'trends' | 'foods' | 'settings';

export const APP_TABS: {
  id: AppTab;
  labelKey: TranslationKey;
  icon: LucideIcon;
}[] = [
  { id: 'diary', labelKey: 'nav.diary', icon: CalendarDays },
  { id: 'trends', labelKey: 'nav.trends', icon: TrendingUp },
  { id: 'foods', labelKey: 'nav.foods', icon: Salad },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings2 },
];
