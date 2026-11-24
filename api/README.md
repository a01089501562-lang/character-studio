# 캐릭터 스튜디오 API 운영

현재 기본 사이트는 그대로 동작합니다. `config.js`의 `apiUrl`이 비어 있으면 온라인 로그인 화면을 표시하지 않습니다. 실제 계정·비밀값을 설정하고 테스트한 뒤 활성화하세요. API는 Cloudflare Workers Free + D1 Free, 인증메일은 별도 Google Apps Script 프로젝트를 사용합니다. 요금제를 유료로 전환하지 마세요.

## 최초 배포

1. Node.js 24 이상을 준비하고 `api` 폴더에서 `npm install`, `npx wrangler login`을 실행합니다.
2. `npx wrangler d1 create character-studio`로 DB를 만들고 반환된 database_id를 `wrangler.toml`에 설정합니다.
3. `TEACHER_EMAILS`에 최초 교사 이메일을 쉼표로 구분해 입력합니다. 교사 권한은 이 목록으로만 부여합니다. ALLOWED_ORIGIN은 현재 GitHub Pages 출처를 유지합니다.
4. `npx wrangler d1 migrations apply character-studio --remote`를 실행합니다. 테스트 시에는 별도 DB를 사용하세요.
5. Google Apps Script에 새 프로젝트를 만들고 `mail/Code.gs`를 붙여 넣습니다. 기존 작품 제출 스크립트를 덮어쓰지 마세요. 스크립트 속성 MAIL_SECRET에 충분히 긴 무작위 비밀값을 설정합니다. 웹 앱은 소유자로 실행하고 외부 요청을 허용하여 배포합니다. 요청 서명 검증이 발송 권한을 보호합니다.
6. `npx wrangler secret put MAIL_SECRET`으로 같은 비밀값을 입력합니다. 별도의 무작위 OTP_SECRET과 웹 앱 /exec 주소 MAIL_URL도 같은 방식으로 설정합니다. 비밀값을 파일이나 GitHub에 넣지 마세요.
7. `npm test`, `npx wrangler deploy --dry-run`, `npx wrangler deploy` 순서로 확인합니다. workers.dev 주소에서 `/api/v1/health`를 확인합니다.
8. 테스트 교사·학생 이메일로 실제 번호 발송, 승인, 저장, 로그아웃을 확인합니다. 테스트 학생 기록을 삭제합니다.
9. `config.js`의 apiUrl을 `https://<Worker 주소>/api/v1`로 설정한 뒤 기존 저장소에 커밋·푸시합니다. 이는 마지막 활성화 단계입니다.

Google 계정의 MailApp 실행 권한을 승인해야 합니다. 학교 관리 정책이 외부 웹 앱을 제한하면 해당 계정으로 발송할 수 없습니다. 최초 교사 이메일·Cloudflare 계정·메일 발송 Google 계정이 준비되지 않으면 실제 배포를 완료할 수 없습니다.

## 인증 및 권한

- POST /auth/request-code: `{email}` → `{challengeId,expiresIn:300}`
- POST /auth/verify-code: `{challengeId,code}` → `{token,expiresAt}`
- 인증은 `Authorization: Bearer <token>`. 학생·교사 세션은 3시간 고정이며 자동 연장하지 않습니다.
- 학급에 승인되기 전에는 기록을 조회하거나 수정할 수 없습니다.
- 학생은 본인의 기록만, 교사는 담당 학급만 접근합니다. API 키는 발급된 학급의 `/progress` GET만 허용합니다.
- 교사 화면에서 키 발급·폐기, 학생 승인·거절·참여 해제, JSON 내려받기와 기록 삭제를 제공합니다.
- 학번은 표시용입니다. 실제 계정은 내부 사용자 ID로 구분합니다. 이메일을 바꾸면 새 계정이 되며 자동 병합하지 않습니다.

## 개발자 호출 예제

키는 외부 서버의 환경변수에 저장합니다. 공개 브라우저 코드에 넣지 마세요.

```sh
curl "$API_URL/classes/$CLASS_ID/progress" -H "Authorization: Bearer $STUDIO_API_KEY"
```

```js
// Node.js 서버
const response = await fetch(`${process.env.API_URL}/classes/${process.env.CLASS_ID}/progress`, {
  headers: {Authorization: `Bearer ${process.env.STUDIO_API_KEY}`}
});
if (!response.ok) throw new Error(`API error: ${response.status}`);
console.log(await response.json());
```

```python
import json, os, urllib.request
request = urllib.request.Request(
    os.environ['API_URL'] + '/classes/' + os.environ['CLASS_ID'] + '/progress',
    headers={'Authorization': 'Bearer ' + os.environ['STUDIO_API_KEY']})
with urllib.request.urlopen(request) as response:
    records = json.load(response)
```

응답 예시: `{"students":[{"id":"...","name":"학생","studentNumber":"20101","notes":{"characterName":"루미"},"checks":{"turn-0":true},"version":1,"updatedAt":1795500000}]}`. 날짜는 Unix 초입니다. 로그인 이메일은 외부 응답에 포함하지 않습니다. 단일 학교·소수 학급용으로 전체 학급 기록을 반환합니다.

401은 재인증 또는 새 키가 필요하며, 403은 접근권한이 없다는 뜻입니다. 409는 기록 버전 충돌이므로 최신 기록을 확인한 뒤 다시 저장합니다. 429는 잠시 기다린 후 재시도합니다. 503은 메일 설정·한도·외부 장애를 확인합니다. 실패 시 성공으로 표시하지 않습니다.

## 운영과 복구

- 수업 전 교사 계정으로 실제 메일 수신과 API health를 확인하세요. MailApp 한도는 같은 계정의 작품 제출 알림과 공유됩니다. 인증메일 하루 상한 80통, 이메일별 시간당 5통, IP별 시간당 120회이며 학교 공용 IP에서 30명 로그인할 수 있습니다.
- Workers 및 D1 무료 한도에 도달하면 요청이 실패합니다. 자동 유료 전환은 하지 않습니다. 무료 서비스는 무중단 제공을 보장하지 않습니다.
- 원문 인증번호·토큰·학생 노트는 서버 로그에 기록하지 않습니다. 접근 로그는 30일 후, 학습 기록은 마지막 저장 365일 후 매일 예약 작업으로 삭제합니다. 화면에서 보관기간을 안내합니다.
- 학급 기록을 필요한 시점에 교사 화면에서 내려받고 안전한 장소에 보관하세요. DB 변경 전 `wrangler d1 export character-studio --remote --output <보안 백업 경로>`로 백업하며 Git에 넣지 않습니다.
- 장애 시 apiUrl을 빈 문자열로 되돌리면 기존 수업 화면을 이용할 수 있습니다. DB는 지우지 않습니다. 온라인 기록은 장애 동안 동기화되지 않습니다.
- 학생 이름·학번·이메일은 계정 관리용으로 남습니다. 계정 폐기는 운영자가 관련 키·세션·진행 기록·학급 관계를 확인한 뒤 DB에서 처리합니다. 자동 이메일 변경·계정 복구 기능은 이번 버전에 없습니다.

## 검증

`npm test`는 SQLite 기반으로 인증번호 단일 사용, 승인 전 차단, 교사 역할, 학생·학급 격리, 버전 충돌, 키 폐기, 세션 만료, 메일 실패를 검사합니다. 실제 Google 수신·Cloudflare D1 배포·태블릿 브라우저 테스트는 별도 운영 검증이며 로컬 테스트로 대체되지 않습니다.
