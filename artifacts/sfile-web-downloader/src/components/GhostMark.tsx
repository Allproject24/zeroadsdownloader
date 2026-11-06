export default function GhostMark({ size = 60 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="ghost-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfd0d4" />
        </linearGradient>
      </defs>
      <g transform="translate(60 57) scale(1.16) translate(-60 -59)">
        <path
          d="M34 60C34 38 45 24 60 24S86 38 86 60V90Q80.8 98 75.6 90T65.2 90T54.8 90T44.4 90T34 90Z"
          fill="url(#ghost-body)"
        />
        <g fill="#0b0b0c">
          <circle cx="51" cy="48" r="5.4" />
          <circle cx="69" cy="48" r="5.4" />
        </g>
        <g fill="#ffffff">
          <circle cx="52.9" cy="46" r="1.9" />
          <circle cx="70.9" cy="46" r="1.9" />
        </g>
        <path
          d="M57 55.4q3 3.4 6 0"
          fill="none"
          stroke="#0b0b0c"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="60" cy="76" r="12.5" fill="#141416" stroke="#e9e9ec" strokeWidth="1.4" />
        <path
          transform="translate(52.85 68.2) scale(0.65)"
          d="M8 17l4 4 4-4M12 12v9M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M36 66Q36 80 50 80M84 66Q84 80 70 80"
          fill="none"
          stroke="#b9bac0"
          strokeWidth="8.6"
          strokeLinecap="round"
        />
        <path
          d="M36 66Q36 80 50 80M84 66Q84 80 70 80"
          fill="none"
          stroke="#f6f6f8"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
