import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  GOALS,
} from '../../domain/constants';
import {
  formatDecimal,
  formatKcal,
} from '../../domain/formatters';
import { calculateTargets } from '../../domain/targets';
import type { Nutrition } from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';

interface TargetFormState {
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

function toForm(target: Nutrition): TargetFormState {
  return {
    kcal: String(target.kcal),
    proteinG: String(target.proteinG),
    carbsG: String(target.carbsG),
    fatG: String(target.fatG),
  };
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function TargetCard() {
  const { t } = useI18n();
  const { profile, targets, targetSettings, actions } = useApp();
  const [mode, setMode] = useState(targetSettings.mode);
  const [form, setForm] = useState<TargetFormState>(
    toForm(targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculated = useMemo(
    () => (profile ? calculateTargets(profile) : null),
    [profile],
  );

  useEffect(() => {
    setMode(targetSettings.mode);
    const manualSource =
      targetSettings.manual ??
      targets ??
      ({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } satisfies Nutrition);
    setForm(toForm(manualSource));
  }, [targetSettings, targets]);

  const chooseMode = (nextMode: 'auto' | 'manual') => {
    setMode(nextMode);
    setError(null);
    if (nextMode === 'manual') {
      const source =
        targetSettings.manual ??
        targets ??
        ({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } satisfies Nutrition);
      setForm(toForm(source));
    }
  };

  const handleSave = async () => {
    setError(null);

    if (mode === 'manual') {
      const manual: Nutrition = {
        kcal: parseNumber(form.kcal),
        proteinG: parseNumber(form.proteinG),
        carbsG: parseNumber(form.carbsG),
        fatG: parseNumber(form.fatG),
      };

      if (
        !Number.isFinite(manual.kcal) ||
        manual.kcal <= 0 ||
        !Number.isFinite(manual.proteinG) ||
        manual.proteinG < 0 ||
        !Number.isFinite(manual.carbsG) ||
        manual.carbsG < 0 ||
        !Number.isFinite(manual.fatG) ||
        manual.fatG < 0
      ) {
        setError(t('target.invalid'));
        return;
      }

      setSaving(true);
      const ok = await actions.saveTargetSettings({
        mode: 'manual',
        manual,
      });
      if (!ok) {
        setError(t('target.saveFailed'));
      }
      setSaving(false);
      return;
    }

    setSaving(true);
    const ok = await actions.saveTargetSettings({
      mode: 'auto',
      manual: targetSettings.manual,
    });
    if (!ok) {
      setError(t('target.saveFailed'));
    }
    setSaving(false);
  };

  const activity = profile
    ? ACTIVITY_LEVELS.find((item) => item.value === profile.activityLevel)
    : undefined;
  const goal = profile
    ? GOALS.find((item) => item.value === profile.goal)
    : undefined;

  return (
    <section className="settings-card" aria-labelledby="target-settings-title">
      <header className="settings-card__header">
        <div>
          <p className="eyebrow">{t('target.eyebrow')}</p>
          <h2 id="target-settings-title">{t('target.title')}</h2>
          <p>{t('target.description')}</p>
        </div>
        <span className={`mode-badge mode-badge--${mode}`}>
          {mode === 'auto'
            ? t('target.autoBadge')
            : t('target.manualBadge')}
        </span>
      </header>

      <div
        className="segmented segmented--wide"
        role="group"
        aria-label={t('target.modeAria')}
      >
        <button
          type="button"
          className={`segmented__option ${mode === 'auto' ? 'is-active' : ''}`}
          aria-pressed={mode === 'auto'}
          onClick={() => chooseMode('auto')}
        >
          {t('target.modeAuto')}
        </button>
        <button
          type="button"
          className={`segmented__option ${
            mode === 'manual' ? 'is-active' : ''
          }`}
          aria-pressed={mode === 'manual'}
          onClick={() => chooseMode('manual')}
        >
          {t('target.modeManual')}
        </button>
      </div>

      {mode === 'auto' ? (
        <div className="target-auto">
          <div className="target-hero">
            <div>
              <span>{t('target.dailyCalories')}</span>
              <strong>
                {targets
                  ? formatKcal(targets.kcal)
                  : t('common.notAvailable')}
                <small> {t('common.kcal')}</small>
              </strong>
            </div>
            <div className="target-hero__macros">
              <span>
                {t('common.carbs')}{' '}
                <strong>
                  {targets
                    ? `${formatDecimal(targets.carbsG)}${t('common.gram')}`
                    : t('common.notAvailable')}
                </strong>
              </span>
              <span>
                {t('common.proteinShort')}{' '}
                <strong>
                  {targets
                    ? `${formatDecimal(targets.proteinG)}${t('common.gram')}`
                    : t('common.notAvailable')}
                </strong>
              </span>
              <span>
                {t('common.fat')}{' '}
                <strong>
                  {targets
                    ? `${formatDecimal(targets.fatG)}${t('common.gram')}`
                    : t('common.notAvailable')}
                </strong>
              </span>
            </div>
          </div>

          {calculated && (
            <div className="target-breakdown">
              <div>
                <span>{t('target.bmr')}</span>
                <strong>
                  {formatKcal(calculated.bmr)} {t('common.kcal')}
                </strong>
              </div>
              <div>
                <span>{t('target.tdee')}</span>
                <strong>
                  {formatKcal(calculated.tdee)} {t('common.kcal')}
                </strong>
              </div>
              <div>
                <span>{t('target.activityAndGoal')}</span>
                <strong>
                  {activity ? t(activity.labelKey) : t('common.notAvailable')}{' '}
                  · {goal ? t(goal.labelKey) : t('common.notAvailable')}
                </strong>
              </div>
            </div>
          )}

          <p className="field-hint">
            {t('target.formula', {
              factor: formatDecimal(activity?.proteinFactor ?? 1.2),
            })}
          </p>
        </div>
      ) : (
        <div className="manual-target-form">
          <label className="field">
            <span className="field-label">{t('target.caloriesField')}</span>
            <span className="input-with-suffix">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={form.kcal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, kcal: event.target.value }))
                }
              />
              <span>{t('common.kcal')}</span>
            </span>
          </label>

          <div className="field-row field-row--three">
            <label className="field">
              <span className="field-label">{t('target.carbs')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.carbsG}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      carbsG: event.target.value,
                    }))
                  }
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
            <label className="field">
              <span className="field-label">{t('target.protein')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.proteinG}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      proteinG: event.target.value,
                    }))
                  }
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
            <label className="field">
              <span className="field-label">{t('target.fat')}</span>
              <span className="input-with-suffix">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.fatG}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fatG: event.target.value,
                    }))
                  }
                />
                <span>{t('common.gram')}</span>
              </span>
            </label>
          </div>

          <p className="field-hint">{t('target.manualHint')}</p>
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-card__actions">
        <p className="field-hint">
          {mode === 'auto'
            ? t('target.autoHint')
            : t('target.manualNote')}
        </p>
        <Button
          variant={mode === 'auto' ? 'secondary' : 'primary'}
          icon={
            mode === 'auto' && targetSettings.mode === 'manual' ? (
              <RefreshCw size={16} />
            ) : (
              <Save size={16} />
            )
          }
          loading={saving}
          disabled={mode === 'auto' && targetSettings.mode === 'auto'}
          onClick={() => void handleSave()}
        >
          {mode === 'auto'
            ? t('target.restoreAuto')
            : t('target.saveManual')}
        </Button>
      </div>
    </section>
  );
}
