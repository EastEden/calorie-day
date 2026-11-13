import {
  useEffect,
  useState,
} from 'react';
import { Trash2 } from 'lucide-react';
import type { FoodEntry, MealType } from '../../domain/types';
import { MEAL_META } from '../../domain/constants';
import { formatKcal } from '../../domain/formatters';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { PortionForm, type PortionInitial } from './PortionForm';

interface EntryEditorModalProps {
  open: boolean;
  mealType: MealType;
  entry: FoodEntry | null;
  onClose: () => void;
}

export function EntryEditorModal({
  open,
  mealType,
  entry,
  onClose,
}: EntryEditorModalProps) {
  const { t } = useI18n();
  const { actions, isSaving } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmDelete(false);
      setDeleting(false);
      setDeleteError(null);
    }
  }, [open, entry?.id]);

  if (!entry) {
    return null;
  }

  const initial: PortionInitial = {
    enteredQuantity: entry.enteredQuantity,
    enteredUnit: entry.enteredUnit,
    servingLabel: entry.servingLabel,
    servingGrams: entry.servingGrams,
  };

  const servings =
    entry.enteredUnit === 'serving' &&
    entry.servingLabel &&
    entry.servingGrams
      ? [
          {
            id: 'entry-current-serving',
            label: entry.servingLabel,
            grams: entry.servingGrams,
          },
        ]
      : [];

  const handleClose = () => {
    if (!isSaving && !deleting) {
      onClose();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const ok = await actions.deleteEntry(mealType, entry.id);
      if (ok) {
        onClose();
      } else {
        setDeleteError(t('entry.deleteFailed'));
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : t('entry.deleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('entry.title')}
      description={t('entry.description', {
        meal: t(MEAL_META[mealType].labelKey),
        name: entry.foodName,
        kcal: formatKcal(
          (entry.nutritionPer100gSnapshot.kcal * entry.amountGrams) / 100,
        ),
      })}
    >
      <PortionForm
        key={entry.id}
        nutritionPer100g={entry.nutritionPer100gSnapshot}
        servings={servings}
        initial={initial}
        submitLabel={t('portion.submit')}
        disabled={isSaving || deleting}
        onSubmit={async (amount) => {
          const ok = await actions.updateEntry(mealType, entry.id, amount);
          if (ok) {
            onClose();
          }
          return ok;
        }}
        secondaryAction={
          <div className="entry-delete-zone">
            {!confirmDelete ? (
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving || deleting}
              >
                <Trash2 size={15} aria-hidden="true" />
                {t('entry.delete')}
              </button>
            ) : (
              <div className="delete-confirm">
                <p>{t('entry.deleteConfirm')}</p>
                {deleteError && (
                  <p className="form-error" role="alert">
                    {deleteError}
                  </p>
                )}
                <div className="delete-confirm__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {t('entry.confirmDelete')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        }
      />
    </Modal>
  );
}
