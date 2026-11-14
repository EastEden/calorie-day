import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CookingPot,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDecimal } from '../../domain/formatters';
import { getFoodDisplayName } from '../../domain/localizedText';
import type { Food } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { BatchPortionModal } from './BatchPortionModal';
import { CreateBatchModal } from './CreateBatchModal';

export function MealPrepSection() {
  const { t, locale } = useI18n();
  const { foods, foodUsage, actions, isSaving } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [recordingBatch, setRecordingBatch] = useState<Food | null>(null);

  const batches = useMemo(
    () => foods.filter((food) => food.batch),
    [foods],
  );
  const activeCount = batches.filter((batch) => {
    if (!batch.batch || batch.batch.disposedAt) {
      return false;
    }
    return (
      Math.max(
        0,
        batch.batch.totalGrams - (foodUsage[batch.id] ?? 0),
      ) > 0.001
    );
  }).length;

  const handleDelete = async (batch: Food) => {
    if (!window.confirm(t('batch.deleteConfirm'))) {
      return;
    }
    try {
      await actions.deleteFood(batch.id);
    } catch {
      // The app-level action already surfaces storage errors as toasts.
    }
  };

  const handleDispose = async (batch: Food) => {
    if (!window.confirm(t('batch.disposeConfirm'))) {
      return;
    }
    try {
      await actions.disposeMealPrepBatch(batch);
    } catch {
      // The app-level action already surfaces storage errors as toasts.
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className="meal-prep-bar"
        onClick={() => setExpanded(true)}
        aria-expanded="false"
      >
        <span className="meal-prep-bar__icon" aria-hidden="true">
          <CookingPot size={17} />
        </span>
        <span className="meal-prep-bar__text">
          <strong>{t('batch.barTitle')}</strong>
          <small>
            {activeCount > 0
              ? t('batch.barActive', { n: activeCount })
              : batches.length > 0
                ? t('batch.barNoActive')
                : t('batch.barEmpty')}
          </small>
        </span>
        <span className="meal-prep-bar__action">
          {t('batch.open')}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <section
      className="meal-prep-section"
      aria-labelledby="meal-prep-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('batch.globalEyebrow')}</p>
          <h2 id="meal-prep-title">{t('batch.title')}</h2>
        </div>
        <div className="meal-prep-section__actions">
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronUp size={15} />}
            onClick={() => setExpanded(false)}
            aria-expanded="true"
          >
            {t('batch.collapse')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => setCreateOpen(true)}
            disabled={isSaving}
          >
            {t('batch.create')}
          </Button>
        </div>
      </div>

      <p className="meal-prep-section__intro">{t('batch.description')}</p>

      {batches.length === 0 ? (
        <p className="meal-prep-section__empty">{t('batch.emptyHint')}</p>
      ) : (
        <div className="meal-prep-list">
          {batches.map((batch) => {
            const meta = batch.batch;
            if (!meta) {
              return null;
            }
            const disposed = Boolean(meta.disposedAt);
            const used = foodUsage[batch.id] ?? 0;
            const remaining = disposed
              ? 0
              : Math.max(0, meta.totalGrams - used);
            const remainingPortions =
              meta.portionGrams > 0
                ? Math.floor(remaining / meta.portionGrams + 0.0001)
                : 0;
            const progress = disposed
              ? 100
              : Math.min(
                  100,
                  Math.max(0, (used / meta.totalGrams) * 100),
                );
            const finished = remaining <= 0.001;

            return (
              <article className="meal-prep-row" key={batch.id}>
                <div className="meal-prep-row__header">
                  <div className="meal-prep-row__title">
                    <strong>{getFoodDisplayName(batch, locale)}</strong>
                    <small>
                      {t('batch.totalDetail', {
                        grams: formatDecimal(meta.totalGrams),
                        portion: formatDecimal(meta.portionGrams),
                      })}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button meal-prep-row__delete"
                    onClick={() => void handleDelete(batch)}
                    aria-label={t('batch.deleteAria', {
                      name: getFoodDisplayName(batch, locale),
                    })}
                    title={t('batch.delete')}
                    disabled={isSaving}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>

                <div className="progress-track meal-prep-row__progress">
                  <span
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="meal-prep-row__footer">
                  <div>
                    <strong>
                      {disposed
                        ? t('batch.disposed')
                        : finished
                          ? t('batch.finished')
                          : t('batch.remaining', {
                              grams: formatDecimal(remaining),
                              portions: remainingPortions,
                            })}
                    </strong>
                  </div>
                  {!finished && !disposed && (
                    <div className="meal-prep-row__actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="meal-prep-row__dispose"
                        onClick={() => void handleDispose(batch)}
                        disabled={isSaving}
                      >
                        {t('batch.dispose')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setRecordingBatch(batch)}
                        disabled={isSaving}
                        aria-label={t('batch.recordAria', {
                          name: getFoodDisplayName(batch, locale),
                        })}
                      >
                        {t('batch.record')}
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CreateBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <BatchPortionModal
        open={recordingBatch !== null}
        batch={recordingBatch}
        onClose={() => setRecordingBatch(null)}
      />
    </section>
  );
}
