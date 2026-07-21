param(
    [Parameter(Mandatory = $true)]
    [string]$VideoPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [double]$SampleSeconds = 2.0,
    [double]$SceneThreshold = 0.22
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VideoPath -PathType Leaf)) {
    throw "Video file not found: $VideoPath"
}

foreach ($command in @("ffmpeg", "ffprobe")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is required but was not found in PATH."
    }
}

$video = (Resolve-Path -LiteralPath $VideoPath).Path
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$sceneDirectory = Join-Path $output "scene-frames"

New-Item -ItemType Directory -Force -Path $output | Out-Null
New-Item -ItemType Directory -Force -Path $sceneDirectory | Out-Null

$metadataPath = Join-Path $output "metadata.json"
$overviewPath = Join-Path $output "overview.jpg"
$openingPath = Join-Path $output "opening.jpg"
$scenePattern = Join-Path $sceneDirectory "scene-%04d.jpg"

& ffprobe -v error `
    -show_entries "format=filename,duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels" `
    -of json `
    -i $video | Set-Content -LiteralPath $metadataPath -Encoding utf8

$overviewFilter = "fps=1/$SampleSeconds,scale=240:-1,tile=5x6:padding=4:margin=4"
& ffmpeg -hide_banner -loglevel error -y -i $video `
    -vf $overviewFilter -frames:v 1 $overviewPath

& ffmpeg -hide_banner -loglevel error -y -ss 0 -t 15 -i $video `
    -vf "fps=2,scale=240:-1,tile=5x6:padding=4:margin=4" `
    -frames:v 1 $openingPath

$sceneFilter = "select='gt(scene,$SceneThreshold)',scale=480:-1"
& ffmpeg -hide_banner -loglevel error -y -i $video `
    -vf $sceneFilter -fps_mode vfr $scenePattern

Write-Output "Analysis complete"
Write-Output "Metadata: $metadataPath"
Write-Output "Overview: $overviewPath"
Write-Output "Opening: $openingPath"
Write-Output "Scene frames: $sceneDirectory"

