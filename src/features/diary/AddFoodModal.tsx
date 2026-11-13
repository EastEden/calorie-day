import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import type {
  Food,
  FoodCategory,
  MealType,
} from '../../domain/types';
import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  FOOD_BASIS_LABELS,
  MEAL_META,
} from '../../domain/constants';
import { formatKcal } from '../../domain/formatters';
import { useApp } from '../../state/AppContext';
import { Modal } from '../../ui/Modal';
import { PortionForm } from './PortionForm';

interface AddFoodModalProps {
  open: boolean;
  mealType: MealType;
  onClose: () => void;
}

type CategoryFilter = FoodCategory | 'all';

export function AddFoodModal({
  open,
  mealType,
  onClose,
}: AddFoodModalProps) {
  const { foods, actions, isSaving } = useApp();
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedFood(null);
    setSearch('');
    setCategory('all');
  }, [open, mealType]);

  const filteredFoods = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('zh-CN');
    return foods.filter((food) => {
      if (category !== 'all' && food.category !== category) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        food.name.toLocaleLowerCase('zh-CN').includes(normalizedSearch) ||
        FOOD_CATEGORY_LABELS[food.category].includes(normalizedSearch)
      );
    });
  }, [category, foods, search]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const meta = MEAL_META[mealType];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={selectedFood ? selectedFood.name : '添加食物'}
      description={
        selectedFood
          ? `添加到${meta.label} · 每 100g ${formatKcal(selectedFood.nutritionPer100g.kcal)} kcal`
          : `为${meta.label}选择食物，再填写本次实际摄入的份量。`
      }
    >
      {!selectedFood ? (
        <div className="food-picker">
          <div className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索食物名称"
              aria-label="搜索食物"
              autoFocus
            />
          </div>

          <div className="filter-chips" aria-label="按类别筛选">
            <button
              type="button"
              className={`filter-chip ${category === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategory('all')}
            >
              全部
            </button>
            {FOOD_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`filter-chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {FOOD_CATEGORY_LABELS[item]}
              </button>
            ))}
          </div>

          <div className="food-picker__meta">
            <span>{filteredFoods.length} 项食物</span>
            <span>每 100g 营养参考值</span>
          </div>

          <div className="food-pick-list">
            {filteredFoods.map((food) => (
              <button
                type="button"
                key={food.id}
                className="food-pick-row"
                onClick={() => setSelectedFood(food)}
              >
                <span
                  className={`food-pick-row__badge food-pick-row__badge--${food.category}`}
                  aria-hidden="true"
                >
                  {FOOD_CATEGORY_LABELS[food.category].slice(0, 1)}
                </span>
                <span className="food-pick-row__main">
                  <strong>{food.name}</strong>
                  <small>
                    {FOOD_CATEGORY_LABELS[food.category]} ·{' '}
                    {FOOD_BASIS_LABELS[food.basis]}
                    {food.servings.length > 0
                      ? ` · ${food.servings.length} 种常用份量`
                      : ''}
                  </small>
                </span>
                <span className="food-pick-row__kcal">
                  {formatKcal(food.nutritionPer100g.kcal)}
                  <small>kcal</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}

            {filteredFoods.length === 0 && (
              <div className="picker-empty">
                <p>没有找到匹配的食物。</p>
                <small>可以换个关键词，或到“食物库”里添加自定义食物。</small>
              </div>
            )}
          </div>

          <p className="picker-hint">
            找不到常吃的食物？到“食物库”添加后，这里会立即出现。
          </p>
        </div>
      ) : (
        <div className="food-portion-step">
          <button
            type="button"
            className="text-button text-button--back"
            onClick={() => setSelectedFood(null)}
            disabled={isSaving}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            重新选择食物
          </button>

          <PortionForm
            key={selectedFood.id}
            nutritionPer100g={selectedFood.nutritionPer100g}
            servings={selectedFood.servings}
            submitLabel={`加入${meta.label}`}
            disabled={isSaving}
            onSubmit={async (amount) => {
              const ok = await actions.addEntry(
                mealType,
                selectedFood,
                amount,
              );
              if (ok) {
                onClose();
              }
              return ok;
            }}
          />
        </div>
      )}
    </Modal>
  );
}
