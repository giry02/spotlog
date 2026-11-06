param([switch]$Extend)
$ErrorActionPreference = 'Stop'
$taskRoot = 'C:/Users/Giry/Documents/Spotlog'
$taskAssets = Join-Path $taskRoot 'assets/spotlog/busan-business'
$taskEvidence = Join-Path $taskRoot 'artifacts/busan-business-20261012/media-sources'
New-Item -ItemType Directory -Force -Path $taskAssets, $taskEvidence | Out-Null
$taskTargets = @(
  @{ id='catalog-busan-geumsu'; query='금수복국'; name='금수복국 해운대본점'; address='중동1로43번길 23' },
  @{ id='catalog-busan-bibibidang'; query='비비비당'; name='비비비당'; address='달맞이길 239-16' },
  @{ id='catalog-busan-hanok'; query='하녹'; name='하녹'; address='내리길 146-5' },
  @{ id='catalog-busan-sea-and-tree'; query='씨앤트리'; name='씨앤트리 카페'; address='일광로 808' },
  @{ id='catalog-busan-perli'; query='페를리'; name='페를리'; address='다대로381번길 8' },
  @{ id='catalog-busan-darakjae'; query='다락재'; name='다락재'; address='금곡대로 180' },
  @{ id='catalog-busan-momos-domoheon'; query='도모헌'; name='모모스커피 도모헌점'; address='황령산로7번길 60' },
  @{ id='catalog-busan-momos-yeongdo'; query='모모스커피'; name='모모스커피 영도점'; address='봉래나루로 160' },
  @{ id='catalog-busan-piark'; query='피아크'; name='피아크'; address='해양로195번길 180' },
  @{ id='catalog-busan-waveon'; query='웨이브온'; name='웨이브온커피'; address='해맞이로 286' },
  @{ id='catalog-busan-dohine'; query='도희네'; name='도희네 조개구이'; address='청사포로 157' },
  @{ id='catalog-busan-chunha-chudong'; query='춘하추동'; name='춘하추동밀면'; address='서면문화로 48-1' },
  @{ id='catalog-busan-blackup-saha'; query='블랙업커피'; name='블랙업커피 사하점'; address='낙동남로1233번길 30' },
  @{ id='catalog-busan-mandi'; query='카페만디'; name='카페만디'; address='오작로 104-7' },
  @{ id='catalog-busan-kappadokia'; query='카파도키아'; name='카파도키아'; address='금단로 123-9' },
  @{ id='catalog-busan-namaste'; query='나마스테'; name='나마스테 해운대점'; address='해운대해변로265번길 7' },
  @{ id='catalog-busan-dongnae-pajeon'; query='동래할매파전'; name='동래할매파전'; address='명륜로94번길 43-10' },
  @{ id='catalog-busan-choryang1941'; query='초량1941'; name='초량1941'; address='망양로 533-5' },
  @{ id='public-busan-huinnyeoul'; query='흰여울문화마을'; name='흰여울문화마을'; address='' },
  @{ id='public-busan-songdo'; query='송도해수욕장'; name='송도해수욕장'; address='' },
  @{ id='public-busan-taejongdae'; query='태종대'; name='태종대'; address='' },
  @{ id='public-busan-dongnae'; query='동래읍성'; name='동래읍성'; address='' },
  @{ id='public-busan-jukseong'; query='죽성성당'; name='죽성성당'; address='' },
  @{ id='public-busan-ilgwang'; query='일광해수욕장'; name='일광해수욕장'; address='' }
)
$taskManifest = @()
if ($Extend) {
  $taskManifest = @(Get-Content -LiteralPath (Join-Path $taskAssets 'ATTRIBUTION.json') -Raw | ConvertFrom-Json | Where-Object { $_.placeId -ne 'catalog-busan-namaste' })
  $taskTargets = @(
    @{ id='catalog-busan-gukje-chicken'; query='국제통닭부평본점'; name='국제통닭 부평본점'; address='중구로47번길 33-1' },
    @{ id='catalog-busan-sageori-bunsik'; query='사거리분식'; name='사거리분식'; address='부평2길 39' },
    @{ id='catalog-busan-namcheon-green-tea'; query='남천녹차팥빙수'; name='남천녹차팥빙수'; address='수영로394번길 28' },
    @{ id='catalog-busan-namcheon-eel'; query='남천숯불장어구이'; name='남천숯불장어구이'; address='황령대로489번길 71-1' },
    @{ id='catalog-busan-ogoodthing'; query='오굳띵'; name='오굳띵'; address='전포대로246번길 14' },
    @{ id='catalog-busan-seunggi-hotteok'; query='승기씨앗호떡'; name='승기씨앗호떡'; address='광복로 38' },
    @{ id='public-busan-huinnyeoul'; query='흰여울'; name='흰여울문화마을'; address=''; records=@('METADATA006085','METADATA006339') },
    @{ id='public-busan-taejongdae'; query='태종대'; name='태종대'; address=''; records=@('METADATA009975','METADATA009976') }
  )
}
$taskSkipped = @()
foreach ($taskTarget in $taskTargets) {
  $taskSearchUrl = 'https://archive.visitbusan.net/api/search/kr/gallery?q=' + [uri]::EscapeDataString($taskTarget.query) + '&from=0&size=16'
  $taskResults = if ($taskTarget.records) { @($taskTarget.records | ForEach-Object { @{ id=$_ } }) } else { (Invoke-RestMethod -Uri $taskSearchUrl).gallery.results }
  $taskAdded = 0
  foreach ($taskResult in ($taskResults | Select-Object -First 6)) {
    if ($taskAdded -ge 2) { break }
    $taskSourceUrl = 'https://visitbusan.net/archive/dataSearch/view.nm?dataSid=' + $taskResult.id
    $taskHtml = (Invoke-WebRequest -Uri $taskSourceUrl).Content
    $taskLicense = [regex]::Match($taskHtml, '<div class="ggnrTxt">[\s\S]*?<span>(.*?)</span>').Groups[1].Value.Trim()
    $taskAddress = [regex]::Match($taskHtml, '<div class="adrsContWrap">\s*<div>(.*?)</div>').Groups[1].Value.Trim()
    $taskTitle = [regex]::Match($taskHtml, '<div class="viewTitleBox">([\s\S]*?)</div>').Groups[1].Value.Trim()
    $taskImagePath = [regex]::Match($taskHtml, 'id="thumbnail" src="([^"]+)"').Groups[1].Value
    if ($taskLicense -ne '공공누리 제1유형 : 출처표시' -or -not $taskImagePath.StartsWith('/archive/upload/')) {
      $taskSkipped += @{ placeId=$taskTarget.id; recordId=$taskResult.id; reason='개별 사진 이용 조건'; license=$taskLicense }
      continue
    }
    $taskNormalizedAddress = [regex]::Replace($taskAddress, '\s', '')
    $taskExpectedAddress = [regex]::Replace($taskTarget.address, '\s', '')
    if ($taskExpectedAddress -and -not $taskNormalizedAddress.Contains($taskExpectedAddress)) {
      $taskSkipped += @{ placeId=$taskTarget.id; recordId=$taskResult.id; reason='다른 지점 주소'; actualAddress=$taskAddress; expectedAddress=$taskTarget.address }
      continue
    }
    if (-not $taskExpectedAddress -and -not $taskTitle.Contains($taskTarget.query)) { continue }
    $taskFields = @{}
    foreach ($taskLabel in @('제작자', '발행자', '생산일자')) {
      $taskMatch = [regex]::Match($taskHtml, '<div class="cateName">' + $taskLabel + '</div>\s*<div class="cateCont">([\s\S]*?)</div>')
      $taskFields[$taskLabel] = [regex]::Replace($taskMatch.Groups[1].Value, '<[^>]+>', '').Trim()
    }
    if (-not $taskFields['제작자'] -or -not $taskFields['발행자']) { continue }
    $taskImageUrl = 'https://visitbusan.net' + $taskImagePath
    $taskFilename = $taskTarget.id + '-' + $taskResult.id.ToLower() + '.png'
    $taskAssetPath = Join-Path $taskAssets $taskFilename
    $taskResponse = Invoke-WebRequest -Uri $taskImageUrl -OutFile $taskAssetPath -PassThru
    if (-not $taskResponse.Headers['Content-Type'].StartsWith('image/')) { throw '이미지 응답이 아님: ' + $taskImageUrl }
    Set-Content -LiteralPath (Join-Path $taskEvidence ($taskResult.id + '.html')) -Value $taskHtml -Encoding utf8
    $taskManifest += [ordered]@{
      id=('busan-business-' + $taskResult.id.ToLower()); placeId=$taskTarget.id; title=$taskTarget.name;
      originalTitle=$taskTitle; asset=$taskFilename; sourceUrl=$taskSourceUrl; imageSourceUrl=$taskImageUrl;
      owner=$taskFields['발행자']; author=$taskFields['제작자']; license='공공누리 제1유형';
      licenseUrl='https://www.kogl.or.kr/info/licenseType1.do'; verifiedAt='2026-10-12'; publishedAt=$taskFields['생산일자'];
      address=$taskAddress; coordinateSourceUrl=$taskSourceUrl;
      changes='부산관광아카이브에서 제공하는 축소본 그대로 사용. 화면 비율에 따라 일부가 잘려 보일 수 있음.';
      reuseNote='저작자·출처와 공공누리 제1유형 이용 조건을 표시함.'
    }
    $taskAdded++
  }
  Write-Output ($taskTarget.id + ': ' + $taskAdded + '장')
}
$taskManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskAssets 'ATTRIBUTION.json') -Encoding utf8
$taskSkipped | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskEvidence 'excluded.json') -Encoding utf8
Write-Output ('허용 사진 ' + $taskManifest.Count + '장')
