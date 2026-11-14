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
  FOOD_BASIS_LABEL_KEYS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABEL_KEYS,
  MEAL_META,
} from '../../domain/constants';
import { formatKcal } from '../../domain/formatters';
import {
  getFoodDisplayName,
  getFoodSearchText,
} from '../../domain/localizedText';
import { useI18n } from '../../i18n';
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
  const { foods, recentFoodIds, actions, isSaving } = useApp();
  const { t, locale } = useI18n();
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

  const recentRanks = useMemo(
    () => new Map(recentFoodIds.map((foodId, index) => [foodId, index])),
    [recentFoodIds],
  );

  const filteredFoods = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return foods
      .filter((food) => {
        if (category !== 'all' && food.category !== category) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        return (
          getFoodSearchText(food)
            .toLocaleLowerCase(locale)
            .includes(normalizedSearch) ||
          t(FOOD_CATEGORY_LABEL_KEYS[food.category]).includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const rankA = recentRanks.get(a.id);
        const rankB = recentRanks.get(b.id);
        if (rankA === undefined && rankB === undefined) {
          return 0;
        }
        if (rankA === undefined) {
          return 1;
        }
        if (rankB === undefined) {
          return -1;
        }
        return rankA - rankB;
      });
  }, [category, foods, locale, recentRanks, search, t]);

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const meta = MEAL_META[mealType];
  const mealLabel = t(meta.labelKey);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={
        selectedFood
          ? getFoodDisplayName(selectedFood, locale)
          : t('addFood.title')
      }
      description={
        selectedFood
          ? t('addFood.selectedDescription', {
              meal: mealLabel,
              kcal: formatKcal(selectedFood.nutritionPer100g.kcal),
            })
          : t('addFood.description', { meal: mealLabel })
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
              placeholder={t('addFood.searchPlaceholder')}
              aria-label={t('addFood.searchAria')}
              autoFocus
            />
          </div>

          <div className="filter-chips" aria-label={t('addFood.filterAria')}>
            <button
              type="button"
              className={`filter-chip ${category === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategory('all')}
            >
              {t('addFood.all')}
            </button>
            {FOOD_CATEGORIES.map((item) => (
              <button
                type="button"
                key={item}
                className={`filter-chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {t(FOOD_CATEGORY_LABEL_KEYS[item])}
              </button>
            ))}
          </div>

          <div className="food-picker__meta">
            <span>{t('addFood.foodCount', { n: filteredFoods.length })}</span>
            <span>{t('addFood.per100Label')}</span>
          </div>

          <div className="food-pick-list">
            {filteredFoods.map((food) => {
              const categoryLabel = t(
                FOOD_CATEGORY_LABEL_KEYS[food.category],
              );
              return (
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
                    {categoryLabel.slice(0, 1)}
                  </span>
                  <span className="food-pick-row__main">
                    <strong>
                      {getFoodDisplayName(food, locale)}
                      {recentRanks.has(food.id) && (
                        <span className="food-pick-row__recent">
                          {t('addFood.recent')}
                        </span>
                      )}
                      {food.batch && (
                        <span className="food-pick-row__batch">
                          {t('batch.eyebrow')}
                        </span>
                      )}
                    </strong>
                    <small>
                      {categoryLabel} ·{' '}
                      {t(FOOD_BASIS_LABEL_KEYS[food.basis])}
                      {food.servings.length > 0
                        ? ` · ${t('common.servingCount', {
                            n: food.servings.length,
                          })}`
                        : ''}
                    </small>
                  </span>
                  <span className="food-pick-row__kcal">
                    {formatKcal(food.nutritionPer100g.kcal)}
                    <small>{t('common.kcal')}</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              );
            })}

            {filteredFoods.length === 0 && (
              <div className="picker-empty">
                <p>{t('addFood.noResults')}</p>
                <small>{t('addFood.noResultsHint')}</small>
              </div>
            )}
          </div>

          <p className="picker-hint">{t('addFood.hint')}</p>
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
            {t('addFood.back')}
          </button>

          <PortionForm
            key={selectedFood.id}
            nutritionPer100g={selectedFood.nutritionPer100g}
            servings={selectedFood.servings}
            submitLabel={t('addFood.addTo', { meal: mealLabel })}
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
