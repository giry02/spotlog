$ErrorActionPreference = 'Stop'
$busanRepoRoot = 'C:/Users/Giry/Documents/Spotlog'
$busanOutputRoot = Join-Path $busanRepoRoot 'artifacts/busan-business-data-20261012'
$busanRecords = @(Get-Content -LiteralPath (Join-Path $busanOutputRoot 'catalog-source-snapshot.json') -Raw | ConvertFrom-Json)
$busanLandmarks = @(Get-Content -LiteralPath (Join-Path $busanRepoRoot 'web/src/busanLandmarkRecords.json') -Raw | ConvertFrom-Json)
$busanResults = @()
foreach ($busanRecord in @($busanRecords + $busanLandmarks)) {
  $busanSourceUrl = if ($busanRecord.sourceUrl) { $busanRecord.sourceUrl } else { 'https://www.visitbusan.net/index.do?menuCd=DOM_000000201002001000&uc_seq=' + $busanRecord.recordId + '&lang_cd=ko' }
  $busanResponse = Invoke-WebRequest -Uri $busanSourceUrl
  $busanHtml = $busanResponse.Content
  if ($busanRecord.recordId.StartsWith('METADATA')) {
    $busanSourceLat = [regex]::Match($busanHtml, "lat: parseFloat\('([^']+)").Groups[1].Value
    $busanSourceLng = [regex]::Match($busanHtml, "lot: parseFloat\('([^']+)").Groups[1].Value
  } else {
    $busanSourceLat = [regex]::Match($busanHtml, 'id="findPath_goal_lat" value="([^"]+)').Groups[1].Value
    $busanSourceLng = [regex]::Match($busanHtml, 'id="findPath_goal_lng" value="([^"]+)').Groups[1].Value
    if (-not $busanSourceLat) {
      $busanSourceLat = [regex]::Match($busanHtml, 'mapObj.default_lat = ([^;]+)').Groups[1].Value
      $busanSourceLng = [regex]::Match($busanHtml, 'mapObj.default_lng = ([^;]+)').Groups[1].Value
    }
  }
  $busanPass = $busanSourceLat -and $busanSourceLng -and [Math]::Abs([double]$busanSourceLat - $busanRecord.lat) -lt 0.0000001 -and [Math]::Abs([double]$busanSourceLng - $busanRecord.lng) -lt 0.0000001
  $busanResults += [pscustomobject]@{
    placeId = $busanRecord.id; name = $busanRecord.name; checkedAt = '2026-10-12'; sourceUrl = $busanSourceUrl
    httpStatus = $busanResponse.StatusCode; registeredLat = $busanRecord.lat; registeredLng = $busanRecord.lng
    sourceLat = $busanSourceLat; sourceLng = $busanSourceLng; matchesOfficialRepresentativePoint = [bool]$busanPass
  }
}
$busanResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $busanOutputRoot 'official-coordinate-checks.json') -Encoding UTF8
$busanFailures = @($busanResults | Where-Object { -not $_.matchesOfficialRepresentativePoint })
@{checked=$busanResults.Count; passed=$busanResults.Count-$busanFailures.Count; failed=$busanFailures.Count} | ConvertTo-Json -Compress
if ($busanFailures.Count) { $busanFailures | ConvertTo-Json -Depth 5; exit 1 }
