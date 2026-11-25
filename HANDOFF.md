# 작업 재개 메모

최종 기록: 2026-11-25 (한국 시간).

## 최신 체크포인트 (2026-11-25)

- Cloudflare OAuth 승인 성공 및 `wrangler whoami`로 로그인 확인 완료. 아래 로그인 실패 기록은 이전 이력이다.
- 기존 D1 목록이 비어 있음을 확인한 뒤 `character-studio`를 APAC에 생성했다. DB ID `0b75110c-fee8-4d4c-89bd-8ddbff826a46`를 `api/wrangler.toml`에 반영했다.
- 운영 DB에 `0001.sql` 마이그레이션 적용 완료(12개 명령).
- `npm test` 4개, `npm run test:browser` 1개, `npm run check:deploy` 통과.
- 사용자가 최초 교사 이메일을 `a01089501562@gmail.com`으로 확인했으며 `TEACHER_EMAILS`에 반영했다.
- 다음은 비밀값 등록, Worker 배포 및 실제 메일/계정 검증이다. Google의 기존 `MAIL_SECRET`은 사용자가 안전한 직접 입력 방식으로 제공해야 하며 채팅으로 요청하지 않는다.
- Worker 운영 배포와 실제 인증메일 검증은 아직 수행하지 않았다. `config.js`의 `apiUrl`은 계속 빈 값이다.

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
  `https://script.google.com/macros/s/AKfycbyJ_6XuxcHRtHH7SfeRuYy_calpuBrj2DOloqjSj9fBcF2qlPgg3z_TlAbURaLHC9zw/exec`
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
