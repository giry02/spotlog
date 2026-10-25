# 현재 PC에서 실행하기

프로젝트 루트의 `Spotlog 시작.vbs`를 더블클릭한다. 콘솔을 열지 않고 이미 설치한 Ollama, Flowise, RAG, Moa를 확인하고 꺼져 있는 서비스만 시작한다. 브라우저에서 `http://localhost:3001/`에 접속하면 된다. 실행 중인 정상 서비스는 그대로 재사용한다.

실행 상태는 `.sites-runtime/ai/stack/launcher-status.json`의 `state`에서 확인한다. `starting`은 준비 중, `ready`는 전체 서비스 준비 완료, `failed`는 로그 확인이 필요한 상태다. 시작 명령 출력은 같은 폴더의 `launcher.stdout.log`, `launcher.stderr.log`에 실시간으로 기록한다. 서비스는 독립적으로 준비하므로 Flowise의 첫 로딩이 오래 걸려도 Moa와 RAG는 먼저 시작한다. 명령줄이 필요한 개발자는 기존 `npm run local:start`도 쓸 수 있다.

첫 Node 프로세스만 숨겨도 Vinext/Miniflare가 실행하는 `workerd.exe`가 별도 터미널을 열 수 있었다. 현재 시작기는 이 프로젝트의 Node 자식 프로세스에도 `windowsHide`를 적용하는 `scripts/local-hidden-children.cjs`를 함께 읽는다. 외부 패키지나 Windows의 기본 터미널 설정을 바꾸지 않는다. 이전 방식으로 실행 중인 Moa에는 재시작 후 적용된다.

`npm run dev`, `npm run build`, `npm test`, `npm start`에도 같은 숨김 설정을 적용한다. Node 하위 프로세스에는 절대 경로로 설정을 전달하므로 작업 폴더가 바뀌어도 유지된다. 창 없이 서비스를 켤 때는 `Spotlog 시작.vbs`를 사용한다.

Windows Ollama는 `scripts/launch-windows-ollama.mjs`의 분리된 Node 브리지가 `scripts/start-windows-ollama.ps1`을 비분리·숨김 상태로 유지하고, PowerShell이 Ollama를 숨긴 연결 콘솔과 함께 실행한다. 네이티브 모델 실행기가 숨긴 콘솔을 이어받도록 한 방식이며, Node의 `windowsHide` 설정과 별도로 적용한다. 시작 방법은 그대로 `Spotlog 시작.vbs` 또는 `npm run local:start`다.

Ollama의 `.sites-runtime/ai/stack/ollama.process.json`에서 `pid`는 실제 Ollama, `launcherPid`는 Node 브리지, `supervisorPid`는 PowerShell이다. `launchMode`는 `windows-hidden-attached-console-v1`이고 `state`는 `launching`, `spawned`, `exited`, `failed` 중 하나다. `spawned`는 프로세스 생성 확인이며 HTTP 준비 완료와는 구분한다. 전체 서비스 준비 여부는 기존 `launcher-status.json`의 `ready`를 확인한다. `ollama.stdout.log`·`ollama.stderr.log`에 서비스 출력을 추가 기록하고, `ollama.launch-<launchId>.json`에는 기동 단계와 제한된 오류 코드만 기록한다. 환경변수 값은 시작 descriptor나 진단 파일에 저장하지 않는다. 감독 프로세스가 독점 파일 핸들을 유지해 중복 실행의 기록 덮어쓰기를 막는다.

2026-10-16 실제 확인에서는 기존 분리 방식의 Ollama 창을 네이티브 창 목록에서 1회 포착했고 사용자도 같은 시점에 재발을 알렸다. 새 방식의 콜드 스타트와 이후 15초 관찰에서는 네이티브 창 목록 437회 표본에서 보이는 콘솔 창이 0개였다. 이 결과는 해당 기동·관찰 구간에 한정하며 모델 추론과 UI의 최종 검증 결과를 포함하지 않는다. `MainWindowHandle` 값만으로 창이 나타나지 않았다고 판정하지 않는다.

숨김 시작기는 기존 `.sites-runtime/ai/node-v24.22.0-win-x64/node.exe`를 사용한다. 명령줄 시작과 RAG에는 Node 24 이상이 필요하고, Flowise도 기존 Node 24 런타임을 사용한다. 다른 Node 설치나 키 입력은 필요하지 않다.

첫 실행은 Flowise가 많은 패키지를 읽어 몇 분 걸릴 수 있다. 시작 중인 프로세스 기록이 있으면 재실행해도 해당 프로세스를 기다리며 중복으로 시작하지 않는다. 다른 앱이 필요한 포트를 사용 중이면 `port-conflict`를 출력하고 기존 앱을 종료하지 않는다.

명령 자체가 이미 실행 중이면 `STACK_START_IN_PROGRESS`를 출력한다. 준비 확인이 제한 시간을 넘으면 로그 위치와 실패 상태를 출력하며 실행 중인 다른 프로세스를 종료하지 않는다. 같은 명령을 다시 실행해 준비 상태를 확인할 수 있다.

이 명령은 새 모델이나 패키지를 설치하거나 API 키를 변경하지 않는다. 자동 실행이나 예약 작업도 등록하지 않는다. PC를 재부팅한 다음에는 명령을 다시 실행해야 한다. 로그와 실행 정보는 Git에서 제외한 `.sites-runtime/ai/stack/`에 저장한다.

`Failed to fetch`는 웹앱에 HTTP 응답이 오지 않은 상태다. 현재 PC에서 `localhost:3001`이 열리는지 먼저 확인한다. Flowise(3002), RAG(8765), Ollama(11434)는 앱 서버에서 접근하는 내부 서비스이고 사용자 접속 주소는 Moa의 `localhost:3001`이다.

날씨는 별도 공개 제공처인 Open-Meteo에 요청한다. 이 PC에서 정상 응답이 9초 이상 걸리는 경우를 확인해 조회 제한을 12초로 조정했다. 응답 내용·날짜·단위 검증은 유지하며, 제한 시간을 넘기거나 검증을 통과하지 못하면 확인 실패를 안내한다.
