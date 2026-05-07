# GitHub Actions 自動建置與部署

## 目標

每次 push 到 `main` branch 時，GitHub Actions 自動：
1. 下載 Tailwind CSS CLI（Linux 版）
2. 產生 `tailwind.css`
3. 執行 `build.ps1` → 產生 `prism.html`
4. 將 `prism.html` 部署到 GitHub Pages

部署完成後可透過 `https://<user>.github.io/<repo>/` 直接開啟，免下載。

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
    ├─ [3] ./tailwindcss -i src/input.css -o tailwind.css --minify
    │       └─ 產生靜態 CSS
    │
    ├─ [4] pwsh scripts/build.ps1
    │       ├─ 下載 vendor/vue.global.js（若不存在）
    │       ├─ 下載 vendor/mermaid.min.js（若不存在）
    │       └─ 合併所有模組 → 輸出 prism.html
    │
    └─ [5] 上傳 prism.html → 部署到 GitHub Pages
```

---

## 與本地打包的差異

| 項目 | 本地（Windows） | GitHub Actions（Ubuntu） |
|------|----------------|------------------------|
| Tailwind 執行檔 | `tailwindcss.exe` | `tailwindcss-linux-x64` |
| PowerShell | `pwsh`（需手動安裝） | 內建 `pwsh` |
| 觸發方式 | 手動雙擊 `build.bat` | push 自動觸發 |
| 輸出位置 | 本地 `prism.html` | GitHub Pages URL |

> `build.ps1` 本身不需要修改，pwsh 在 Ubuntu 上行為相同。

---

## 前置設定（一次性）

在 GitHub repo 執行以下步驟（Settings → Pages）：

1. **Source** 設為 `GitHub Actions`（非 Deploy from branch）
2. 確認 repo 是 **Public**（免費帳號 Private repo 需要 GitHub Pro）

---

## Workflow 檔案位置

```
.github/
  workflows/
    deploy.yml    ← 待建立
```

---

## deploy.yml 結構說明

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]        # 只有 push 到 main 才觸發

permissions:
  contents: read
  pages: write              # 允許寫入 GitHub Pages
  id-token: write           # OIDC 身份驗證（deploy-pages 需要）

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      # 1. 取得原始碼
      - uses: actions/checkout@v4

      # 2. 下載 Tailwind CSS CLI（Linux 版）
      - name: Download Tailwind CSS
        run: |
          curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 -o tailwindcss
          chmod +x tailwindcss

      # 3. 產生 tailwind.css
      - name: Generate CSS
        run: ./tailwindcss -i ./src/input.css -o ./tailwind.css --minify

      # 4. 執行打包腳本（pwsh 在 ubuntu-latest 內建）
      - name: Build prism.html
        run: pwsh ./scripts/build.ps1

      # 5. 將 prism.html 包成 Pages artifact
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/         # build.ps1 需輸出至 dist/ 資料夾

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

## build.ps1 需要的調整

GitHub Pages 部署需要上傳一個**目錄**，而非單一檔案。
需將 `build.ps1` 的輸出路徑改為 `dist/index.html`：

```powershell
# 目前
$outFile = Join-Path $root 'prism.html'

# 改為
$distDir = Join-Path $root 'dist'
if (!(Test-Path $distDir)) { New-Item -ItemType Directory $distDir | Out-Null }
$outFile = Join-Path $distDir 'index.html'
```

這樣 GitHub Pages 的根路徑 `/` 就會直接開啟 `index.html`，URL 更乾淨：
`https://<user>.github.io/<repo>/`

本地 `prism.html` 也可保留（改為同時輸出兩個路徑，或只在 CI 環境輸出至 dist/）。

---

## 快取策略（可選優化）

vendor 檔案（Vue、Mermaid）可加快第二次建置：

```yaml
- name: Cache vendor
  uses: actions/cache@v4
  with:
    path: vendor/
    key: vendor-${{ hashFiles('scripts/build.ps1') }}
```

---

## 完成後的使用方式

| 情境 | 說明 |
|------|------|
| 線上使用 | 瀏覽器直接開啟 GitHub Pages URL |
| 離線使用 | 從 GitHub Pages 下載 `index.html` 存到本機 |
| 本地開發 | 照舊用 `index.html` + Live Server |
