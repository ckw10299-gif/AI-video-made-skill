param(
    [Parameter(Mandatory = $true)]
    [string]$PromptPath,

    [Parameter(Mandatory = $true)]
    [string]$AssetsPath,

    [string]$BridgeUrl = "http://127.0.0.1:8787",
    [ValidateSet("9:16", "16:9", "1:1")]
    [string]$Ratio = "9:16",
    [string]$Resolution = "720p",
    [ValidateRange(1, 15)]
    [int]$Duration = 10,
    [switch]$Submit
)

$ErrorActionPreference = "Stop"

$prompt = Get-Content -Raw -Encoding utf8 -LiteralPath $PromptPath
$assets = Get-Content -Raw -Encoding utf8 -LiteralPath $AssetsPath | ConvertFrom-Json

if (-not $prompt.Trim()) {
    throw "Prompt file is empty: $PromptPath"
}

if (-not $assets -or $assets.Count -eq 0) {
    throw "Assets file must contain at least one item: $AssetsPath"
}

$payload = @{
    prompt = $prompt
    assets = @($assets)
    config = @{
        ratio = $Ratio
        resolution = $Resolution
        duration = $Duration
    }
    submit = [bool]$Submit
} | ConvertTo-Json -Depth 8

$task = Invoke-RestMethod `
    -Method Post `
    -Uri "$BridgeUrl/api/bridge/tasks" `
    -ContentType "application/json; charset=utf-8" `
    -Body $payload

$task | ConvertTo-Json -Depth 8
