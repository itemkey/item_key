import RuleBlocksRenderer from "./RuleBlocksRenderer";

const secondaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-700 tw-transition hover:tw-border-slate-500 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";
const primaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-900 tw-bg-slate-900 tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-transition hover:tw-bg-slate-700 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";

export default function RuleView({
  selectedMeta,
  selectedProgress,
  formulaLines,
  markerLines,
  explanationLines,
  exampleItems,
  compareItems,
  compareNote,
  selectedDoc,
  shownRuleBlocks,
  ruleViewMode,
  onRuleViewModeChange,
  onBackToTopics,
  onStartPractice,
  onOpenTopic,
  masteryLabel,
}) {
  if (!selectedMeta) {
    return (
      <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">
        Выберите тему на вкладке Topics.
      </div>
    );
  }

  return (
    <div className="tw-space-y-4">
      <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
        <button type="button" onClick={onBackToTopics} className={secondaryBtnClass}>Назад к темам</button>
        <div className="tw-inline-flex tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white">
          <button
            type="button"
            onClick={() => onRuleViewModeChange("tag-rule")}
            className={[
              "tw-inline-flex tw-items-center tw-justify-center tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-transition",
              ruleViewMode === "tag-rule"
                ? "tw-bg-slate-900 tw-text-white"
                : "tw-bg-white tw-text-slate-700 hover:tw-bg-slate-100",
            ].join(" ")}
          >
            tag-rule
          </button>
          <button
            type="button"
            onClick={() => onRuleViewModeChange("full-rule")}
            className={[
              "tw-inline-flex tw-items-center tw-justify-center tw-border-l tw-border-slate-300 tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-transition",
              ruleViewMode === "full-rule"
                ? "tw-bg-slate-900 tw-text-white"
                : "tw-bg-white tw-text-slate-700 hover:tw-bg-slate-100",
            ].join(" ")}
          >
            full-rule
          </button>
        </div>
      </div>

      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
        <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-2">
          <div>
            <p className="tw-m-0 tw-text-xl tw-font-semibold tw-text-slate-900">{selectedMeta.title || selectedMeta.id}</p>
            <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-600">{String(selectedMeta.subtitle || selectedMeta.hint || "").trim() || "Короткое объяснение темы."}</p>
          </div>
          {selectedProgress ? (
            <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{masteryLabel(selectedProgress.mastery)}</span>
          ) : null}
        </div>
      </section>

      <div className="tw-grid tw-gap-3 md:tw-grid-cols-2">
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Формула</p>
          {formulaLines.length ? (
            <ul className="tw-m-0 tw-mt-2 tw-list-disc tw-space-y-1.5 tw-pl-5 tw-text-sm tw-text-slate-700">
              {formulaLines.map((line, idx) => <li key={`formula-${idx}`}>{line}</li>)}
            </ul>
          ) : (
            <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-500">Формула не указана.</p>
          )}
        </section>

        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Ключевые маркеры</p>
          {markerLines.length ? (
            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">
              {markerLines.map((line, idx) => (
                <span key={`marker-${idx}`} className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{line}</span>
              ))}
            </div>
          ) : (
            <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-500">Маркеров для этой темы пока нет.</p>
          )}
        </section>
      </div>

      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
        <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Кратко о правиле</p>
        <div className="tw-mt-2 tw-space-y-2">
          {explanationLines.map((line, idx) => (
            <p key={`explain-${idx}`} className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-slate-700">{line}</p>
          ))}
        </div>
      </section>

      {exampleItems.length ? (
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Примеры</p>
          <ul className="tw-m-0 tw-mt-3 tw-list-none tw-space-y-2 tw-p-0">
            {exampleItems.map((item, idx) => (
              <li key={`example-${idx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3">
                <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-900">{item.en}</p>
                <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{item.ru}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareItems.length || compareNote ? (
        <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Сравнение и близкие темы</p>
          {compareNote ? <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-700">{compareNote}</p> : null}
          {compareItems.length ? (
            <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-2">
              {compareItems.map((item, idx) => (
                <button
                  key={`compare-item-${idx}`}
                  type="button"
                  onClick={() => {
                    if (!item.id) return;
                    onOpenTopic(item.id);
                  }}
                  disabled={!item.id}
                  className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3 tw-text-left tw-transition enabled:hover:tw-border-slate-400 disabled:tw-opacity-60"
                >
                  <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{item.label || "Тема"}</p>
                  {item.note ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{item.note}</p> : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <button type="button" onClick={onStartPractice} className={primaryBtnClass}>Practice this rule</button>
          <button type="button" onClick={onBackToTopics} className={secondaryBtnClass}>Back to Topics</button>
        </div>
      </section>

      {!selectedDoc ? (
        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">Загрузка полного материала...</div>
      ) : (
        <section className="tw-space-y-3">
          <RuleBlocksRenderer blocks={shownRuleBlocks} onOpenTopic={onOpenTopic} />
        </section>
      )}
    </div>
  );
}
