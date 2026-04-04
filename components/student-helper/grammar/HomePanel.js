function levelClass(active) {
  return [
    "tw-rounded-lg tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.06em] tw-transition",
    active ? "tw-border-slate-900 tw-bg-slate-900 tw-text-white" : "tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-border-slate-500",
  ].join(" ");
}

export default function HomePanel({ grammarLevel, levels, onSelectLevel, onOpenConstructor, onOpenCompare, onOpenToday }) {
  return (
    <div className="tw-space-y-4">
      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
        <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Выберите уровень</p>
        <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
          <button type="button" onClick={() => onSelectLevel("")} className={levelClass(!grammarLevel)}>
            Все
          </button>
          {levels.map((level) => (
            <button key={`level-home-${level}`} type="button" onClick={() => onSelectLevel(level)} className={levelClass(grammarLevel === level)}>
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="tw-grid tw-gap-3 md:tw-grid-cols-3">
        <button
          type="button"
          onClick={onOpenConstructor}
          className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
        >
          <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Конструктор</p>
          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Пошагово подобрать нужное правило.</p>
        </button>
        <button
          type="button"
          onClick={onOpenCompare}
          className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
        >
          <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Сравнить</p>
          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Аккуратно увидеть разницу между темами.</p>
        </button>
        <button
          type="button"
          onClick={onOpenToday}
          className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-transition hover:tw-border-slate-400"
        >
          <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">На сегодня</p>
          <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">Короткая ежедневная мини-сессия.</p>
        </button>
      </section>
    </div>
  );
}
