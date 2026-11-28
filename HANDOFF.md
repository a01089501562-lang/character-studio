# 작업 재개 메모

## 최신 체크포인트 (2026-11-28)

- 세 파일 제출 시 제출처에서 ‘PNG 파일을 1~2개 선택하세요’ 오류가 발생했다. 사용자는 Google Apps Script 편집기에서 수정했다고 알려왔다. 기존 웹 앱에 새 버전이 배포되었는지와 세 파일의 Drive 저장 여부는 아직 확인되지 않았다.
- 저장소 상위의 로컬 참고 파일 `character-studio-Code.gs`에는 `MAX_FILES = 2`가 남아 있다. 편집기의 최신 소스를 보관하려면 실제 수정본과 대조해야 한다.
- 작품 제출에서 동작 시트(필수), 기본형(선택), 3면도(선택) PNG를 최대 3개까지 받을 수 있도록 웹 폼과 Worker 검증을 갱신했다. 파일별 제한은 10MB다. 로그인 제출의 요청 크기 제한도 세 파일에 맞게 늘렸다.
- 변경 커밋 `e2f0fa7`을 main에 푸시했고 GitHub Pages 공개 주소 `https://a01089501562-lang.github.io/character-studio/`에서 HTTP 200 및 세 번째 파일 입력·최대 3개 안내 반영을 확인했다.
- Cloudflare Worker `character-studio-api`를 배포했다. 운영 버전 `65a0e104-1098-42d1-ba16-ae6c5408e89b`; `/api/v1/health`는 `ok=true`, 공개 사이트 Origin의 CORS preflight는 204로 확인했다.
- 실제 학생 파일 제출, Google Drive 저장 및 이메일 전달은 실행하지 않았다. 제출처까지의 실제 파일 전송은 별도 확인이 필요하다.
- 배포 기록 문서만 이 체크포인트 커밋에 포함한다. 비밀값은 기록하지 않는다.

최종 기록: 2026-11-28 (한국 시간).

## 최신 체크포인트 (2026-11-27)

- 엑셀 내려받기에 `작품 제출 현황` 시트를 추가했다. 로그인한 승인 학생의 제출은 Worker가 기존 작품 제출 Apps Script로 전달하고 성공 응답을 확인한 뒤 D1에 학급·학생별 제출 시각과 캐릭터 이름을 저장한다. PNG 파일은 D1에 저장하지 않는다.
- `0002_submissions.sql` 운영 적용 완료. 변경 전 SQL 백업은 시스템 임시 폴더의 `character-studio-before-submissions-20261127-203545.sql`에 저장했으며 Git에는 포함하지 않았다.
- `SUBMISSION_URL`을 기존 작품 제출 주소로 설정하고 Worker 배포 완료. 버전 `7101c21d-70a1-4c3d-8588-e04e729b17bd`. 운영 health `ok=true` 확인.
- 로컬 API·브라우저·엑셀 테스트 7개 통과. 가짜 제출처로 성공/실패, 학급·학생 권한, 재제출, 현황 저장 실패, 기록 삭제 및 실제 다운로드를 검증했다. 실제 Google 드라이브 업로드·이메일 발송은 이번 검증에서 실행하지 않았다.
- 기존 제출·로그인 전 제출·직접 이메일 제출은 자동 수집되지 않는다. `제출 기록 없음`은 미제출 확정이 아니다. 필수 동작 시트로 완료를 판단하고 선택 3면도는 별도 표시한다. 학급 기록 삭제는 제출 현황도 삭제하지만 Google 드라이브 파일은 삭제하지 않는다.
- 아래 2026-11-25 기록은 인증 설정의 이전 체크포인트이며, 작품 제출 API와 마이그레이션 상태는 이 항목이 우선한다.

## 최신 체크포인트 (2026-11-25)

### 최신 메일 연결 결과 (아래 실패 기록보다 우선)

- 스크린샷에서 `doPost`가 기본 `myFunction` 안에 들어간 원인을 확인했다. 사용자가 바깥 함수 선언과 닫는 괄호를 제거하고 저장·새 배포했다.
- 최신 주소로 Cloudflare의 `MAIL_URL` 갱신 완료: `https://script.google.com/macros/s/AKfycbz9glQQcTNwWERsSrjHpG7xMeb7kSsqC8vvYLKzos0ZHa8kmIWl_5VLA7Ok7dqC5ZVA/exec`
- 교사 이메일로 실제 `/auth/request-code` 요청 성공. challengeId와 expiresIn 300 응답 확인.
- 사용자 실제 메일 수신 확인 완료. 로컬 미리보기에서 사용자가 직접 인증번호를 입력했고 교사 표시를 확인했다. 프록시의 비밀값 없는 상태 기록에서 request-code/verify-code/me/classes 모두 HTTP 200 및 role=teacher 확인.
- 교사 로그아웃 HTTP 200 및 사용자 화면 확인 완료. 사용자가 승인한 테스트 학생 주소로 실제 로그인(role=student), 학급 참여, 교사 승인, 진행 기록 저장(PUT 200), 새로고침 후 재조회(GET 200)까지 완료했다. 사용자가 `저장확인용` 값 유지도 확인했다.
- 교사 화면의 학습 기록 조회 요청도 운영 API에서 HTTP 200 확인 완료. DB에서 테스트 학생의 승인 상태와 `저장확인용` 저장값(version=3)을 확인한 뒤 테스트 진행 기록·학급 관계·학생 세션·학생 인증 요청·학생 계정·테스트 학급만 제거했다. 테스트 학급/학생 잔여 수 모두 0 확인. 교사 계정은 유지했다.
- `config.js`의 `apiUrl`을 운영 API로 활성화하고 커밋 `88cc716`을 main에 푸시했다. `npm test`, `npm run test:browser`, `npm run check:deploy` 재통과. 공개 사이트 출처의 CORS preflight 204 및 허용 출처 확인 완료.
- GitHub Pages의 config.js에 운영 API 반영 확인 완료. 실제 headless Chrome으로 공개 사이트에서 인증번호 받기 버튼 표시, 브라우저에서 운영 API health 200/ok=true, 페이지 JavaScript 오류 0을 확인했다. 공개 주소: `https://a01089501562-lang.github.io/character-studio/`.
- 실제 인증메일·교사/학생 로그인·학생 참여/승인·저장/재조회·교사 조회·교사 로그아웃은 로컬 미리보기에서 운영 API로 검증했다. 공개 사이트에서 인증번호를 다시 발송하는 중복 검증은 하지 않았다. 이제 사용자는 공개 주소에서 교사 이메일로 로그인해 실제 학급을 만들면 된다.
- 로컬 미리보기는 `http://127.0.0.1:8788`, 임시 서버 파일은 `%TEMP%/character-studio-live-preview.cjs`다. 운영 API로 전달하며 임시 config 응답에서만 API를 활성화한다. `/__verification`은 경로·상태·역할만 기록하며 인증번호·토큰·응답 본문은 기록하지 않는다. 프로세스는 세션 종료 시 중단될 수 있다.

### 이전 진행 기록

- Cloudflare OAuth 승인 성공 및 `wrangler whoami`로 로그인 확인 완료. 아래 로그인 실패 기록은 이전 이력이다.
- 기존 D1 목록이 비어 있음을 확인한 뒤 `character-studio`를 APAC에 생성했다. DB ID `0b75110c-fee8-4d4c-89bd-8ddbff826a46`를 `api/wrangler.toml`에 반영했다.
- 운영 DB에 `0001.sql` 마이그레이션 적용 완료(12개 명령).
- `npm test` 4개, `npm run test:browser` 1개, `npm run check:deploy` 통과.
- 사용자가 최초 교사 이메일을 `a01089501562@gmail.com`으로 확인했으며 `TEACHER_EMAILS`에 반영했다.
- 사용자는 Google Apps Script의 `MAIL_SECRET`을 새 값으로 수정했다고 확인했다. 값은 채팅으로 요청하지 않는다. Cloudflare 등록은 완료되지 않았다.
- 계정의 workers.dev 하위 도메인 `character-studio-1f55a0ad` 등록 완료.
- 사용자가 Cloudflare 이메일 인증을 완료한 뒤 Worker 생성/운영 배포 성공. 주소: `https://character-studio-api.character-studio-1f55a0ad.workers.dev`.
- `/api/v1/health`에서 `{"ok":true}` 확인 완료. 이는 실제 메일 연결 검증을 의미하지 않는다.
- `MAIL_URL` 등록 완료. `OTP_SECRET`은 암호학적 난수로 생성해 화면/파일에 출력하지 않고 등록 완료.
- `secret list`로 `MAIL_SECRET`, `MAIL_URL`, `OTP_SECRET` 세 항목 등록 확인 완료. 비밀값 자체는 읽지 않았다.
- 교사 이메일로 실제 `/auth/request-code` 요청을 테스트했으나 HTTP 503(메일 발송 확인 실패)을 반환했다.
- 등록된 Google 웹 앱에 비밀값 없는 빈 JSON POST로 진단한 결과 HTTP 200 HTML에 `다음 스크립트 함수(doPost)를 찾을 수 없습니다.`가 표시됐다. 현재 URL의 배포 코드/버전 확인이 필요하다. 비밀값 불일치 여부는 아직 판단할 수 없다.
- 사용자가 새 배포 URL을 제공해 `MAIL_URL`을 아래 새 주소로 갱신했다. 실제 인증메일 요청은 여전히 503이며, 새 주소의 빈 JSON POST도 `다음 스크립트 함수(doPost)를 찾을 수 없습니다.`를 반환했다.
- 다음은 사용자가 실제 편집/배포한 프로젝트의 `Code.gs`에서 `function doPost(e)` 존재와 저장 여부를 확인하는 것이다. 코드가 들어 있는 프로젝트의 새 버전을 배포한 뒤 메일 검증을 재개한다. `config.js`의 `apiUrl`은 계속 빈 값이다.

## 사용자 요청과 현재 상태

- 사용자는 크레딧 소진에 대비해 저장·커밋·푸시하고 다음 날 이어갈 수 있게 기록해 달라고 요청했다.
- 기존 구현 기준 커밋: `4174438` (로그인·학습 기록 동기화 및 계정 흐름 검증 관련 변경).
- 이번 대화에서는 서비스 코드 변경 없이 실제 인증메일 및 Cloudflare 배포 설정을 진행했다. 운영 배포와 실제 메일 수신 검증은 아직 완료하지 않았다.
- 무료 서비스만 사용한다. 유료 요금제로 전환하지 않는다.

## Google Apps Script

- 사용자는 Google 로그인 후 새 인증메일 프로젝트를 만들고 `api/mail/Code.gs` 내용을 붙여 넣어 저장했다고 확인했다.
- 사용자는 스크립트 속성 `MAIL_SECRET`을 설정했다고 확인했다. 값은 사용자만 보관하며 채팅이나 Git에 기록하지 않는다.
- 웹 앱을 '나로 실행 / 모든 사용자 접근' 설정으로 배포하도록 안내했고 사용자가 아래 URL을 제공했다. 실제 설정과 발송 성공은 아직 검증하지 않았다.
- 인증메일용 웹 앱 URL (`MAIL_URL`로 사용할 주소):
  `https://script.google.com/macros/s/AKfycbzIhQlkmYi0NaRPz07a9PJnkWmwBLVYGVCLBFs0_rD0KT8Wdzz_jfcDiz0IeCfvLWUg/exec`
- 이 주소는 인증메일 전용이다. `config.js`의 기존 작품 제출용 `appsScriptUrl`을 이 주소로 덮어쓰지 않는다.

## 중단 지점: Cloudflare OAuth 대기 시간 초과

- Wrangler `whoami` 결과: 로그인되지 않음.
- `wrangler login`을 실행해 브라우저를 열었지만, 사용자가 가입/로그인하는 동안 CLI가 종료됐다.
- 확인된 CLI 오류: `Timed out waiting for authorization code, please try again.`
- 사용자가 본 주소는 `http://localhost:8976/oauth/callback`, 오류는 `ERR_CONNECTION_REFUSED`였다.
- 로컬 OAuth 수신기가 시간 초과로 종료된 사실과 부합한다. 이 오류만으로 프록시·방화벽 차단이라고 판단하거나 보안 설정을 변경하지 않는다.
- Cloudflare 가입 완료 여부는 확정되지 않았다. 사용자는 처음에는 가입했다고 했지만 이후 가입 버튼을 눌렀고 연결 오류가 발생했다고 정정했다.
- 다음에는 사용자가 준비된 상태에서 `wrangler login`을 새로 실행하고 새 로그인 흐름을 끝낸다. 이전 callback URL이나 OAuth 쿼리는 재사용하지 않는다. 비밀번호는 사용자가 직접 입력한다.

## 다음 작업

1. Cloudflare 로그인 재시도 후 `wrangler whoami`로 인증과 대상 계정을 확인한다.
2. `api/README.md`의 최초 배포 절차를 따른다. 기존 D1이 있는지 확인하고, 필요하면 생성하여 `wrangler.toml`의 DB ID를 설정한다.
3. 최초 교사 이메일을 사용자에게 확인한다. 기존 제출용 이메일을 교사 이메일이라고 임의로 가정하지 않는다.
4. 운영 DB 마이그레이션을 적용한다.
5. Worker 비밀 설정 `MAIL_URL`, `MAIL_SECRET`, `OTP_SECRET`을 등록한다. `MAIL_SECRET`은 Google에 설정한 것과 동일해야 한다. 값은 안전한 직접 입력 방식으로 다루고 Git·로그·채팅에 노출하지 않는다.
6. `npm test`, `npm run test:browser`, `npm run check:deploy`를 실행하고 운영 배포와 health 확인을 진행한다.
7. 사용자와 테스트 계정으로 실제 인증번호 수신·승인·저장·로그아웃을 검증한다. 실제 학생 작업을 테스트로 제출하지 않는다.
8. 모든 연결 검증 후에만 `config.js`의 `apiUrl`을 활성화하고 변경을 검증·커밋·푸시한다.

이전 인계 당시 `TEACHER_EMAILS`는 빈 값, DB ID는 placeholder, `config.js`의 `apiUrl`도 빈 값이었다. 최신 상태는 상단 체크포인트를 따른다.

## 로컬 도구

- 기본 PowerShell PATH에서 `node`, `npm`, `rg`를 찾지 못했다.
- 이번에 사용한 Node 실행 파일: `C:\Users\User\AppData\Local\Temp\character-studio-node\node-v24.22.3-win-x64\node.exe`.
- `api/node_modules/wrangler/bin/wrangler.js`가 존재하며 Wrangler 버전은 4.167.0이었다.
- `api` 폴더에서 실행 예시:

```powershell
& "$env:TEMP/character-studio-node/node-v24.22.3-win-x64/node.exe" node_modules/wrangler/bin/wrangler.js login
```

- 임시 폴더의 Node는 삭제될 수 있으므로 재개 시 존재 여부를 확인한다.
- 이번 세션에는 브라우저/Windows 직접 조작에 필요한 도구가 없어 사용자가 화면을 조작하고 문구를 알려주는 방식으로 진행했다. 재개 시 도구 가용성을 다시 확인한다.

## 인계 검증 범위

이번 인계는 문서 변경만 포함한다. diff와 공백 오류를 확인하며 서비스 테스트를 다시 실행하지 않는다. 실제 운영 배포 성공을 의미하지 않는다.
