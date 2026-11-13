import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  GOALS,
  SEX_OPTIONS,
} from '../../domain/constants';
import {
  formatDecimal,
  formatKcal,
} from '../../domain/formatters';
import { calculateTargets } from '../../domain/targets';
import type {
  ActivityLevel,
  Goal,
  ProfileInput,
  Sex,
} from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { BrandMark } from '../../ui/BrandMark';
import { Button } from '../../ui/Button';

interface FormErrors {
  sex?: string;
  age?: string;
  height?: string;
  weight?: string;
  activity?: string;
  goal?: string;
  form?: string;
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function OnboardingPage() {
  const { t } = useI18n();
  const { actions } = useApp();
  const [sex, setSex] = useState<Sex | ''>('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    if (!sex || !activityLevel || !goal) {
      return null;
    }

    const ageValue = parseNumber(age);
    const heightValue = parseNumber(height);
    const weightValue = parseNumber(weight);

    if (
      !Number.isFinite(ageValue) ||
      ageValue < 14 ||
      ageValue > 100 ||
      !Number.isFinite(heightValue) ||
      heightValue < 100 ||
      heightValue > 250 ||
      !Number.isFinite(weightValue) ||
      weightValue < 25 ||
      weightValue > 350
    ) {
      return null;
    }

    return calculateTargets({
      sex,
      age: ageValue,
      heightCm: heightValue,
      weightKg: weightValue,
      activityLevel,
      goal,
      updatedAt: new Date().toISOString(),
    });
  }, [activityLevel, age, goal, height, sex, weight]);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const ageValue = parseNumber(age);
    const heightValue = parseNumber(height);
    const weightValue = parseNumber(weight);

    if (!sex) {
      next.sex = t('onboarding.sexRequired');
    }
    if (!Number.isFinite(ageValue) || ageValue < 14 || ageValue > 100) {
      next.age = t('onboarding.ageError');
    }
    if (
      !Number.isFinite(heightValue) ||
      heightValue < 100 ||
      heightValue > 250
    ) {
      next.height = t('onboarding.heightError');
    }
    if (
      !Number.isFinite(weightValue) ||
      weightValue < 25 ||
      weightValue > 350
    ) {
      next.weight = t('onboarding.weightError');
    }
    if (!activityLevel) {
      next.activity = t('onboarding.activityRequired');
    }
    if (!goal) {
      next.goal = t('onboarding.goalRequired');
    }

    return next;
  };

  const clearError = (key: keyof FormErrors) => {
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!sex || !activityLevel || !goal) {
      return;
    }

    const profile: ProfileInput = {
      sex,
      age: parseNumber(age),
      heightCm: parseNumber(height),
      weightKg: parseNumber(weight),
      activityLevel,
      goal,
    };

    setSubmitting(true);
    const ok = await actions.completeOnboarding(profile);
    if (!ok) {
      setErrors((current) => ({
        ...current,
        form: t('onboarding.saveFailed'),
      }));
    }
    setSubmitting(false);
  };

  return (
    <main className="onboarding">
      <section className="onboarding__visual">
        <div className="onboarding__brand">
          <BrandMark size={42} />
          <div>
            <strong>{t('app.name')}</strong>
            <span>CALORIE DAY</span>
          </div>
        </div>

        <div className="onboarding__copy">
          <p className="onboarding__eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            {t('onboarding.kicker')}
          </p>
          <h1>
            {t('onboarding.headlineLine1')}
            <br />
            {t('onboarding.headlineLine2')}
            <em>{t('onboarding.headlineHighlight')}</em>
          </h1>
          <p>{t('onboarding.intro')}</p>
        </div>

        <div className="onboarding__preview" aria-live="polite">
          <div className="onboarding__preview-top">
            <span>{t('onboarding.previewTitle')}</span>
            <span className="onboarding__preview-chip">
              {preview
                ? t('onboarding.previewReady')
                : t('onboarding.previewPending')}
            </span>
          </div>
          <div className="onboarding__preview-number">
            <strong>
              {preview
                ? formatKcal(preview.target.kcal)
                : t('common.notAvailable')}
            </strong>
            <span>{t('onboarding.previewUnit')}</span>
          </div>
          <div className="onboarding__preview-macros">
            <div>
              <span>{t('common.carbs')}</span>
              <strong>
                {preview
                  ? `${formatDecimal(preview.target.carbsG)}${t(
                      'common.gram',
                    )}`
                  : t('common.notAvailable')}
              </strong>
            </div>
            <div>
              <span>{t('common.protein')}</span>
              <strong>
                {preview
                  ? `${formatDecimal(preview.target.proteinG)}${t(
                      'common.gram',
                    )}`
                  : t('common.notAvailable')}
              </strong>
            </div>
            <div>
              <span>{t('common.fat')}</span>
              <strong>
                {preview
                  ? `${formatDecimal(preview.target.fatG)}${t(
                      'common.gram',
                    )}`
                  : t('common.notAvailable')}
              </strong>
            </div>
          </div>
          {preview && (
            <p className="onboarding__preview-foot">
              {t('onboarding.previewFoot', {
                bmr: formatKcal(preview.bmr),
                tdee: formatKcal(preview.tdee),
              })}
            </p>
          )}
        </div>

        <p className="onboarding__privacy">
          <LockKeyhole size={14} aria-hidden="true" />
          {t('onboarding.privacy')}
        </p>
      </section>

      <section className="onboarding__panel">
        <form className="onboarding-form" onSubmit={handleSubmit} noValidate>
          <header className="onboarding-form__header">
            <p className="eyebrow">{t('onboarding.formEyebrow')}</p>
            <h2>{t('onboarding.formTitle')}</h2>
            <p>{t('onboarding.formDescription')}</p>
          </header>

          <fieldset className="form-section">
            <legend className="form-section__legend">
              <span className="step-dot">01</span>
              {t('onboarding.sectionBasics')}
            </legend>

            <div className="field">
              <span className="field-label">{t('profile.sex')}</span>
              <div
                className="segmented segmented--wide"
                role="group"
                aria-label={t('profile.sex')}
              >
                {SEX_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmented__option ${
                      sex === option.value ? 'is-active' : ''
                    }`}
                    aria-pressed={sex === option.value}
                    onClick={() => {
                      setSex(option.value);
                      clearError('sex');
                    }}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              {errors.sex && <p className="field-error">{errors.sex}</p>}
            </div>

            <div className="field-row field-row--three">
              <label className="field">
                <span className="field-label">{t('onboarding.ageLabel')}</span>
                <span className="input-with-suffix">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={14}
                    max={100}
                    value={age}
                    placeholder="28"
                    onChange={(event) => {
                      setAge(event.target.value);
                      clearError('age');
                    }}
                  />
                  <span>{t('common.ageUnit')}</span>
                </span>
                {errors.age && <span className="field-error">{errors.age}</span>}
              </label>

              <label className="field">
                <span className="field-label">{t('onboarding.heightLabel')}</span>
                <span className="input-with-suffix">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={100}
                    max={250}
                    value={height}
                    placeholder="165"
                    onChange={(event) => {
                      setHeight(event.target.value);
                      clearError('height');
                    }}
                  />
                  <span>{t('common.cmUnit')}</span>
                </span>
                {errors.height && (
                  <span className="field-error">{errors.height}</span>
                )}
              </label>

              <label className="field">
                <span className="field-label">{t('onboarding.weightLabel')}</span>
                <span className="input-with-suffix">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={25}
                    max={350}
                    value={weight}
                    placeholder="58"
                    onChange={(event) => {
                      setWeight(event.target.value);
                      clearError('weight');
                    }}
                  />
                  <span>{t('common.kgUnit')}</span>
                </span>
                {errors.weight && (
                  <span className="field-error">{errors.weight}</span>
                )}
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__legend">
              <span className="step-dot">02</span>
              {t('onboarding.sectionActivity')}
            </legend>
            <div className="option-list">
              {ACTIVITY_LEVELS.map((level) => (
                <button
                  type="button"
                  key={level.value}
                  className={`option-card ${
                    activityLevel === level.value ? 'is-active' : ''
                  }`}
                  aria-pressed={activityLevel === level.value}
                  onClick={() => {
                    setActivityLevel(level.value);
                    clearError('activity');
                  }}
                >
                  <span className="option-card__indicator">
                    {activityLevel === level.value && (
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                    )}
                  </span>
                  <span className="option-card__text">
                    <strong>{t(level.labelKey)}</strong>
                    <small>{t(level.descriptionKey)}</small>
                  </span>
                </button>
              ))}
            </div>
            {errors.activity && (
              <p className="field-error">{errors.activity}</p>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__legend">
              <span className="step-dot">03</span>
              {t('onboarding.sectionGoal')}
            </legend>
            <div className="goal-grid">
              {GOALS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`goal-card ${
                    goal === option.value ? 'is-active' : ''
                  }`}
                  aria-pressed={goal === option.value}
                  onClick={() => {
                    setGoal(option.value);
                    clearError('goal');
                  }}
                >
                  <strong>{t(option.labelKey)}</strong>
                  <small>{t(option.descriptionKey)}</small>
                </button>
              ))}
            </div>
            {errors.goal && <p className="field-error">{errors.goal}</p>}
          </fieldset>

          {errors.form && (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          )}

          <div className="onboarding-form__footer">
            <div className="onboarding-form__summary">
              <span>{t('onboarding.summary')}</span>
              <strong>
                {preview
                  ? `${formatKcal(preview.target.kcal)} ${t('common.kcal')}`
                  : t('onboarding.pendingTarget')}
              </strong>
            </div>
            <Button
              type="submit"
              size="md"
              loading={submitting}
              icon={<ArrowRight size={18} />}
            >
              {t('onboarding.submit')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
