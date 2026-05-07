(function () {
  /**
   * File System Access API 支援偵測。
   * Chrome 86+ / Edge 86+ 支援；Firefox / Safari 不支援，自動降級。
   */
  const isSupported = 'showOpenFilePicker' in window

  const FILE_TYPES = [{
    description: 'Prism 設定檔',
    accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] }
  }]

  /**
   * 開啟檔案選擇器，回傳 { handle, text }。
   * handle 需儲存在 app state 以便後續直接儲存（不需再次選檔）。
   */
  async function openFile() {
    const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES })
    const file = await handle.getFile()
    const text = await file.text()
    return { handle, text }
  }

  /**
   * 寫入現有 handle（需已有開啟或儲存過的 handle）。
   * 業務背景：使用者指定一次 .md 檔後，之後修改可直接儲存，無需重複選擇。
   */
  async function saveFile(handle, content) {
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  /**
   * 另存新檔：開啟儲存對話框，回傳新的 handle。
   */
  async function saveAsFile(content, suggestedName = 'prism-schema.md') {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: FILE_TYPES
    })
    await saveFile(handle, content)
    return handle
  }

  /**
   * 降級方案：觸發瀏覽器下載 .md 檔（不需使用者授權）。
   * 業務背景：Firefox 不支援 File System Access API，改用 Blob 下載模擬匯出。
   */
  function downloadFile(content, filename = 'prism-schema.md') {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  window.fsStorage = { isSupported, openFile, saveFile, saveAsFile, downloadFile }
})()
