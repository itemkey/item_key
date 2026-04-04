function asText(value) {
  return String(value || "").trim();
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return asText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function inputAccepted(raw, accepted, acceptedShort) {
  const current = normalize(raw);
  if (!current) return false;

  const full = new Set(asList(accepted).map(normalize).filter(Boolean));
  if (full.has(current)) return true;

  const short = new Set(asList(acceptedShort).map(normalize).filter(Boolean));
  if (short.has(current)) return true;
  for (const token of short) {
    if (token && (current === token || current.includes(token))) return true;
  }
  return false;
}

export default function PracticeInputRenderer({ current, answerState, setAnswerState, checked, resultState }) {
  if (!current) return null;
  const item = current.item || {};
  const kind = asText(current.kind);

  if (kind === "choice") {
    const selectedIndex = Number(answerState && answerState.selectedIndex);
    const correctIndex = Number(item && item.correctIndex);
    return (
      <ul className="tw-m-0 tw-list-none tw-space-y-3 tw-p-0">
        {asList(item.options).map((opt, idx) => {
          const active = selectedIndex === idx;
          const isCorrect = checked && idx === correctIndex;
          const isWrong = checked && active && idx !== correctIndex;
          const baseClass = "tw-w-full tw-rounded-md tw-border tw-px-4 tw-py-3 tw-text-left tw-text-sm tw-font-medium tw-transition";
          let stateClass = "tw-border-slate-700 tw-bg-white tw-text-slate-900 hover:tw-bg-slate-50";

          if (active && !checked) stateClass = "tw-border-slate-900 tw-bg-slate-100 tw-text-slate-900";
          if (isCorrect) stateClass = "tw-border-emerald-500 tw-bg-emerald-50 tw-text-emerald-900";
          if (isWrong) stateClass = "tw-border-rose-500 tw-bg-rose-50 tw-text-rose-900";

          return (
            <li key={`${current.key}-choice-${idx}`}>
              <button
                type="button"
                disabled={checked}
                onClick={() => setAnswerState({ selectedIndex: idx })}
                className={`${baseClass} ${stateClass}`}
              >
                {asText(opt)}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  if (kind === "multi") {
    const expectedSet = new Set(asList(item.correctIndices).map((x) => Number(x)));
    return (
      <ul className="tw-m-0 tw-list-none tw-space-y-3 tw-p-0">
        {asList(item.options).map((opt, idx) => {
          const selected = !!(answerState.selected && answerState.selected[idx]);
          const expected = expectedSet.has(idx);
          const isCorrect = checked && selected && expected;
          const isWrong = checked && selected && !expected;
          const isMissed = checked && !selected && expected;
          let stateClass = "tw-border-slate-700 tw-bg-white";
          if (selected && !checked) stateClass = "tw-border-slate-900 tw-bg-slate-100";
          if (isCorrect) stateClass = "tw-border-emerald-500 tw-bg-emerald-50";
          if (isWrong) stateClass = "tw-border-rose-500 tw-bg-rose-50";
          if (isMissed) stateClass = "tw-border-amber-500 tw-bg-amber-50";
          return (
            <li key={`${current.key}-multi-${idx}`}>
              <label className={`tw-flex tw-items-start tw-gap-3 tw-rounded-md tw-border tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 ${stateClass}`}>
                <input
                  type="checkbox"
                  disabled={checked}
                  checked={selected}
                  onChange={(e) => {
                    setAnswerState((prev) => ({
                      selected: {
                        ...(prev && prev.selected ? prev.selected : {}),
                        [idx]: !!e.target.checked,
                      },
                    }));
                  }}
                />
                <span>{asText(opt)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  if (kind === "input" || kind === "correction") {
    let fieldClass = "tw-border-slate-700 focus:tw-border-slate-900";
    if (checked && resultState && resultState.ok) fieldClass = "tw-border-emerald-500 tw-bg-emerald-50";
    if (checked && resultState && !resultState.ok) fieldClass = "tw-border-rose-500 tw-bg-rose-50";
    return (
      <textarea
        className={`tw-min-h-[120px] tw-w-full tw-rounded-md tw-border tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 tw-outline-none ${fieldClass}`}
        disabled={checked}
        value={asText(answerState.text)}
        onChange={(e) => setAnswerState({ text: e.target.value })}
        placeholder="Введите ответ"
      />
    );
  }

  if (kind === "multi_input") {
    const inputs = asList(item.inputs);
    const values = asList(answerState.values);
    return (
      <div className="tw-space-y-3">
        {inputs.map((_, idx) => (
          <div key={`${current.key}-multi-input-wrap-${idx}`} className="tw-space-y-1">
            <p className="tw-m-0 tw-text-xs tw-font-medium tw-uppercase tw-tracking-[0.08em] tw-text-slate-600">Ответ {idx + 1}</p>
            <input
              className={[
                "tw-w-full tw-rounded-md tw-border tw-bg-white tw-px-4 tw-py-3 tw-text-sm tw-text-slate-900 tw-outline-none",
                checked
                  ? (inputAccepted(values[idx], inputs[idx] && inputs[idx].accepted, inputs[idx] && inputs[idx].acceptedShort)
                    ? "tw-border-emerald-500 tw-bg-emerald-50"
                    : "tw-border-rose-500 tw-bg-rose-50")
                  : "tw-border-slate-700 focus:tw-border-slate-900",
              ].join(" ")}
              disabled={checked}
              value={asText(values[idx])}
              onChange={(e) => {
                const next = values.slice();
                next[idx] = e.target.value;
                setAnswerState({ values: next });
              }}
              placeholder={`Ответ ${idx + 1}`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (kind === "inline_select") {
    const segments = asList(item.segments);
    const blanks = asList(item.blanks);
    const values = asList(answerState.values);
    return (
      <div className="tw-space-y-4">
        {asText(item.storyTitle) ? <p className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(item.storyTitle)}</p> : null}
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-text-sm tw-leading-relaxed tw-text-slate-900">
          {blanks.map((blank, idx) => (
            <span key={`${current.key}-inline-${idx}`} className="tw-flex tw-items-center tw-gap-2">
              <span>{asText(segments[idx])}</span>
              <select
                className={[
                  "tw-rounded-md tw-border tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-outline-none",
                  checked
                    ? (Number(values[idx]) === Number(blank && blank.correctIndex)
                      ? "tw-border-emerald-500 tw-bg-emerald-50"
                      : "tw-border-rose-500 tw-bg-rose-50")
                    : "tw-border-slate-700 focus:tw-border-slate-900",
                ].join(" ")}
                disabled={checked}
                value={Number.isFinite(Number(values[idx])) ? String(values[idx]) : ""}
                onChange={(e) => {
                  const next = values.slice();
                  const v = asText(e.target.value);
                  next[idx] = v === "" ? -1 : Number(v);
                  setAnswerState({ values: next });
                }}
              >
                <option value="">...</option>
                {asList(blank && blank.options).map((opt, optIdx) => (
                  <option key={`${current.key}-inline-opt-${idx}-${optIdx}`} value={String(optIdx)}>
                    {asText(opt)}
                  </option>
                ))}
              </select>
            </span>
          ))}
          <span>{asText(segments[blanks.length])}</span>
        </div>
      </div>
    );
  }

  if (kind === "match") {
    const pairs = asList(item.pairs);
    const rights = [...new Set(pairs.map((pair) => asText(pair && pair.right)).filter(Boolean))];
    const picks = (answerState && answerState.picks) || {};

    return (
      <div className="tw-space-y-3">
        {pairs.map((pair, idx) => {
          const left = asText(pair && pair.left);
          const expected = asText(pair && pair.right);
          const actual = asText(picks[left]);
          const rowState = !checked
            ? "tw-border-slate-700"
            : (actual && actual === expected ? "tw-border-emerald-500 tw-bg-emerald-50" : "tw-border-rose-500 tw-bg-rose-50");
          return (
            <div key={`${current.key}-match-${idx}`} className={`tw-grid tw-gap-2 tw-rounded-md tw-border tw-p-3 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)] ${rowState}`}>
              <div className="tw-text-sm tw-font-medium tw-text-slate-900">{left}</div>
              <select
                className="tw-rounded-md tw-border tw-border-slate-700 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-slate-900"
                disabled={checked}
                value={asText(picks[left])}
                onChange={(e) => {
                  setAnswerState((prev) => ({
                    picks: {
                      ...(prev && prev.picks ? prev.picks : {}),
                      [left]: e.target.value,
                    },
                  }));
                }}
              >
                <option value="">...</option>
                {rights.map((right, rightIdx) => (
                  <option key={`${current.key}-match-opt-${idx}-${rightIdx}`} value={right}>
                    {right}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    );
  }

  if (kind === "drag_sort") {
    const bins = asList(item.bins);
    const words = asList(item.words);
    const picks = asList(answerState.picks);

    return (
      <div className="tw-space-y-3">
        {words.map((word, idx) => (
          <div
            key={`${current.key}-drag-${idx}`}
            className={[
              "tw-grid tw-gap-2 tw-rounded-md tw-border tw-p-3 sm:tw-grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]",
              !checked
                ? "tw-border-slate-700"
                : (asText(picks[idx]) === asText(word && word.bin) ? "tw-border-emerald-500 tw-bg-emerald-50" : "tw-border-rose-500 tw-bg-rose-50"),
            ].join(" ")}
          >
            <div className="tw-text-sm tw-font-medium tw-text-slate-900">{asText(word && word.text)}</div>
            <select
              className="tw-rounded-md tw-border tw-border-slate-700 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-outline-none focus:tw-border-slate-900"
              disabled={checked}
              value={asText(picks[idx])}
              onChange={(e) => {
                const next = picks.slice();
                next[idx] = e.target.value;
                setAnswerState({ picks: next });
              }}
            >
              <option value="">...</option>
              {bins.map((bin, binIdx) => (
                <option key={`${current.key}-drag-bin-${idx}-${binIdx}`} value={asText(bin)}>
                  {asText(bin)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tw-rounded-md tw-border tw-border-slate-700 tw-bg-slate-50 tw-p-4 tw-text-sm tw-text-slate-700">
      Этот тип задания скоро появится в обновленном режиме практики.
    </div>
  );
}
