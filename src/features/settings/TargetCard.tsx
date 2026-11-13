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
        setError('请填写有效的目标热量和三大营养素。');
        return;
      }

      setSaving(true);
      const ok = await actions.saveTargetSettings({
        mode: 'manual',
        manual,
      });
      if (!ok) {
        setError('保存失败，请重试。');
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
      setError('保存失败，请重试。');
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
          <p className="eyebrow">每日目标</p>
          <h2 id="target-settings-title">推荐摄入</h2>
          <p>可以跟随身体资料自动计算，也可以完全手动设定。</p>
        </div>
        <span className={`mode-badge mode-badge--${mode}`}>
          {mode === 'auto' ? '自动' : '手动'}
        </span>
      </header>

      <div className="segmented segmented--wide" role="group" aria-label="目标模式">
        <button
          type="button"
          className={`segmented__option ${mode === 'auto' ? 'is-active' : ''}`}
          aria-pressed={mode === 'auto'}
          onClick={() => chooseMode('auto')}
        >
          自动推荐
        </button>
        <button
          type="button"
          className={`segmented__option ${mode === 'manual' ? 'is-active' : ''}`}
          aria-pressed={mode === 'manual'}
          onClick={() => chooseMode('manual')}
        >
          手动设置
        </button>
      </div>

      {mode === 'auto' ? (
        <div className="target-auto">
          <div className="target-hero">
            <div>
              <span>每日热量</span>
              <strong>
                {targets ? formatKcal(targets.kcal) : '—'}
                <small> kcal</small>
              </strong>
            </div>
            <div className="target-hero__macros">
              <span>
                碳水 <strong>{targets ? formatDecimal(targets.carbsG) : '—'}g</strong>
              </span>
              <span>
                蛋白 <strong>{targets ? formatDecimal(targets.proteinG) : '—'}g</strong>
              </span>
              <span>
                脂肪 <strong>{targets ? formatDecimal(targets.fatG) : '—'}g</strong>
              </span>
            </div>
          </div>

          {calculated && (
            <div className="target-breakdown">
              <div>
                <span>基础代谢 BMR</span>
                <strong>{formatKcal(calculated.bmr)} kcal</strong>
              </div>
              <div>
                <span>日常消耗 TDEE</span>
                <strong>{formatKcal(calculated.tdee)} kcal</strong>
              </div>
              <div>
                <span>活动与目标</span>
                <strong>
                  {activity?.label ?? '—'} · {goal?.label ?? '—'}
                </strong>
              </div>
            </div>
          )}

          <p className="field-hint">
            热量目标 = TDEE × 目标系数；蛋白质按活动量 1.0–1.8g/kg（当前{' '}
            {formatDecimal(activity?.proteinFactor ?? 1.2)}g/kg），脂肪占 25%
            热量，碳水补足剩余。
          </p>
        </div>
      ) : (
        <div className="manual-target-form">
          <label className="field">
            <span className="field-label">每日热量</span>
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
              <span>kcal</span>
            </span>
          </label>

          <div className="field-row field-row--three">
            <label className="field">
              <span className="field-label">碳水</span>
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
                <span>g</span>
              </span>
            </label>
            <label className="field">
              <span className="field-label">蛋白质</span>
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
                <span>g</span>
              </span>
            </label>
            <label className="field">
              <span className="field-label">脂肪</span>
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
                <span>g</span>
              </span>
            </label>
          </div>

          <p className="field-hint">
            手动目标会覆盖自动推荐。需要重新计算时，切回“自动推荐”即可。
          </p>
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
            ? '自动目标会随个人资料更新。'
            : '手动目标会保持不变，直到你再次修改。'}
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
          {mode === 'auto' ? '恢复自动推荐' : '保存手动目标'}
        </Button>
      </div>
    </section>
  );
}
