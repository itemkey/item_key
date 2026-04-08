const NOTES_DB = "itemkey_onoi_notes_db_v1";
const NOTES_STORE = "notes";
const CATS_STORE = "cats";

function htmlToText(html) {
  if (typeof document === "undefined") return String(html || "");
  const temp = document.createElement("div");
  temp.innerHTML = String(html || "");

  temp.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  temp
    .querySelectorAll("p,div,li,blockquote,pre,h1,h2,h3,h4,h5,h6")
    .forEach((el) => el.appendChild(document.createTextNode("\n")));

  let text = temp.textContent || "";
  text = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  text = text.replace(/[\t\f\v ]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function openIndexedDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readonly");
    const st = tx.objectStore(storeName);
    const req = st.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function loadNotesSnapshot() {
  const db = await openIndexedDb(NOTES_DB);
  try {
    const [notes, cats] = await Promise.all([
      getAllFromStore(db, NOTES_STORE),
      getAllFromStore(db, CATS_STORE).catch(() => []),
    ]);

    return {
      notes: (Array.isArray(notes) ? notes : []).map((note) => ({
        ...note,
        plainText: htmlToText(note && note.html ? note.html : ""),
      })),
      cats: Array.isArray(cats) ? cats : [],
    };
  } finally {
    db.close();
  }
}
