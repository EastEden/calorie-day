import type {
  ActivityLevel,
  FoodBasis,
  FoodCategory,
  FoodSource,
  Goal,
  MealType,
  Sex,
  TargetMode,
} from './types';

export const APP_NAME = '每日热量';
export const APP_TAGLINE = '吃得更明白，也活得更轻松';

export const DATA_REFERENCE_NOTE =
  '内置营养数据为常见参考值，会受品种、部位和烹饪方式影响；你可以直接修改食物库。';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_META: Record<
  MealType,
  { label: string; shortLabel: string; subtitle: string; emptyHint: string }
> = {
  breakfast: {
    label: '早餐',
    shortLabel: '早',
    subtitle: '给今天一个温柔的开始',
    emptyHint: '还没有记录早餐',
  },
  lunch: {
    label: '午餐',
    shortLabel: '午',
    subtitle: '补充能量，继续向前',
    emptyHint: '还没有记录午餐',
  },
  dinner: {
    label: '晚餐',
    shortLabel: '晚',
    subtitle: '好好收尾今天',
    emptyHint: '还没有记录晚餐',
  },
  snack: {
    label: '加餐',
    shortLabel: '加',
    subtitle: '小份补给，也算数',
    emptyHint: '还没有记录加餐',
  },
};

export const FOOD_CATEGORIES: FoodCategory[] = [
  'protein',
  'staple',
  'egg_dairy_soy',
  'vegetable',
  'fruit',
  'fat_nut_condiment',
  'other',
];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: '蛋白质',
  staple: '主食',
  egg_dairy_soy: '蛋奶豆',
  vegetable: '蔬菜',
  fruit: '水果',
  fat_nut_condiment: '坚果油脂',
  other: '其他',
};

export const FOOD_BASIS_LABELS: Record<FoodBasis, string> = {
  raw: '生重',
  dry: '干重',
  as_sold: '可食部',
};

export const FOOD_SOURCE_LABELS: Record<FoodSource, string> = {
  builtin: '内置',
  custom: '自定义',
  imported: '导入',
};

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: '女性' },
  { value: 'male', label: '男性' },
];

export const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  label: string;
  description: string;
  factor: number;
  proteinFactor: number;
}[] = [
  {
    value: 'sedentary',
    label: '久坐少动',
    description: '几乎不运动，日常以伏案工作为主',
    factor: 1.2,
    proteinFactor: 1.0,
  },
  {
    value: 'light',
    label: '轻度活动',
    description: '每周轻松运动 1–3 次',
    factor: 1.375,
    proteinFactor: 1.2,
  },
  {
    value: 'moderate',
    label: '中度活动',
    description: '每周运动 3–5 次',
    factor: 1.55,
    proteinFactor: 1.4,
  },
  {
    value: 'active',
    label: '高度活动',
    description: '每周运动 6–7 次，或体力工作',
    factor: 1.725,
    proteinFactor: 1.6,
  },
  {
    value: 'very_active',
    label: '极高活动',
    description: '高强度训练，或重体力劳动',
    factor: 1.9,
    proteinFactor: 1.8,
  },
];

export const GOALS: {
  value: Goal;
  label: string;
  description: string;
  factor: number;
}[] = [
  {
    value: 'lose',
    label: '减脂',
    description: '每日目标约为维持热量的 85%',
    factor: 0.85,
  },
  {
    value: 'maintain',
    label: '维持',
    description: '保持当前体重与训练状态',
    factor: 1,
  },
  {
    value: 'gain',
    label: '增肌',
    description: '每日目标约为维持热量的 110%',
    factor: 1.1,
  },
];

export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  auto: '自动推荐',
  manual: '手动目标',
};

export const NUTRITION_REFERENCE_NOTE =
  '推荐值按 Mifflin–St Jeor 公式估算，仅供参考，不构成医疗或营养建议。';
