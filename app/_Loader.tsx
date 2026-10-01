// The loading indicator Next shows while a page is fetched (app/loading.tsx, app/(app)/loading.tsx):
// three dots in the school's blue, red and yellow, with a small "Loading…" label.
//
// Styles live HERE, not in globals.css, so the component is self-contained. Under
// prefers-reduced-motion the dots fade gently instead of bouncing. role="status" makes a screen
// reader announce "Loading…" once; the dots themselves are decoration and are hidden from it.

export const LOADER_COLOURS = ['#005baa', '#b8292f', '#f2c418'] as const;

const css = `
.ssq-loader { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 40vh; padding: 32px 16px; }
.ssq-loader-dots { display: flex; gap: 8px; }
.ssq-loader-dots span { width: 12px; height: 12px; border-radius: 50%; animation: ssq-bounce 1.1s ease-in-out infinite; }
.ssq-loader-dots span:nth-child(1) { background: ${LOADER_COLOURS[0]}; }
.ssq-loader-dots span:nth-child(2) { background: ${LOADER_COLOURS[1]}; animation-delay: 0.15s; }
.ssq-loader-dots span:nth-child(3) { background: ${LOADER_COLOURS[2]}; animation-delay: 0.3s; }
.ssq-loader-label { font-size: 12.5px; font-weight: 700; color: #5f7793; }
@keyframes ssq-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
@keyframes ssq-fade { 0%, 80%, 100% { opacity: 0.35; } 40% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .ssq-loader-dots span { animation-name: ssq-fade; animation-duration: 1.6s; }
}
`;

export function Loader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="ssq-loader" role="status" aria-live="polite">
      <style>{css}</style>
      <div className="ssq-loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span className="ssq-loader-label">{label}</span>
    </div>
  );
}
