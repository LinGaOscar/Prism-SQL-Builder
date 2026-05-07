# scripts/build.ps1
# 離線打包腳本：將所有依賴 inline 進單一 prism.html
# 執行前需先產生 tailwind.css：./tailwindcss.exe -i ./src/input.css -o ./tailwind.css --minify

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# ── 1. vendor 目錄 ──────────────────────────────────────────
$vendorDir = Join-Path $root 'vendor'
if (!(Test-Path $vendorDir)) { New-Item -ItemType Directory $vendorDir | Out-Null }

$vueFile     = Join-Path $vendorDir 'vue.global.js'
$mermaidFile = Join-Path $vendorDir 'mermaid.min.js'

if (!(Test-Path $vueFile)) {
  Write-Host '下載 Vue 3...'
  Invoke-WebRequest -Uri 'https://unpkg.com/vue@3/dist/vue.global.prod.js' -OutFile $vueFile
}
if (!(Test-Path $mermaidFile)) {
  Write-Host '下載 Mermaid.js...'
  Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js' -OutFile $mermaidFile
}

# ── 2. 讀取各資源 ──────────────────────────────────────────
$tailwindCss = [System.IO.File]::ReadAllText((Join-Path $root 'tailwind.css'), [System.Text.Encoding]::UTF8)
$vueJs       = [System.IO.File]::ReadAllText($vueFile, [System.Text.Encoding]::UTF8)
$mermaidJs   = [System.IO.File]::ReadAllText($mermaidFile, [System.Text.Encoding]::UTF8)

# src/ 模組合併順序（依 index.html 的 script 載入順序）
$srcFiles = @(
  'src/parser/ddl-parser.js',
  'src/storage/local-storage.js',
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
  "/* === $_ === */`n" + [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}) -join "`n`n"

# ── 3. 產生 prism.html ──────────────────────────────────────
$html = @"
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prism SQL Builder</title>
  <style>/* === Tailwind CSS === */
$tailwindCss</style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="app"></div>

  <script>/* === Vue 3 === */
$vueJs</script>
  <script>/* === Mermaid.js === */
$mermaidJs
mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
</script>
  <script>
$appJs
</script>
</body>
</html>
"@

$outFile = Join-Path $root 'prism.html'
[System.IO.File]::WriteAllText($outFile, $html, [System.Text.Encoding]::UTF8)

$size = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "✓ prism.html 產生完成，大小：${size} MB" -ForegroundColor Green
