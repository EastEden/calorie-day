import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { FoodEntry, MealType } from '../../domain/types';
import { MEAL_TYPES } from '../../domain/constants';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { AnalysisCard } from './AnalysisCard';
import { AddFoodModal } from './AddFoodModal';
import { CalorieHero } from './CalorieHero';
import { DayToolbar } from './DayToolbar';
import { EntryEditorModal } from './EntryEditorModal';
import { MacroOverview } from './MacroOverview';
import { MealCard } from './MealCard';
import { MealPrepSection } from './MealPrepSection';
import { QuickCoffeeModal } from './QuickCoffeeModal';
import { QuickOilModal } from './QuickOilModal';

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
  const { t } = useI18n();
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
  const [quickCoffeeOpen, setQuickCoffeeOpen] = useState(false);
  const [quickOilMeal, setQuickOilMeal] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<EditingEntry | null>(null);

  useEffect(() => {
    setAddMeal(null);
    setQuickCoffeeOpen(false);
    setQuickOilMeal(null);
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
            <h2>{t('diary.loadErrorTitle')}</h2>
            <p>{logError}</p>
            <p className="inline-error__hint">{t('diary.loadErrorHint')}</p>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={actions.retryLogLoad}
            >
              {t('app.reload')}
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

          <MealPrepSection />

          <section className="meals-section" aria-labelledby="meals-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('meals.eyebrow')}</p>
                <h2 id="meals-title">{t('meals.title')}</h2>
              </div>
              <span className="section-heading__hint">
                {t('diary.recordsCount', { n: summary.entryCount })}
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
                  onQuickAction={(action) => {
                    if (action === 'coffee') {
                      setQuickCoffeeOpen(true);
                    } else {
                      setQuickOilMeal(mealType);
                    }
                  }}
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

      <QuickCoffeeModal
        open={quickCoffeeOpen}
        onClose={() => setQuickCoffeeOpen(false)}
      />

      <QuickOilModal
        open={quickOilMeal !== null}
        mealType={quickOilMeal ?? 'lunch'}
        onClose={() => setQuickOilMeal(null)}
      />

      <EntryEditorModal
        open={editing !== null}
        mealType={editing?.mealType ?? 'breakfast'}
        entry={editing?.entry ?? null}
        onClose={() => setEditing(null)}
      />

      <p className="diary-footnote">{t('diary.footnote')}</p>
    </div>
  );
}
