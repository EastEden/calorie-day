import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Save } from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  GOALS,
  SEX_OPTIONS,
} from '../../domain/constants';
import { formatKcal } from '../../domain/formatters';
import { calculateTargets } from '../../domain/targets';
import type {
  ActivityLevel,
  Goal,
  ProfileInput,
  Sex,
} from '../../domain/types';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Button';

interface Errors {
  age?: string;
  height?: string;
  weight?: string;
  form?: string;
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function ProfileForm() {
  const { t } = useI18n();
  const { profile, actions } = useApp();
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [height, setHeight] = useState(
    profile ? String(profile.heightCm) : '',
  );
  const [weight, setWeight] = useState(
    profile ? String(profile.weightKg) : '',
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    profile?.activityLevel ?? 'light',
  );
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'maintain');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setSex(profile.sex);
    setAge(String(profile.age));
    setHeight(String(profile.heightCm));
    setWeight(String(profile.weightKg));
    setActivityLevel(profile.activityLevel);
    setGoal(profile.goal);
  }, [profile]);

  const preview = useMemo(() => {
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

  const handleSave = async () => {
    const ageValue = parseNumber(age);
    const heightValue = parseNumber(height);
    const weightValue = parseNumber(weight);
    const next: Errors = {};

    if (!Number.isFinite(ageValue) || ageValue < 14 || ageValue > 100) {
      next.age = t('profile.ageError');
    }
    if (
      !Number.isFinite(heightValue) ||
      heightValue < 100 ||
      heightValue > 250
    ) {
      next.height = t('profile.heightError');
    }
    if (
      !Number.isFinite(weightValue) ||
      weightValue < 25 ||
      weightValue > 350
    ) {
      next.weight = t('profile.weightError');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    const input: ProfileInput = {
      sex,
      age: ageValue,
      heightCm: heightValue,
      weightKg: weightValue,
      activityLevel,
      goal,
    };

    setSaving(true);
    const ok = await actions.saveProfile(input);
    if (!ok) {
      setErrors({ form: t('profile.saveFailed') });
    }
    setSaving(false);
  };

  return (
    <section className="settings-card" aria-labelledby="profile-settings-title">
      <header className="settings-card__header">
        <div>
          <p className="eyebrow">{t('profile.eyebrow')}</p>
          <h2 id="profile-settings-title">{t('profile.title')}</h2>
          <p>{t('profile.description')}</p>
        </div>
        {preview && (
          <div className="settings-card__metric">
            <span>{t('profile.autoTarget')}</span>
            <strong>
              {formatKcal(preview.target.kcal)} {t('common.kcal')}
            </strong>
          </div>
        )}
      </header>

      <div className="settings-form">
        <div className="field">
          <span className="field-label">{t('profile.sex')}</span>
          <div
            className="segmented segmented--wide"
            role="group"
            aria-label={t('profile.sex')}
          >
            {SEX_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`segmented__option ${
                  sex === option.value ? 'is-active' : ''
                }`}
                aria-pressed={sex === option.value}
                onClick={() => setSex(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row field-row--three">
          <label className="field">
            <span className="field-label">{t('profile.age')}</span>
            <span className="input-with-suffix">
              <input
                type="number"
                inputMode="numeric"
                min={14}
                max={100}
                value={age}
                onChange={(event) => {
                  setAge(event.target.value);
                  setErrors((current) => ({ ...current, age: undefined }));
                }}
              />
              <span>{t('common.ageUnit')}</span>
            </span>
            {errors.age && <span className="field-error">{errors.age}</span>}
          </label>

          <label className="field">
            <span className="field-label">{t('profile.height')}</span>
            <span className="input-with-suffix">
              <input
                type="number"
                inputMode="decimal"
                min={100}
                max={250}
                value={height}
                onChange={(event) => {
                  setHeight(event.target.value);
                  setErrors((current) => ({ ...current, height: undefined }));
                }}
              />
              <span>{t('common.cmUnit')}</span>
            </span>
            {errors.height && (
              <span className="field-error">{errors.height}</span>
            )}
          </label>

          <label className="field">
            <span className="field-label">{t('profile.weight')}</span>
            <span className="input-with-suffix">
              <input
                type="number"
                inputMode="decimal"
                min={25}
                max={350}
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                  setErrors((current) => ({ ...current, weight: undefined }));
                }}
              />
              <span>{t('common.kgUnit')}</span>
            </span>
            {errors.weight && (
              <span className="field-error">{errors.weight}</span>
            )}
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">{t('profile.activity')}</span>
            <select
              value={activityLevel}
              onChange={(event) =>
                setActivityLevel(event.target.value as ActivityLevel)
              }
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {t(level.labelKey)} · {t(level.descriptionKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">{t('profile.goal')}</span>
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal)}
            >
              {GOALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)} · {t(option.descriptionKey)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        <div className="settings-card__actions">
          <p className="field-hint">{t('profile.saveHint')}</p>
          <Button
            icon={<Save size={16} />}
            loading={saving}
            onClick={() => void handleSave()}
          >
            {t('profile.save')}
          </Button>
        </div>
      </div>

      <p className="settings-card__note">
        {t('notes.nutritionReference')}
      </p>
    </section>
  );
}
