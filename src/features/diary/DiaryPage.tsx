import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FoodEntry, MealType } from '../../domain/types';
import { MEAL_META, MEAL_TYPES } from '../../domain/constants';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { AnalysisCard } from './AnalysisCard';
import { AddFoodModal } from './AddFoodModal';
import { CalorieHero } from './CalorieHero';
import { DayToolbar } from './DayToolbar';
import { EntryEditorModal } from './EntryEditorModal';
import { MacroOverview } from './MacroOverview';
import { MealCard } from './MealCard';

interface DiaryPageProps {
  onShare: () => void;
}

interface EditingEntry {
  mealType: MealType;
  entry: FoodEntry;
}

function DiarySkeleton() {
  return (
    <div className="diary-skeleton" aria-hidden="true">
      <div className="overview-grid">
        <div className="skeleton skeleton--hero" />
        <div className="skeleton skeleton--analysis" />
      </div>
      <div className="skeleton skeleton--macros" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton--meal" />
        <div className="skeleton skeleton--meal" />
        <div className="skeleton skeleton--meal" />
      </div>
    </div>
  );
}

export function DiaryPage({ onShare }: DiaryPageProps) {
  const {
    selectedDate,
    currentLog,
    summary,
    isLogLoading,
    logError,
    isSaving,
    actions,
  } = useApp();
  const [addMeal, setAddMeal] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<EditingEntry | null>(null);

  useEffect(() => {
    setAddMeal(null);
    setEditing(null);
  }, [selectedDate]);

  const contentReady = !isLogLoading && !logError && currentLog !== null;
  const shareDisabled = summary.entryCount === 0 || summary.target === null;
  const mealsDisabled = isSaving || isLogLoading || Boolean(logError);

  return (
    <div className="diary-page page-width">
      <DayToolbar />

      {isLogLoading && <DiarySkeleton />}

      {!isLogLoading && logError && (
        <section className="inline-error" role="alert">
          <div className="inline-error__icon">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <div>
            <h2>这一天的记录暂时无法读取</h2>
            <p>{logError}</p>
            <p className="inline-error__hint">
              数据没有被清空。请重新加载；如果问题持续，请先不要继续写入。
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={actions.retryLogLoad}
            >
              重新加载
            </Button>
          </div>
        </section>
      )}

      {contentReady && (
        <>
          <div className="overview-grid">
            <CalorieHero summary={summary} date={selectedDate} />
            <AnalysisCard
              summary={summary}
              onShare={onShare}
              shareDisabled={shareDisabled}
            />
          </div>

          <MacroOverview summary={summary} />

          <section className="meals-section" aria-labelledby="meals-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">一日三餐</p>
                <h2 id="meals-title">餐食记录</h2>
              </div>
              <span className="section-heading__hint">
                共 {summary.entryCount} 项记录
              </span>
            </div>

            <div className="meal-list">
              {MEAL_TYPES.map((mealType) => (
                <MealCard
                  key={mealType}
                  mealType={mealType}
                  entries={currentLog.meals[mealType]}
                  summary={summary.byMeal[mealType]}
                  disabled={mealsDisabled}
                  onAdd={() => setAddMeal(mealType)}
                  onEdit={(entry) => setEditing({ mealType, entry })}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <AddFoodModal
        open={addMeal !== null}
        mealType={addMeal ?? 'breakfast'}
        onClose={() => setAddMeal(null)}
      />

      <EntryEditorModal
        open={editing !== null}
        mealType={editing?.mealType ?? 'breakfast'}
        entry={editing?.entry ?? null}
        onClose={() => setEditing(null)}
      />

      <p className="diary-footnote">
        {MEAL_META.breakfast.label} · {MEAL_META.lunch.label} ·{' '}
        {MEAL_META.dinner.label} · {MEAL_META.snack.label}
        <span aria-hidden="true"> · </span>
        每一次记录都会自动保存到本机
      </p>
    </div>
  );
}
