import {
  useMemo,
  useState,
} from 'react';
import {
  Download,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import type {
  Food,
  FoodCategory,
} from '../../domain/types';
import {
  FOOD_BASIS_LABEL_KEYS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABEL_KEYS,
  FOOD_SOURCE_LABEL_KEYS,
} from '../../domain/constants';
import { formatDecimal, formatKcal } from '../../domain/formatters';
import { getTodayIso } from '../../domain/dates';
import {
  getFoodDefaultNutrition,
  getFoodDefaultUnit,
} from '../../domain/measurement';
import {
  getFoodDisplayName,
  getFoodSearchText,
} from '../../domain/localizedText';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { stringifyFoodExport } from './foodTransfer';
import { downloadTextFile } from '../../utils/download';
import { FoodEditorModal } from './FoodEditorModal';
import { ImportFoodsModal } from './ImportFoodsModal';

type CategoryFilter = FoodCategory | 'all';

export function FoodsPage() {
  const { t, locale } = useI18n();
  const { foods } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const libraryFoods = useMemo(
    () => foods.filter((food) => !food.batch),
    [foods],
  );

  const filteredFoods = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return libraryFoods.filter((food) => {
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
    });
  }, [category, libraryFoods, locale, search, t]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<FoodCategory, number>();
    for (const food of libraryFoods) {
      counts.set(food.category, (counts.get(food.category) ?? 0) + 1);
    }
    return counts;
  }, [libraryFoods]);

  const openNewFood = () => {
    setEditingFood(null);
    setEditorOpen(true);
  };

  const openEditFood = (food: Food) => {
    setEditingFood(food);
    setEditorOpen(true);
  };

  const exportFoods = () => {
    try {
      downloadTextFile(
        `calorie-foods-${getTodayIso()}.json`,
        stringifyFoodExport(libraryFoods),
      );
      showToast(t('foods.exported', { n: libraryFoods.length }));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('foods.exportFailed'),
        'error',
      );
    }
  };

  return (
    <div className="foods-page page-width">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('foods.eyebrow')}</p>
          <h1>{t('foods.title')}</h1>
          <p>{t('foods.description')}</p>
        </div>
        <div className="page-header__actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={16} />}
            onClick={() => setImportOpen(true)}
          >
            {t('foods.import')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={exportFoods}
          >
            {t('foods.export')}
          </Button>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={openNewFood}
          >
            {t('foods.add')}
          </Button>
        </div>
      </header>

      <section className="library-toolbar" aria-label={t('foods.filterAria')}>
        <div className="search-field search-field--library">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('foods.searchPlaceholder')}
            aria-label={t('foods.searchAria')}
          />
          {libraryFoods.length > 0 && (
            <span className="search-field__count">
              {filteredFoods.length}
            </span>
          )}
        </div>

        <div className="filter-chips filter-chips--scroll">
          <button
            type="button"
            className={`filter-chip ${category === 'all' ? 'is-active' : ''}`}
            onClick={() => setCategory('all')}
          >
            {t('foods.all')}
            <small>{libraryFoods.length}</small>
          </button>
          {FOOD_CATEGORIES.map((item) =>
            (categoryCounts.get(item) ?? 0) > 0 ? (
              <button
                type="button"
                key={item}
                className={`filter-chip ${
                  category === item ? 'is-active' : ''
                }`}
                onClick={() => setCategory(item)}
              >
                {t(FOOD_CATEGORY_LABEL_KEYS[item])}
                <small>{categoryCounts.get(item)}</small>
              </button>
            ) : null,
          )}
        </div>
      </section>

      {filteredFoods.length > 0 ? (
        <div className="food-grid">
          {filteredFoods.map((food) => {
            const unit = getFoodDefaultUnit(food);
            const per100 = getFoodDefaultNutrition(food);

            return (
            <button
              type="button"
              key={food.id}
              className="food-card"
              onClick={() => openEditFood(food)}
            >
              <div className="food-card__top">
                <span
                  className={`category-pill category-pill--${food.category}`}
                >
                  {t(FOOD_CATEGORY_LABEL_KEYS[food.category])}
                </span>
                <span className="source-badge source-badge--small">
                  {t(FOOD_SOURCE_LABEL_KEYS[food.source])}
                </span>
              </div>
              <h3>{getFoodDisplayName(food, locale)}</h3>
              <div className="food-card__energy">
                <strong>{formatKcal(per100.kcal)}</strong>
                <span>
                  {t('common.kcal')} / 100{unit}
                </span>
              </div>
              <div className="food-card__macros">
                <span>
                  {t('common.carbs')}{' '}
                  <strong>
                    {formatDecimal(per100.carbsG)}
                    {t('common.gram')}
                  </strong>
                </span>
                <span>
                  {t('common.proteinShort')}{' '}
                  <strong>
                    {formatDecimal(per100.proteinG)}
                    {t('common.gram')}
                  </strong>
                </span>
                <span>
                  {t('common.fat')}{' '}
                  <strong>
                    {formatDecimal(per100.fatG)}
                    {t('common.gram')}
                  </strong>
                </span>
              </div>
              <div className="food-card__footer">
                <span>{t(FOOD_BASIS_LABEL_KEYS[food.basis])}</span>
                <span>
                  {food.servings.length > 0
                    ? t('common.servingCount', { n: food.servings.length })
                    : t('foods.byGram')}
                </span>
              </div>
            </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel">
          <div className="empty-panel__icon">
            <Search size={22} aria-hidden="true" />
          </div>
          <h2>
            {libraryFoods.length === 0
              ? t('foods.emptyTitle')
              : t('foods.emptySearchTitle')}
          </h2>
          <p>
            {libraryFoods.length === 0
              ? t('foods.emptyBody')
              : t('foods.emptySearchBody')}
          </p>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={openNewFood}
          >
            {t('foods.addCustom')}
          </Button>
        </div>
      )}

      <div className="data-note">
        <strong>{t('foods.dataTitle')}</strong>
        <p>{t('notes.dataReference')}</p>
        <p>{t('foods.dataBasis')}</p>
        <p>{t('foods.dataCount', { n: libraryFoods.length })}</p>
      </div>

      <FoodEditorModal
        open={editorOpen}
        food={editingFood}
        onClose={() => setEditorOpen(false)}
      />
      <ImportFoodsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
