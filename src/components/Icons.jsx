// Small inline icons. They inherit the current text color.

export function LockIcon(props) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={props.size || 14}
      height={props.size || 14}
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      {props.open ? (
        <path d="M7 9V6.5a3 3 0 0 1 5.8-1" stroke-linecap="round" />
      ) : (
        <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
      )}
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={props.size || 14}
      height={props.size || 14}
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
