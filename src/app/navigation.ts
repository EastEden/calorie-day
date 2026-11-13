import {
  CalendarDays,
  Salad,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type AppTab = 'diary' | 'foods' | 'settings';

export const APP_TABS: {
  id: AppTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'diary', label: '今日', icon: CalendarDays },
  { id: 'foods', label: '食物库', icon: Salad },
  { id: 'settings', label: '设置', icon: Settings2 },
];
