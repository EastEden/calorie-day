import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Save } from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  GOALS,
  NUTRITION_REFERENCE_NOTE,
  SEX_OPTIONS,
} from '../../domain/constants';
import {
  formatKcal,
} from '../../domain/formatters';
import { calculateTargets } from '../../domain/targets';
import type {
  ActivityLevel,
  Goal,
  ProfileInput,
  Sex,
} from '../../domain/types';
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
      next.age = '请输入 14–100 之间的年龄。';
    }
    if (
      !Number.isFinite(heightValue) ||
      heightValue < 100 ||
      heightValue > 250
    ) {
      next.height = '请输入 100–250 cm 之间的身高。';
    }
    if (
      !Number.isFinite(weightValue) ||
      weightValue < 25 ||
      weightValue > 350
    ) {
      next.weight = '请输入 25–350 kg 之间的体重。';
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
      setErrors({ form: '保存失败，请稍后重试。' });
    }
    setSaving(false);
  };

  return (
    <section className="settings-card" aria-labelledby="profile-settings-title">
      <header className="settings-card__header">
        <div>
          <p className="eyebrow">身体资料</p>
          <h2 id="profile-settings-title">关于你</h2>
          <p>资料只保存在本机，用于计算推荐热量与三大营养素。</p>
        </div>
        {preview && (
          <div className="settings-card__metric">
            <span>自动推荐</span>
            <strong>{formatKcal(preview.target.kcal)} kcal</strong>
          </div>
        )}
      </header>

      <div className="settings-form">
        <div className="field">
          <span className="field-label">生理性别</span>
          <div className="segmented segmented--wide" role="group" aria-label="生理性别">
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
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row field-row--three">
          <label className="field">
            <span className="field-label">年龄</span>
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
              <span>岁</span>
            </span>
            {errors.age && <span className="field-error">{errors.age}</span>}
          </label>

          <label className="field">
            <span className="field-label">身高</span>
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
              <span>cm</span>
            </span>
            {errors.height && (
              <span className="field-error">{errors.height}</span>
            )}
          </label>

          <label className="field">
            <span className="field-label">体重</span>
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
              <span>kg</span>
            </span>
            {errors.weight && (
              <span className="field-error">{errors.weight}</span>
            )}
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">日常活动</span>
            <select
              value={activityLevel}
              onChange={(event) =>
                setActivityLevel(event.target.value as ActivityLevel)
              }
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} · {level.description}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">当前目标</span>
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal)}
            >
              {GOALS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
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
          <p className="field-hint">
            保存资料后，自动推荐目标会立即更新；手动目标不受影响。
          </p>
          <Button
            icon={<Save size={16} />}
            loading={saving}
            onClick={() => void handleSave()}
          >
            保存资料
          </Button>
        </div>
      </div>

      <p className="settings-card__note">{NUTRITION_REFERENCE_NOTE}</p>
    </section>
  );
}
