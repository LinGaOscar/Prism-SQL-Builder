# GitHub Actions 自動建置與部署

## 目標

每次 push 到 `main` branch 時，GitHub Actions 自動：
1. 下載 Tailwind CSS CLI（Linux 版）
2. 產生 `storage/tailwind.css`
3. 執行 `build.ps1` → 產生 `dist/index.html`
4. 將 `dist/` 部署到 GitHub Pages

部署完成後可透過 `https://<user>.github.io/<repo>/` 直接開啟，免下載。

---

## 前置設定（一次性）

在 GitHub repo 執行以下步驟（Settings → Pages）：

1. **Source** 設為 `GitHub Actions`（非 Deploy from branch）
2. 確認 repo 是 **Public**（免費帳號 Private repo 需要 GitHub Pro）

---

## 運作流程

```
push to main
    │
    ▼
GitHub Actions Runner（ubuntu-latest）
    │
    ├─ [1] checkout 原始碼
    │
    ├─ [2] 下載 tailwindcss-linux-x64
    │       └─ 官方獨立執行檔，不需 Node.js
    │
    ├─ [3] ./tailwindcss -i storage/input.css -o storage/tailwind.css --minify
    │       └─ 產生靜態 CSS（build.ps1 從此路徑讀取）
    │
    ├─ [4] pwsh scripts/build.ps1
    │       ├─ 下載 vendor/vue.global.js（若快取不存在）
    │       └─ 合併所有模組 → 輸出 dist/index.html
    │
    └─ [5] 上傳 dist/ → 部署到 GitHub Pages
```

---

## Workflow 檔案（.github/workflows/deploy.yml）

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]        # 只有 push 到 main 才觸發

permissions:
  contents: read
  pages: write              # 允許寫入 GitHub Pages
  id-token: write           # OIDC 身份驗證（deploy-pages 需要）

concurrency:
  group: pages
  cancel-in-progress: true  # 同時只允許一個部署，後者取消前者

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      # 1. 取得原始碼
      - uses: actions/checkout@v4

      # 2. vendor 快取（Vue 不常變動，避免每次重新下載）
      - name: Cache vendor
        uses: actions/cache@v4
        with:
          path: vendor/
          key: vendor-${{ hashFiles('scripts/build.ps1') }}

      # 3. 下載 Tailwind CSS CLI（Linux 版）
      - name: Download Tailwind CSS CLI
        run: |
          curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 -o tailwindcss
          chmod +x tailwindcss

      # 4. 產生 storage/tailwind.css（路徑需與 build.ps1 一致）
      - name: Generate tailwind.css
        run: ./tailwindcss -i ./storage/input.css -o ./storage/tailwind.css --minify

      # 5. 執行打包腳本（pwsh 在 ubuntu-latest 內建）
      - name: Build prism.html
        run: pwsh ./scripts/build.ps1

      # 6. 將 dist/ 包成 Pages artifact
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 與本地打包的差異

| 項目 | 本地（Windows） | 本地（macOS） | GitHub Actions（Ubuntu） |
|------|----------------|--------------|------------------------|
| Tailwind 執行檔 | `tailwindcss.exe` | `tailwindcss-macos-arm64` / `-x64` | `tailwindcss-linux-x64` |
| CSS 輸入路徑 | `storage/input.css` | `storage/input.css` | `storage/input.css` |
| CSS 輸出路徑 | `storage/tailwind.css` | `storage/tailwind.css` | `storage/tailwind.css` |
| PowerShell | `pwsh`（需手動安裝） | `pwsh`（需手動安裝） | 內建 `pwsh` |
| 觸發方式 | 手動執行 `build.bat` | 手動執行 `build.ps1` | push 自動觸發 |
| 輸出位置 | `prism.html`（根目錄） | `prism.html`（根目錄） | `dist/index.html` → GitHub Pages |

> `build.ps1` 已透過 `$env:CI` 判斷環境，CI 時自動輸出至 `dist/index.html`，本地輸出至 `prism.html`。

---

## 常見問題

**Q: push 後 GitHub Pages 沒有更新？**

1. 確認 Settings → Pages → Source 是否設為 `GitHub Actions`
2. 至 Actions tab 確認 workflow 是否成功執行
3. 若 workflow 失敗，最常見原因：Tailwind CSS 路徑錯誤（輸入/輸出需指向 `storage/`）

**Q: Actions 顯示綠色但頁面仍是舊版？**

瀏覽器快取問題，強制重新整理（Cmd+Shift+R / Ctrl+Shift+R）。

---

## 完成後的使用方式

| 情境 | 說明 |
|------|------|
| 線上使用 | 瀏覽器直接開啟 GitHub Pages URL |
| 離線使用 | 從 GitHub Pages 下載 `index.html` 存到本機 |
| 本地開發 | 照舊用 `index.html` + Live Server |
