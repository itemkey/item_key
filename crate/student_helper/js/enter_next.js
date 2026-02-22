// Enter = кнопка "ДАЛЕЕ" (Next)
// Важно: этот обработчик НЕ должен ломать режимы, где Enter уже обрабатывается внутри (например, Dictionary).
(() => {
  const isVisible = (el) => {
    if (!el) return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    return el.getClientRects().length > 0;
  };

  const findNextButton = () => {
    // 1) Known IDs
    const ids = [
      "btnNext",
      "dictCardsNext",
      "btnQuizCheckNext",
      "btnLearnCheckNext",
      "next", "nextBtn", "btn-next", "btn-next-task",
      "tensesNext", "wtNext", "structureNext"
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (isVisible(el)) return el;
    }

    // 2) Marked as next
    const marked = document.querySelector('[data-action="next"], [data-next="true"]');
    if (isVisible(marked)) return marked;

    // 3) Fallback by text/title
    const candidates = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]'))
      .filter(isVisible);

    const scored = candidates.map((el) => {
      const text = (el.innerText || el.textContent || "").trim().toLowerCase();
      const title = (el.getAttribute("title") || "").trim().toLowerCase();
      const id = (el.id || "").toLowerCase();
      let score = 0;

      if (text === "далее" || text === "next") score += 100;
      if (text.includes("далее")) score += 60;
      if (text.includes("следующ")) score += 60;
      if (title.includes("следующ") || title.includes("next")) score += 40;
      if (id.includes("next")) score += 20;

      return { el, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    return scored.length ? scored[0].el : null;
  };

  // ВАЖНО: слушаем в bubbling-phase (capture=false),
  // чтобы если внутри конкретного задания уже есть обработчик Enter (и он сделал preventDefault),
  // мы не делали второй клик и не "скипали" показ результата.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.isComposing) return;
    if (e.repeat) return;
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

    // Если кто-то уже обработал Enter (например, dictionary input -> quizCheckOrNext/learnCheckOrNext)
    if (e.defaultPrevented) return;

    const active = document.activeElement;
    if (active && active.tagName === "TEXTAREA") return;
    if (active && active.isContentEditable) return;

    const btn = findNextButton();
    if (!btn) return;

    e.preventDefault();
    btn.click();
  }, false);
})();