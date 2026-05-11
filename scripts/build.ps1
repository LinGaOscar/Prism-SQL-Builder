# scripts/build.ps1
# 離線打包腳本：將所有依賴 inline 進單一 prism.html
# 執行前需先產生 tailwind.css：./tailwindcss.exe -i ./storage/input.css -o ./storage/tailwind.css --minify

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# ── 1. vendor 目錄 ──────────────────────────────────────────
$vendorDir = Join-Path $root 'vendor'
if (!(Test-Path $vendorDir)) { New-Item -ItemType Directory $vendorDir | Out-Null }

$vueFile = Join-Path $vendorDir 'vue.global.js'

if (!(Test-Path $vueFile)) {
  Write-Host '下載 Vue 3...'
  Invoke-WebRequest -Uri 'https://unpkg.com/vue@3/dist/vue.global.prod.js' -OutFile $vueFile
}

# ── 2. 讀取各資源 ──────────────────────────────────────────
$tailwindCss = [System.IO.File]::ReadAllText((Join-Path $root 'storage/tailwind.css'), [System.Text.Encoding]::UTF8)
$vueJs       = [System.IO.File]::ReadAllText($vueFile, [System.Text.Encoding]::UTF8)

# src/ 模組合併順序（依 index.html 的 script 載入順序）
$srcFiles = @(
  'src/parser/ddl-parser.js',
  'src/storage/idb-handles.js',
  'src/storage/file-system.js',
  'src/storage/md-format.js',
  'src/builder/select-builder.js',
  'src/builder/join-builder.js',
  'src/builder/dml-builder.js',
  'src/components/JoinBuilder.js',
  'src/components/DmlPanel.js',
  'src/components/TablePanel.js',
  'src/components/SqlPreview.js',
  'src/components/ConditionBuilder.js',
  'src/components/SortLimitPanel.js',
  'src/components/ErdPanel.js',
  'src/app.js'
)

$appJs = ($srcFiles | ForEach-Object {
  $path = Join-Path $root $_
  "/* === $_ === */`n" + [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd() + "`n;"
}) -join "`n`n"

# ── 3. 產生 prism.html ──────────────────────────────────────
$browserCheck = ""
$html = @"
<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prism SQL Builder</title>
  <style>/* === Tailwind CSS === */
$tailwindCss</style>
$browserCheck</head>
<body class="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
  <div id="app"></div>

  <script>/* === Vue 3 === */
$vueJs</script>
  <script>
$appJs
</script>
</body>
</html>
"@

# CI 環境（GitHub Actions）輸出至 dist/index.html，本地輸出至 prism.html
if ($env:CI) {
  $distDir = Join-Path $root 'dist'
  if (!(Test-Path $distDir)) { New-Item -ItemType Directory $distDir | Out-Null }
  $outFile = Join-Path $distDir 'index.html'
} else {
  $outFile = Join-Path $root 'prism.html'
}

[System.IO.File]::WriteAllText($outFile, $html, [System.Text.Encoding]::UTF8)

$size = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
$label = if ($env:CI) { 'dist/index.html' } else { 'prism.html' }
Write-Host "✓ $label 產生完成，大小：${size} MB" -ForegroundColor Green
