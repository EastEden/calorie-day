export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="每日热量"
    >
      <rect width="64" height="64" rx="18" fill="#2f5d45" />
      <path
        d="M33 13c2 10-8 13-8 22 0 5 4 9 9 9 6 0 10-4 10-10 0-9-8-12-11-21Z"
        fill="#f2b36b"
      />
      <path
        d="M31 30c5 2 8 6 8 11 0 5-3 8-8 8-4 0-7-3-7-7 0-4 3-7 7-12Z"
        fill="#fffaf0"
        opacity="0.9"
      />
    </svg>
  );
}
