param(
    [Parameter(Mandatory = $true)]
    [ValidateCount(1, 3)]
    [string[]]$Links,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [string]$YtDlpPath
)

$ErrorActionPreference = "Stop"

foreach ($command in @("ffmpeg", "ffprobe")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is required but was not found in PATH."
    }
}

$output = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) {
    $output = "$output-$(Get-Date -Format 'HHmmss')"
}
New-Item -ItemType Directory -Force -Path $output | Out-Null

if (-not $YtDlpPath) {
    $ytDlpCommand = Get-Command "yt-dlp" -ErrorAction SilentlyContinue
    if ($ytDlpCommand) {
        $YtDlpPath = $ytDlpCommand.Source
    }
}

if (-not $YtDlpPath) {
    $toolDirectory = Join-Path $env:TEMP "ai-video-made-skill-tools"
    $YtDlpPath = Join-Path $toolDirectory "yt-dlp.exe"
    New-Item -ItemType Directory -Force -Path $toolDirectory | Out-Null

    if (-not (Test-Path -LiteralPath $YtDlpPath -PathType Leaf)) {
        $downloadUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $YtDlpPath -UseBasicParsing
    }
}

if (-not (Test-Path -LiteralPath $YtDlpPath -PathType Leaf)) {
    throw "yt-dlp could not be located or downloaded."
}

$analyzeScript = Join-Path $PSScriptRoot "analyze-video.ps1"
$manifest = [System.Collections.Generic.List[object]]::new()

for ($index = 0; $index -lt $Links.Count; $index++) {
    $number = "{0:D2}" -f ($index + 1)
    $itemDirectory = Join-Path $output $number
    $analysisDirectory = Join-Path $itemDirectory "analysis"
    $sourcePath = Join-Path $itemDirectory "source-url.txt"
    $normalizedPath = Join-Path $itemDirectory "video.mp4"
    New-Item -ItemType Directory -Force -Path $itemDirectory | Out-Null

    $url = $Links[$index].Trim()
    Set-Content -LiteralPath $sourcePath -Value $url -Encoding utf8

    $entry = [ordered]@{
        index = $index + 1
        source_url = $url
        status = "pending"
        video_path = $null
        analysis_path = $null
        error = $null
    }

    try {
        if ($url -notmatch '^https?://') {
            throw "Invalid URL: $url"
        }

        $downloaded = $false
        $attempts = @(
            @(),
            @("--cookies-from-browser", "chrome"),
            @("--cookies-from-browser", "edge")
        )

        foreach ($cookieArgs in $attempts) {
            Get-ChildItem -LiteralPath $itemDirectory -File -Filter "download.*" -ErrorAction SilentlyContinue |
                Remove-Item -Force

            $arguments = @(
                "--no-playlist",
                "--no-progress",
                "--newline",
                "--merge-output-format", "mp4",
                "-o", (Join-Path $itemDirectory "download.%(ext)s")
            ) + $cookieArgs + @($url)

            & $YtDlpPath @arguments
            if ($LASTEXITCODE -eq 0) {
                $candidate = Get-ChildItem -LiteralPath $itemDirectory -File -Filter "download.*" |
                    Sort-Object Length -Descending |
                    Select-Object -First 1
                if ($candidate -and $candidate.Length -gt 100KB) {
                    $downloaded = $true
                    break
                }
            }
        }

        if (-not $downloaded) {
            throw "The Douyin media URL could not be resolved by yt-dlp."
        }

        & ffmpeg -hide_banner -loglevel error -y -i $candidate.FullName `
            -map 0:v:0 -map "0:a?" `
            -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p `
            -c:a aac -b:a 192k -movflags +faststart `
            $normalizedPath
        if ($LASTEXITCODE -ne 0) {
            throw "ffmpeg failed to normalize the downloaded video."
        }

        $duration = & ffprobe -v error -show_entries "format=duration" `
            -of "default=noprint_wrappers=1:nokey=1" $normalizedPath
        if (-not $duration -or [double]$duration -le 0) {
            throw "ffprobe could not validate the normalized video."
        }

        & powershell -ExecutionPolicy Bypass -File $analyzeScript `
            -VideoPath $normalizedPath `
            -OutputDirectory $analysisDirectory
        if ($LASTEXITCODE -ne 0) {
            throw "Frame analysis failed."
        }

        $entry.status = "complete"
        $entry.video_path = $normalizedPath
        $entry.analysis_path = $analysisDirectory
    }
    catch {
        $entry.status = "failed"
        $entry.error = $_.Exception.Message
    }

    $manifest.Add([pscustomobject]$entry)
}

$manifestPath = Join-Path $output "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output "Douyin batch processing complete"
Write-Output "Output directory: $output"
Write-Output "Manifest: $manifestPath"
$manifest | Format-Table index, status, video_path, analysis_path, error -AutoSize
