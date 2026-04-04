const secondaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-700 tw-transition hover:tw-border-slate-500 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";
const primaryBtnClass = "tw-inline-flex tw-items-center tw-justify-center tw-rounded-xl tw-border tw-border-slate-900 tw-bg-slate-900 tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-transition hover:tw-bg-slate-700 disabled:tw-cursor-not-allowed disabled:tw-opacity-50";

export default function TopicsView({
  grammarLevel,
  levels,
  onSelectLevel,
  search,
  onSearchChange,
  onClearSearch,
  groupedTopics,
  progressById,
  masteryLabel,
  onOpenTopic,
  onStartPractice,
}) {
  return (
    <div className="tw-space-y-4">
      <section className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">Topics</p>
          {grammarLevel ? <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">{grammarLevel}</span> : null}
        </div>
        <div className="tw-mt-3 tw-grid tw-gap-2 sm:tw-grid-cols-[220px_1fr_auto]">
          <select
            className="tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
            value={grammarLevel}
            onChange={(e) => onSelectLevel(e.target.value)}
          >
            <option value="">Все уровни</option>
            {levels.map((level) => (
              <option key={`level-list-${level}`} value={level}>{level}</option>
            ))}
          </select>

          <input
            className="tw-rounded-xl tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-sky-500"
            type="search"
            placeholder="Поиск темы..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          <button type="button" onClick={onClearSearch} className={secondaryBtnClass}>Очистить</button>
        </div>
      </section>

      {!groupedTopics.length ? (
        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-sm tw-text-slate-600">
          Темы не найдены для выбранного фильтра.
        </div>
      ) : (
        groupedTopics.map((groupRow) => (
          <section key={`topic-group-${groupRow.group}`} className="tw-space-y-3">
            <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">{groupRow.title}</p>
            <div className="tw-space-y-4">
              {(groupRow.subgroups || []).map((subgroup) => (
                <div key={`topic-subgroup-${groupRow.group}-${subgroup.key}`} className="tw-space-y-3">
                  {subgroup.title ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-700">{subgroup.title}</p> : null}
                  <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
                    {subgroup.items.map((topic) => {
                      const mastery = Number(progressById[topic.id] && progressById[topic.id].mastery) || 0;
                      return (
                        <article key={`topic-row-${topic.id}`} className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5">
                          <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                            <div>
                              <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{topic.title || topic.id}</p>
                              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{topic.subtitle || topic.hint || "Краткое описание темы"}</p>
                            </div>
                            <span className="tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-700">
                              {masteryLabel(mastery)}
                            </span>
                          </div>

                          <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
                            <button type="button" onClick={() => onOpenTopic(topic.id)} className={primaryBtnClass}>Открыть правило</button>
                            <button type="button" onClick={() => onStartPractice(topic.id)} className={secondaryBtnClass}>Practice</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
