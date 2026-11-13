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
  DATA_REFERENCE_NOTE,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  FOOD_BASIS_LABELS,
  FOOD_SOURCE_LABELS,
} from '../../domain/constants';
import { formatDecimal, formatKcal } from '../../domain/formatters';
import { getTodayIso } from '../../domain/dates';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../ui/ToastProvider';
import { Button } from '../../ui/Button';
import { stringifyFoodExport } from './foodTransfer';
import { downloadTextFile } from '../../utils/download';
import { FoodEditorModal } from './FoodEditorModal';
import { ImportFoodsModal } from './ImportFoodsModal';

type CategoryFilter = FoodCategory | 'all';

export function FoodsPage() {
  const { foods } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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

  const categoryCounts = useMemo(() => {
    const counts = new Map<FoodCategory, number>();
    for (const food of foods) {
      counts.set(food.category, (counts.get(food.category) ?? 0) + 1);
    }
    return counts;
  }, [foods]);

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
        stringifyFoodExport(foods),
      );
      showToast(`已导出 ${foods.length} 项食物。`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '导出失败，请重试。',
        'error',
      );
    }
  };

  return (
    <div className="foods-page page-width">
      <header className="page-header">
        <div>
          <p className="eyebrow">你的营养资料</p>
          <h1>食物库</h1>
          <p>
            内置常见健身食材与主食，也可以添加自己的常吃食物。
            所有营养数据按每 100g 记录。
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={16} />}
            onClick={() => setImportOpen(true)}
          >
            导入 JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={16} />}
            onClick={exportFoods}
          >
            导出
          </Button>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={openNewFood}
          >
            添加食物
          </Button>
        </div>
      </header>

      <section className="library-toolbar" aria-label="筛选食物">
        <div className="search-field search-field--library">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索食物名称或分类"
            aria-label="搜索食物库"
          />
          {foods.length > 0 && (
            <span className="search-field__count">{filteredFoods.length}</span>
          )}
        </div>

        <div className="filter-chips filter-chips--scroll">
          <button
            type="button"
            className={`filter-chip ${category === 'all' ? 'is-active' : ''}`}
            onClick={() => setCategory('all')}
          >
            全部
            <small>{foods.length}</small>
          </button>
          {FOOD_CATEGORIES.map((item) =>
            (categoryCounts.get(item) ?? 0) > 0 ? (
              <button
                type="button"
                key={item}
                className={`filter-chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {FOOD_CATEGORY_LABELS[item]}
                <small>{categoryCounts.get(item)}</small>
              </button>
            ) : null,
          )}
        </div>
      </section>

      {filteredFoods.length > 0 ? (
        <div className="food-grid">
          {filteredFoods.map((food) => (
            <button
              type="button"
              key={food.id}
              className="food-card"
              onClick={() => openEditFood(food)}
            >
              <div className="food-card__top">
                <span className={`category-pill category-pill--${food.category}`}>
                  {FOOD_CATEGORY_LABELS[food.category]}
                </span>
                <span className="source-badge source-badge--small">
                  {FOOD_SOURCE_LABELS[food.source]}
                </span>
              </div>
              <h3>{food.name}</h3>
              <div className="food-card__energy">
                <strong>{formatKcal(food.nutritionPer100g.kcal)}</strong>
                <span>kcal / 100g</span>
              </div>
              <div className="food-card__macros">
                <span>
                  碳水 <strong>{formatDecimal(food.nutritionPer100g.carbsG)}g</strong>
                </span>
                <span>
                  蛋白 <strong>{formatDecimal(food.nutritionPer100g.proteinG)}g</strong>
                </span>
                <span>
                  脂肪 <strong>{formatDecimal(food.nutritionPer100g.fatG)}g</strong>
                </span>
              </div>
              <div className="food-card__footer">
                <span>{FOOD_BASIS_LABELS[food.basis]}</span>
                <span>
                  {food.servings.length > 0
                    ? `${food.servings.length} 种常用份量`
                    : '按克记录'}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <div className="empty-panel__icon">
            <Search size={22} aria-hidden="true" />
          </div>
          <h2>{foods.length === 0 ? '食物库还是空的' : '没有找到食物'}</h2>
          <p>
            {foods.length === 0
              ? '添加常吃食物，之后记录每一餐都会更快。'
              : '换个关键词，或清除分类筛选再试试。'}
          </p>
          <Button
            size="sm"
            icon={<Plus size={16} />}
            onClick={openNewFood}
          >
            添加自定义食物
          </Button>
        </div>
      )}

      <div className="data-note">
        <strong>关于营养数据</strong>
        <p>{DATA_REFERENCE_NOTE}</p>
        <p>
          第一版所有内置数据使用未烹饪基准；熟重版本会在后续版本加入。
        </p>
        <p>
          当前共 {foods.length} 项食物。点开任意食物即可修改，历史饮食记录会保留当时的营养快照。
        </p>
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
