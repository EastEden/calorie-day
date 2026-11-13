interface ProgressBarProps {
  value: number;
  target: number;
  color: string;
  ariaLabel?: string;
  className?: string;
  size?: 'default' | 'large';
}

export function ProgressBar({
  value,
  target,
  color,
  ariaLabel,
  className = '',
  size = 'default',
}: ProgressBarProps) {
  const percent =
    target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;

  return (
    <div
      className={`progress-track progress-track--${size} ${className}`.trim()}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(target)}
      aria-valuenow={Math.round(value)}
    >
      <span
        className="progress-fill"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  );
}
