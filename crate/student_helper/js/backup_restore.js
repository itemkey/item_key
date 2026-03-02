(function(){
  const btnBackup = document.getElementById('shBackupBtn');
  const btnRestore = document.getElementById('shRestoreBtn');
  const inputRestore = document.getElementById('shRestoreFile');

  if(!btnBackup || !btnRestore || !inputRestore) return;

  const DICT_DB = 'student_helper_db__dictionary';
  const DICT_VERSION = 1;

  function isBackupKey(key){
    const k = String(key || '');
    if(!k) return false;
    if(k.startsWith('sh_')) return true;
    if(k.startsWith('student_helper_')) return true;
    if(k.startsWith('itemkey.currentUser')) return true;
    return false;
  }

  function openDictDb(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DICT_DB, DICT_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('open dictionary db failed'));
    });
  }

  function reqP(req){
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('request failed'));
    });
  }

  function txDone(db, tx){
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { try{ db.close(); }catch(_){ } resolve(true); };
      tx.onerror = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx failed')); };
      tx.onabort = () => { try{ db.close(); }catch(_){ } reject(tx.error || new Error('tx aborted')); };
    });
  }

  async function exportDictionary(){
    try{
      const db = await openDictDb();
      const tx = db.transaction(['sections', 'words'], 'readonly');
      const s = reqP(tx.objectStore('sections').getAll());
      const w = reqP(tx.objectStore('words').getAll());
      const [sections, words] = await Promise.all([s, w]);
      await txDone(db, tx);
      return { sections: sections || [], words: words || [] };
    }catch(_){
      return { sections: [], words: [] };
    }
  }

  async function importDictionary(snapshot){
    const data = snapshot || { sections: [], words: [] };
    const db = await openDictDb();
    const tx = db.transaction(['sections', 'words'], 'readwrite');
    const sStore = tx.objectStore('sections');
    const wStore = tx.objectStore('words');
    sStore.clear();
    wStore.clear();

    const secRows = Array.isArray(data.sections) ? data.sections : [];
    const wordRows = Array.isArray(data.words) ? data.words : [];
    for(const s of secRows) sStore.add(s);
    for(const w of wordRows) wStore.add(w);

    await txDone(db, tx);
  }

  function exportLocalStorage(){
    const rows = [];
    for(let i = 0; i < localStorage.length; i += 1){
      const key = localStorage.key(i);
      if(!isBackupKey(key)) continue;
      rows.push({ key, value: localStorage.getItem(key) });
    }
    rows.sort((a, b) => String(a.key).localeCompare(String(b.key)));
    return rows;
  }

  function importLocalStorage(rows){
    const list = Array.isArray(rows) ? rows : [];
    for(let i = 0; i < localStorage.length; i += 1){
      const key = localStorage.key(i);
      if(isBackupKey(key)) localStorage.removeItem(key);
    }
    for(const row of list){
      if(!row || !row.key) continue;
      localStorage.setItem(String(row.key), String(row.value == null ? '' : row.value));
    }
  }

  function downloadJson(name, payload){
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function runExport(){
    btnBackup.disabled = true;
    try{
      const dictionary = await exportDictionary();
      const payload = {
        schema: 'student_helper_backup_v1',
        exportedAt: new Date().toISOString(),
        localStorage: exportLocalStorage(),
        dictionary
      };
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
      downloadJson(`student_helper_backup_${stamp}.json`, payload);
      alert('Backup сохранен.');
    }catch(e){
      alert(`Ошибка backup: ${e && (e.message || e)}`);
    }finally{
      btnBackup.disabled = false;
    }
  }

  async function runImport(file){
    if(!file) return;
    if(!confirm('Импорт заменит текущие локальные данные Student Helper в этом браузере. Продолжить?')) return;
    btnRestore.disabled = true;
    try{
      const text = await file.text();
      const payload = JSON.parse(text);
      if(!payload || payload.schema !== 'student_helper_backup_v1'){
        throw new Error('Неверный формат backup файла');
      }

      importLocalStorage(payload.localStorage || []);
      await importDictionary(payload.dictionary || { sections: [], words: [] });

      try{ window.dispatchEvent(new CustomEvent('dict:local-changed')); }catch(_){ }
      alert('Restore выполнен. Страница будет перезагружена.');
      window.location.reload();
    }catch(e){
      alert(`Ошибка restore: ${e && (e.message || e)}`);
    }finally{
      btnRestore.disabled = false;
    }
  }

  btnBackup.addEventListener('click', runExport);
  btnRestore.addEventListener('click', () => {
    inputRestore.value = '';
    inputRestore.click();
  });
  inputRestore.addEventListener('change', () => {
    const file = inputRestore.files && inputRestore.files[0];
    runImport(file);
  });
})();
