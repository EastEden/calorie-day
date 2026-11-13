import { describe, expect, it } from 'vitest';
import { calculateTargets, resolveTargets } from '../../domain/targets';
import type {
  ActivityLevel,
  TargetSettings,
  UserProfile,
} from '../../domain/types';

const baseProfile: UserProfile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  goal: 'maintain',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const autoSettings: TargetSettings = {
  mode: 'auto',
  manual: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('targets', () => {
  it('calculates BMR and TDEE with Mifflin-St Jeor', () => {
    const result = calculateTargets(baseProfile);
    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2759);
  });

  it('calculates calories and macros using the activity-based defaults', () => {
    const result = calculateTargets(baseProfile);
    expect(result.target).toEqual({
      kcal: 2760,
      proteinG: 112,
      carbsG: 405,
      fatG: 77,
    });
  });

  it('scales protein from 1.0 to 1.8 g/kg by activity level', () => {
    const cases: Array<[ActivityLevel, number]> = [
      ['sedentary', 80],
      ['light', 96],
      ['moderate', 112],
      ['active', 128],
      ['very_active', 144],
    ];

    for (const [activityLevel, expectedProtein] of cases) {
      const result = calculateTargets({
        ...baseProfile,
        activityLevel,
      });
      expect(result.target.proteinG).toBe(expectedProtein);
    }
  });

  it('applies the fat loss and muscle gain goal factors', () => {
    const loss = calculateTargets({ ...baseProfile, goal: 'lose' });
    const gain = calculateTargets({ ...baseProfile, goal: 'gain' });

    expect(loss.target.kcal).toBe(2350);
    expect(gain.target.kcal).toBe(3030);
  });

  it('uses a manual target when configured', () => {
    const manual = { kcal: 2000, proteinG: 150, carbsG: 180, fatG: 60 };
    expect(
      resolveTargets(baseProfile, {
        mode: 'manual',
        manual,
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual(manual);
  });

  it('falls back to automatic targets when manual values are missing', () => {
    const target = resolveTargets(baseProfile, {
      mode: 'manual',
      manual: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(target).toEqual(calculateTargets(baseProfile).target);
  });

  it('returns null when no profile and no manual target exists', () => {
    expect(resolveTargets(null, autoSettings)).toBeNull();
  });
});
