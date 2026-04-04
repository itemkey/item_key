function tabClass(active) {
  return [
    "tw-rounded-lg tw-border tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.08em] tw-transition",
    active ? "tw-border-slate-900 tw-bg-slate-900 tw-text-white" : "tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-border-slate-500",
  ].join(" ");
}

export default function TopNav({
  isHomeTab,
  isTopicsTab,
  isPracticeTab,
  onOpenHome,
  onOpenTopics,
  onOpenPractice,
  canOpenPractice,
}) {
  return (
    <nav className="tw-flex tw-flex-wrap tw-gap-2" aria-label="Grammar views">
      <button type="button" onClick={onOpenHome} className={tabClass(!!isHomeTab)}>
        Home
      </button>
      <button type="button" onClick={onOpenTopics} className={tabClass(!!isTopicsTab)}>
        Topics
      </button>
      <button type="button" onClick={onOpenPractice} className={tabClass(!!isPracticeTab)} disabled={!canOpenPractice}>
        Practice
      </button>
    </nav>
  );
}
