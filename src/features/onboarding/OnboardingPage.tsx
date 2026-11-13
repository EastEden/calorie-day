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
      next.sex = '请选择生理性别，用于计算基础代谢。';
    }
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
    if (!activityLevel) {
      next.activity = '请选择最接近你日常状态的活动水平。';
    }
    if (!goal) {
      next.goal = '请选择当前阶段的目标。';
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
        form: '保存失败，请确认浏览器允许本地存储后再试。',
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
            <strong>每日热量</strong>
            <span>CALORIE DAY</span>
          </div>
        </div>

        <div className="onboarding__copy">
          <p className="onboarding__eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            从今天开始，吃得更明白
          </p>
          <h1>
            把每一餐，
            <br />
            变成看得见的
            <em>进步。</em>
          </h1>
          <p>
            记录早餐、午餐、晚餐和加餐，了解热量与三大营养素。
            根据你的身体资料，生成一份真正属于你的每日目标。
          </p>
        </div>

        <div className="onboarding__preview" aria-live="polite">
          <div className="onboarding__preview-top">
            <span>你的每日推荐</span>
            <span className="onboarding__preview-chip">
              {preview ? '已可预览' : '待完善资料'}
            </span>
          </div>
          <div className="onboarding__preview-number">
            <strong>{preview ? formatKcal(preview.target.kcal) : '—'}</strong>
            <span>kcal / 天</span>
          </div>
          <div className="onboarding__preview-macros">
            <div>
              <span>碳水</span>
              <strong>
                {preview ? `${formatDecimal(preview.target.carbsG)}g` : '—'}
              </strong>
            </div>
            <div>
              <span>蛋白质</span>
              <strong>
                {preview ? `${formatDecimal(preview.target.proteinG)}g` : '—'}
              </strong>
            </div>
            <div>
              <span>脂肪</span>
              <strong>
                {preview ? `${formatDecimal(preview.target.fatG)}g` : '—'}
              </strong>
            </div>
          </div>
          {preview && (
            <p className="onboarding__preview-foot">
              基础代谢约 {formatKcal(preview.bmr)} kcal · 日常消耗约{' '}
              {formatKcal(preview.tdee)} kcal
            </p>
          )}
        </div>

        <p className="onboarding__privacy">
          <LockKeyhole size={14} aria-hidden="true" />
          资料只保存在这台设备的浏览器中，不会上传。
        </p>
      </section>

      <section className="onboarding__panel">
        <form className="onboarding-form" onSubmit={handleSubmit} noValidate>
          <header className="onboarding-form__header">
            <p className="eyebrow">只需几步</p>
            <h2>先认识一下你</h2>
            <p>我们会用这些资料估算每日消耗与推荐摄入量，之后可以随时修改。</p>
          </header>

          <fieldset className="form-section">
            <legend className="form-section__legend">
              <span className="step-dot">01</span>
              基础资料
            </legend>

            <div className="field">
              <span className="field-label">生理性别</span>
              <div className="segmented segmented--wide" role="group" aria-label="生理性别">
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
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.sex && <p className="field-error">{errors.sex}</p>}
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
                    placeholder="28"
                    onChange={(event) => {
                      setAge(event.target.value);
                      clearError('age');
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
                    placeholder="165"
                    onChange={(event) => {
                      setHeight(event.target.value);
                      clearError('height');
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
                    placeholder="58"
                    onChange={(event) => {
                      setWeight(event.target.value);
                      clearError('weight');
                    }}
                  />
                  <span>kg</span>
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
              日常活动
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
                    <strong>{level.label}</strong>
                    <small>{level.description}</small>
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
              当前目标
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
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
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
              <span>每日推荐</span>
              <strong>
                {preview ? `${formatKcal(preview.target.kcal)} kcal` : '待生成'}
              </strong>
            </div>
            <Button
              type="submit"
              size="md"
              loading={submitting}
              icon={<ArrowRight size={18} />}
            >
              生成目标，开始记录
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
