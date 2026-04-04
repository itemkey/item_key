const monoCard = "tw-border tw-border-slate-900 tw-bg-white tw-p-4";
const monoBtn = "tw-inline-flex tw-items-center tw-justify-center tw-border tw-border-slate-900 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-slate-900 tw-transition hover:tw-bg-slate-100 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed";
const monoBtnDark = "tw-inline-flex tw-items-center tw-justify-center tw-border tw-border-slate-900 tw-bg-slate-900 tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-transition hover:tw-bg-slate-700 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed";

function modeTabClass(active) {
  return [
    "tw-border tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-transition",
    active ? "tw-border-slate-900 tw-bg-slate-900 tw-text-white" : "tw-border-slate-900 tw-bg-white tw-text-slate-900 hover:tw-bg-slate-100",
  ].join(" ");
}

export default function PracticeView({
  stage,
  onBackHome,
  onBackToSetup,
  mode,
  onModeChange,
  goal,
  goalOptions,
  onGoalChange,
  showTopicPicker,
  onToggleTopicPicker,
  customScopeIds,
  customScopeTotal,
  customPickerGroups,
  onToggleCustomTopic,
  onClearCustomScope,
  scopeMistakesCount,
  onStartMixed,
  onStartCustom,
  onStartScopeMistakes,
  onClearScopeMistakes,
  onResetScopeProgress,
  showAnswersAfterEach,
  onToggleShowAnswers,
  practiceStats,
  selectedId,
  selectedDoc,
  queue,
  practiceMistakesMode,
  practiceHeading,
  cursor,
  liveScore,
  answeredCount,
  practiceProgressPercent,
  current,
  practiceInputNode,
  checked,
  resultState,
  done,
  canCheckCurrent,
  onCheckCurrent,
  onNextCurrent,
  onRestartPractice,
  onBackToTopics,
  onRepeatTopicMistakes,
  selectedMeta,
  selectedMistakesCount,
}) {
  if (stage !== "run") {
    const customChosen = customScopeIds.length;
    const customStartDisabled = mode === "custom" && customChosen === 0;

    return (
      <div className="tw-space-y-4">
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <button type="button" onClick={onBackHome} className={monoBtn}>Назад</button>
          <div className="tw-border tw-border-slate-900 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-800">
            Заданий: {Number(practiceStats && practiceStats.attempts) || 0} - Ошибки: {Number(practiceStats && practiceStats.errors) || 0}
          </div>
        </div>

        <div className="tw-h-px tw-bg-slate-300" />

        <section className="tw-space-y-3">
          <p className="tw-m-0 tw-text-lg tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-900">Упражнения по грамматике</p>
          <p className="tw-m-0 tw-text-sm tw-text-slate-700">Два режима: смешанные упражнения или пользовательские упражнения.</p>

          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <button type="button" className={modeTabClass(mode === "mixed")} onClick={() => onModeChange("mixed")}>
              Смешанные упражнения
            </button>
            <button type="button" className={modeTabClass(mode === "custom")} onClick={() => onModeChange("custom")}>
              Пользовательские упражнения
            </button>
          </div>

          <p className="tw-m-0 tw-text-sm tw-text-slate-700">
            {mode === "mixed"
              ? "Смешанные упражнения: автоматический микс тем по текущему уровню."
              : "Пользовательские упражнения: сами выбираете правила и времена в удобных группах."}
          </p>
        </section>

        <div className={`tw-grid tw-gap-3 ${mode === "custom" ? "xl:tw-grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,0.9fr)]" : "lg:tw-grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)]"}`}>
          <section className={monoCard}>
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">Управление</p>
            <label className="tw-mt-3 tw-block tw-space-y-1 tw-text-sm tw-text-slate-800">
              <span className="tw-block tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-600">Цель</span>
              <select
                className="tw-w-full tw-border tw-border-slate-900 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-slate-900 tw-outline-none"
                value={goal}
                onChange={(e) => onGoalChange(e.target.value)}
              >
                {(goalOptions || []).map((row) => (
                  <option key={`goal-${row.value}`} value={row.value}>{row.label}</option>
                ))}
              </select>
            </label>

            <button type="button" className="tw-mt-3 tw-inline-flex tw-items-center tw-border tw-border-slate-900 tw-bg-white tw-px-4 tw-py-2.5 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900 hover:tw-bg-slate-100" onClick={onToggleTopicPicker}>
              Выбрать правила и времена
            </button>
          </section>

          {mode === "custom" ? (
            <section className={monoCard}>
              <p className="tw-m-0 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">Выбрано</p>
              <p className="tw-m-0 tw-mt-2 tw-text-sm tw-text-slate-700">Выбрано: {customChosen} правил из {customScopeTotal}</p>
              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{customChosen ? `Готово к запуску: ${customChosen} тем.` : "Пока ничего не выбрано"}</p>

              <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
                <button type="button" className={monoBtn} onClick={onToggleTopicPicker}>Изменить</button>
                <button type="button" className={monoBtn} onClick={onClearCustomScope} disabled={!customChosen}>Очистить все</button>
              </div>
            </section>
          ) : null}

          <section className={monoCard}>
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">Запуск</p>

            <div className="tw-mt-3 tw-space-y-2">
              <button type="button" className={monoBtnDark + " tw-w-full"} onClick={mode === "mixed" ? onStartMixed : onStartCustom} disabled={customStartDisabled}>
                {mode === "mixed" ? "Start mixed" : "Start custom"}
              </button>
              <button type="button" className={monoBtn + " tw-w-full"} onClick={onStartScopeMistakes} disabled={scopeMistakesCount <= 0}>
                Повторить ошибки
              </button>
              <button type="button" className={monoBtn + " tw-w-full"} onClick={onClearScopeMistakes} disabled={scopeMistakesCount <= 0}>
                Очистить ошибки
              </button>
              <button type="button" className={monoBtn + " tw-w-full"} onClick={onResetScopeProgress}>
                Сбросить прогресс
              </button>
            </div>

            <label className="tw-mt-3 tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-slate-800">
              <input type="checkbox" checked={!!showAnswersAfterEach} onChange={(e) => onToggleShowAnswers(!!e.target.checked)} />
              <span>Показывать ответы после каждого</span>
            </label>
          </section>
        </div>

        {showTopicPicker ? (
          <section className={monoCard + " tw-space-y-3"}>
            <p className="tw-m-0 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">Выбор правил и времен</p>
            {!customPickerGroups.length ? (
              <p className="tw-m-0 tw-text-sm tw-text-slate-700">Нет тем для выбранного уровня.</p>
            ) : (
              customPickerGroups.map((row) => (
                <div key={`picker-group-${row.group}`} className="tw-space-y-2">
                  <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-600">{row.title}</p>
                  <div className="tw-grid tw-gap-2 md:tw-grid-cols-2 xl:tw-grid-cols-3">
                    {row.items.map((topic) => {
                      const active = customScopeIds.includes(topic.id);
                      return (
                        <button
                          key={`picker-topic-${topic.id}`}
                          type="button"
                          onClick={() => onToggleCustomTopic(topic.id)}
                          className={[
                            "tw-border tw-p-3 tw-text-left tw-transition",
                            active ? "tw-border-slate-900 tw-bg-slate-100" : "tw-border-slate-400 tw-bg-white hover:tw-bg-slate-50",
                          ].join(" ")}
                        >
                          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{topic.title || topic.id}</p>
                          <p className="tw-m-0 tw-mt-1 tw-text-xs tw-text-slate-700">{topic.subtitle || topic.hint || "Описание темы"}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}

        <section className={monoCard}>
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">Подсказка</p>
          <ul className="tw-m-0 tw-mt-2 tw-space-y-1 tw-pl-5 tw-text-sm tw-text-slate-800">
            <li>Нажмите «Выбрать правила и времена» и добавьте хотя бы одну тему для custom-режима.</li>
            <li>Быстрый старт: выберите mixed и начните тренировку по текущему уровню.</li>
          </ul>
          <p className="tw-m-0 tw-mt-3 tw-text-xs tw-text-slate-600">enter - check/next • esc - выйти в меню</p>
        </section>
      </div>
    );
  }

  if (!selectedId) {
    return <div className={monoCard + " tw-text-sm tw-text-slate-700"}>Сначала выберите тему в Topics или запустите Mixed/Custom режим.</div>;
  }
  if (!selectedDoc) {
    return <div className={monoCard + " tw-text-sm tw-text-slate-700"}>Подготовка практики...</div>;
  }
  if (!queue.length) {
    return (
      <div className={monoCard + " tw-text-sm tw-text-slate-700"}>
        {practiceMistakesMode ? "Для режима ошибок пока нет заданий." : "Для этой темы пока нет упражнений."}
      </div>
    );
  }

  return (
    <div className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
        <button type="button" onClick={onBackToSetup} className={monoBtn}>Назад</button>
        <div className="tw-border tw-border-slate-900 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-800">
          Заданий: {Number(practiceStats && practiceStats.attempts) || 0} - Ошибки: {Number(practiceStats && practiceStats.errors) || 0}
        </div>
      </div>

      <section className={monoCard}>
        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
          <p className="tw-m-0 tw-text-base tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-900">{practiceHeading || "Тренировка"}</p>
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <span className="tw-border tw-border-slate-700 tw-bg-white tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-800">{cursor + 1} / {queue.length}</span>
            <span className="tw-border tw-border-slate-700 tw-bg-white tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.06em] tw-text-slate-800">Счет {liveScore} / {answeredCount}</span>
          </div>
        </div>

        <div className="tw-mt-3 tw-h-2 tw-w-full tw-overflow-hidden tw-bg-slate-200">
          <div className="tw-h-full tw-bg-slate-900 tw-transition-all" style={{ width: `${Math.max(4, practiceProgressPercent)}%` }} />
        </div>
      </section>

      <section className={monoCard}>
        {String(current && current.item && current.item.instruction || "").trim() ? (
          <p className="tw-m-0 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-600">{String(current.item.instruction || "").trim()}</p>
        ) : null}
        {String(current && current.item && current.item.prompt || "").trim() ? (
          <p className="tw-m-0 tw-mt-3 tw-whitespace-pre-wrap tw-text-lg tw-font-semibold tw-leading-relaxed tw-text-slate-900">{String(current.item.prompt || "").trim()}</p>
        ) : null}

        <div className="tw-mt-5">{practiceInputNode}</div>
      </section>

      {checked && resultState && showAnswersAfterEach ? (
        <section className={[
          "tw-border tw-p-4",
          resultState.ok ? "tw-border-emerald-500 tw-bg-emerald-50" : "tw-border-rose-500 tw-bg-rose-50",
        ].join(" ")}>
          <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{resultState.ok ? "Правильно" : "Есть ошибка"}</p>
          {resultState.expectedText ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">Верный вариант: {resultState.expectedText}</p> : null}
          {resultState.explain ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-700">{resultState.explain}</p> : null}
          {!resultState.ok && resultState.linkedTopicId ? (
            <button type="button" onClick={() => onBackToTopics(resultState.linkedTopicId)} className="tw-mt-3 tw-inline-flex tw-items-center tw-border tw-border-slate-700 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-slate-800 hover:tw-bg-slate-100">
              Открыть нужное правило
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="tw-flex tw-flex-wrap tw-gap-2">
        {!checked ? (
          <button type="button" onClick={onCheckCurrent} className={monoBtnDark} disabled={!canCheckCurrent}>Проверить</button>
        ) : !done ? (
          <button type="button" onClick={onNextCurrent} className={monoBtnDark}>Дальше</button>
        ) : (
          <>
            <button type="button" onClick={onRestartPractice} className={monoBtnDark}>Пройти заново</button>
            <button type="button" onClick={() => onBackToTopics()} className={monoBtn}>К темам</button>
          </>
        )}

        {selectedMeta && selectedMistakesCount && !practiceMistakesMode ? (
          <button type="button" onClick={() => onRepeatTopicMistakes(selectedMeta.id)} className={monoBtn}>
            Повторить ошибки ({selectedMistakesCount})
          </button>
        ) : null}
      </section>
    </div>
  );
}
