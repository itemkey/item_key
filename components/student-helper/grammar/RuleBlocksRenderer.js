function asText(value) {
  return String(value || "").trim();
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function RuleTable({ block }) {
  const cols = asList(block && block.columns);
  const rows = asList(block && block.rows);
  if (!cols.length && !rows.length) return null;

  return (
    <div className="tw-overflow-x-auto tw-border tw-border-slate-200 tw-rounded-xl">
      <table className="tw-min-w-full tw-border-collapse tw-text-left tw-text-sm">
        {cols.length ? (
          <thead className="tw-bg-slate-100">
            <tr>
              {cols.map((col, idx) => (
                <th key={`${idx}-${asText(col)}`} className="tw-border-b tw-border-slate-200 tw-px-3 tw-py-2 tw-font-semibold tw-text-slate-900">
                  {asText(col)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={`${rowIdx}`} className="odd:tw-bg-white even:tw-bg-slate-50">
              {asList(row).map((cell, cellIdx) => (
                <td key={`${rowIdx}-${cellIdx}`} className="tw-border-b tw-border-slate-200 tw-px-3 tw-py-2 tw-align-top tw-text-slate-700">
                  {asText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleBlock({ block, idx, onOpenTopic }) {
  const type = asText(block && block.type);
  const cardClass = "tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 sm:tw-p-5";

  if (type === "heading") {
    return (
      <div key={`${idx}-heading`} className={cardClass}>
        <h3 className="tw-m-0 tw-text-base tw-font-semibold tw-text-slate-900">{asText(block.text)}</h3>
      </div>
    );
  }

  if (type === "text") {
    return (
      <div key={`${idx}-text`} className={cardClass}>
        <p className="tw-m-0 tw-text-sm tw-leading-relaxed tw-text-slate-700">{asText(block.text)}</p>
      </div>
    );
  }

  if (type === "highlight") {
    return (
      <div key={`${idx}-highlight`} className={`${cardClass} tw-bg-slate-50`}>
        {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
        <ul className="tw-m-0 tw-list-disc tw-space-y-1.5 tw-pl-5 tw-text-sm tw-text-slate-700">
          {asList(block.lines).map((line, lineIdx) => (
            <li key={`${idx}-line-${lineIdx}`}>{asText(line)}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div key={`${idx}-table`} className={cardClass}>
        {asText(block.caption) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.caption)}</p> : null}
        <RuleTable block={block} />
      </div>
    );
  }

  if (type === "examples") {
    return (
      <div key={`${idx}-examples`} className={cardClass}>
        <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">Примеры</p>
        <ul className="tw-m-0 tw-list-none tw-space-y-2 tw-p-0">
          {asList(block.items).map((item, itemIdx) => (
            <li key={`${idx}-example-${itemIdx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-p-3">
              <p className="tw-m-0 tw-text-sm tw-font-medium tw-text-slate-900">{asText(item && item.en)}</p>
              <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(item && item.ru)}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (type === "image") {
    const src = asText(block && block.src);
    if (!src) return null;
    return (
      <div key={`${idx}-image`} className={cardClass}>
        {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
        {asText(block.note) ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(block.note)}</p> : null}
        <div className="tw-mt-3 tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50">
          <img src={src} alt={asText(block.alt) || "Rule image"} loading="lazy" className="tw-block tw-h-auto tw-w-full" />
        </div>
      </div>
    );
  }

  if (type === "imageGallery") {
    const items = asList(block && block.items);
    if (!items.length) return null;
    return (
      <div key={`${idx}-gallery`} className={cardClass}>
        {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
        {asText(block.note) ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(block.note)}</p> : null}

        <div className="tw-mt-3 tw-space-y-3">
          {items.map((item, itemIdx) => {
            const src = asText(item && item.src);
            if (!src) return null;
            return (
              <figure key={`${idx}-gallery-item-${itemIdx}`} className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50">
                <img src={src} alt={asText(item && item.alt) || `Gallery image ${itemIdx + 1}`} loading="lazy" className="tw-block tw-h-auto tw-w-full" />
                {asText(item && item.caption) ? (
                  <figcaption className="tw-border-t tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-text-slate-600">{asText(item.caption)}</figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "topicLinks") {
    return (
      <div key={`${idx}-links`} className={`${cardClass} tw-bg-slate-50`}>
        {asText(block.title) ? <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(block.title)}</p> : null}
        {asText(block.note) ? <p className="tw-m-0 tw-text-sm tw-text-slate-600">{asText(block.note)}</p> : null}
        <div className="tw-space-y-2">
          {asList(block.items).map((item, itemIdx) => {
            const linkedId = asText(item && item.id);
            return (
              <div key={`${idx}-topic-link-${itemIdx}`} className="tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-p-3">
                <p className="tw-m-0 tw-text-sm tw-font-semibold tw-text-slate-900">{asText(item && item.label) || linkedId || "Тема"}</p>
                {asText(item && item.note) ? <p className="tw-m-0 tw-mt-1 tw-text-sm tw-text-slate-600">{asText(item.note)}</p> : null}
                {linkedId ? (
                  <button
                    type="button"
                    className="tw-mt-3 tw-inline-flex tw-items-center tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-slate-700 hover:tw-border-slate-500"
                    onClick={() => onOpenTopic(linkedId)}
                  >
                    Открыть тему
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div key={`${idx}-unknown`} className={`${cardClass} tw-bg-slate-50`}>
      <p className="tw-m-0 tw-text-sm tw-text-slate-600">Дополнительный материал недоступен в упрощенном режиме.</p>
    </div>
  );
}

export default function RuleBlocksRenderer({ blocks, onOpenTopic }) {
  return asList(blocks).map((block, idx) => (
    <RuleBlock key={`rule-block-${idx}`} block={block} idx={idx} onOpenTopic={onOpenTopic} />
  ));
}
