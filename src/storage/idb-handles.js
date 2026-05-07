(function () {
  const DB_NAME = 'prism_db'
  const STORE   = 'handles'
  const DIR_KEY = 'saveDir'

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
      req.onsuccess = e => resolve(e.target.result)
      req.onerror   = e => reject(e.target.error)
    })
  }

  /** 將 FileSystemDirectoryHandle 存入 IndexedDB */
  async function saveDirHandle(handle) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(handle, DIR_KEY)
      tx.oncomplete = resolve
      tx.onerror    = e => reject(e.target.error)
    })
  }

  /** 從 IndexedDB 讀取先前儲存的 DirectoryHandle，不存在時回傳 null */
  async function loadDirHandle() {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(DIR_KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror   = e => reject(e.target.error)
    })
  }

  /** 清除已儲存的 DirectoryHandle */
  async function clearDirHandle() {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(DIR_KEY)
      tx.oncomplete = resolve
      tx.onerror    = e => reject(e.target.error)
    })
  }

  window.idbHandles = { saveDirHandle, loadDirHandle, clearDirHandle }
})()
