export class UI {
  constructor() {
    this.modalEl = document.getElementById("modal");
    this.modalTitleEl = document.getElementById("modalTitle");
    this.modalBodyEl = document.getElementById("modalBody");
    this.toastStack = document.getElementById("toasts");

    // close handlers
    this.modalEl?.addEventListener("click", (e) => {
      const t = e.target;
      if (t?.matches("[data-close]") || t?.closest("[data-close]")) this.closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modalEl && !this.modalEl.hidden) this.closeModal();
    });
  }

  openModal({ title, bodyHtml, onSubmit, onMount }) {
    if (!this.modalEl || !this.modalTitleEl || !this.modalBodyEl) {
      console.error("Modal elements not found (#modal/#modalTitle/#modalBody).");
      return;
    }

    this.modalTitleEl.textContent = title;
    this.modalBodyEl.innerHTML = bodyHtml;

    // bind submit (if any)
    const form = this.modalBodyEl.querySelector("form");
    if (form && onSubmit) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const data = Object.fromEntries(fd.entries());
        onSubmit(data, form);
      });
    }

    // custom mount hook (buttons, dynamic UI)
    if (typeof onMount === "function") {
      onMount(this.modalBodyEl, this.modalEl);
    }

    // жёстко показываем (на случай конфликтов hidden/display)
    this.modalEl.hidden = false;
    this.modalEl.removeAttribute("hidden");
    this.modalEl.style.display = "block";
  }

  closeModal() {
    if (!this.modalEl) return;

    this.modalEl.hidden = true;
    this.modalEl.setAttribute("hidden", "");
    this.modalEl.style.display = "none";

    if (this.modalTitleEl) this.modalTitleEl.textContent = "";
    if (this.modalBodyEl) this.modalBodyEl.innerHTML = "";
  }

  toast(text, ms = 2200) {
    if (!this.toastStack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    this.toastStack.appendChild(el);
    window.setTimeout(() => el.remove(), ms);
  }
}
