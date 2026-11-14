import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CookingPot,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDecimal } from '../../domain/formatters';
import {
  getFoodDisplayName,
  resolveLocalizedText,
} from '../../domain/localizedText';
import type { Food } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/ToastProvider';
import { BatchPortionModal } from './BatchPortionModal';
import { CreateBatchModal } from './CreateBatchModal';

export function MealPrepSection() {
  const { t, locale } = useI18n();
  const { showToast } = useToast();
  const { foods, foodUsage, actions, isSaving } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [recordingBatch, setRecordingBatch] = useState<Food | null>(null);
  const [confirmDisposeId, setConfirmDisposeId] = useState<string | null>(
    null,
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(
    null,
  );

  const batches = useMemo(
    () => foods.filter((food) => food.batch),
    [foods],
  );
  const activeBatches = batches.filter((batch) => {
    if (!batch.batch || batch.batch.disposedAt) {
      return false;
    }
    return (
      Math.max(
        0,
        batch.batch.totalGrams - (foodUsage[batch.id] ?? 0),
      ) > 0.001
    );
  });
  const activeCount = activeBatches.length;

  const handleDelete = async (batch: Food) => {
    try {
      await actions.deleteFood(batch.id);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('batch.deleteError'),
        'error',
      );
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleDispose = async (batch: Food) => {
    try {
      await actions.disposeMealPrepBatch(batch);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t('batch.disposeError'),
        'error',
      );
    } finally {
      setConfirmDisposeId(null);
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

      {activeBatches.length === 0 ? (
        <p className="meal-prep-section__empty">{t('batch.emptyHint')}</p>
      ) : (
        <div className="meal-prep-list">
          {activeBatches.map((batch) => {
            const meta = batch.batch;
            if (!meta) {
              return null;
            }
            const used = foodUsage[batch.id] ?? 0;
            const remaining = Math.max(0, meta.totalGrams - used);
            const remainingPortions =
              meta.portionGrams > 0
                ? Math.floor(remaining / meta.portionGrams + 0.0001)
                : 0;
            const portions =
              meta.portions ??
              Math.max(1, Math.round(meta.totalGrams / meta.portionGrams));
            const componentText = meta.components
              ?.map(
                (component) =>
                  `${resolveLocalizedText(component.names, locale)} ${formatDecimal(
                    component.totalGrams,
                  )}g`,
              )
              .join(' · ');

            return (
              <article className="meal-prep-row" key={batch.id}>
                <div className="meal-prep-row__header">
                  <div className="meal-prep-row__title">
                    <strong>{getFoodDisplayName(batch, locale)}</strong>
                    <small>
                      {t('batch.totalDetail', {
                        grams: formatDecimal(meta.totalGrams),
                        portions,
                      })}
                    </small>
                    {componentText && (
                      <small className="meal-prep-row__components">
                        {componentText}
                      </small>
                    )}
                  </div>
                  {confirmDeleteId === batch.id ? (
                    <div className="meal-prep-row__delete-confirm">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(batch)}
                        disabled={isSaving}
                        title={t('batch.deleteConfirm')}
                      >
                        {t('batch.deleteConfirmAction')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={isSaving}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-button meal-prep-row__delete"
                      onClick={() => {
                        setConfirmDisposeId(null);
                        setConfirmDeleteId(batch.id);
                      }}
                      aria-label={t('batch.deleteAria', {
                        name: getFoodDisplayName(batch, locale),
                      })}
                      title={t('batch.delete')}
                      disabled={isSaving}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="meal-prep-row__footer">
                  <div>
                    <strong>
                      {t('batch.remaining', {
                        grams: formatDecimal(remaining),
                        portions: remainingPortions,
                      })}
                    </strong>
                  </div>
                  <div className="meal-prep-row__actions">
                      {confirmDisposeId === batch.id ? (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDispose(batch)}
                            disabled={isSaving}
                            title={t('batch.disposeConfirm')}
                          >
                            {t('batch.disposeConfirmAction')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDisposeId(null)}
                            disabled={isSaving}
                          >
                            {t('common.cancel')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="meal-prep-row__dispose"
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setConfirmDisposeId(batch.id);
                          }}
                          disabled={isSaving}
                        >
                          {t('batch.dispose')}
                        </Button>
                      )}
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
