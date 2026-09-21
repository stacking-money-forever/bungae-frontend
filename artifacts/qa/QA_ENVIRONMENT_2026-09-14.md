# 벙개 참가자 QA 환경 — 2026-09-14

## 테스터 접속

- 화면: https://bungae-review-main-20260906-id8vi32s3-justn-hyeoks-projects.vercel.app
- 계정·고정 QA 코드: 이 작업트리의 Git 제외 파일 [QA_ACCOUNTS.local.md](QA_ACCOUNTS.local.md). 요청한 전화번호에 **실제 SMS는 보내지 않는다.** 코드 입력, 오류, 로그인, 모임 생성·참가 UI를 확인하는 격리 환경이다.
- 프로덕션 도메인과 별도 QA DB를 사용한다. 실제 전화번호·개인정보·실제 모임은 입력하지 않는다.

## 배포와 운영 근거

- 프론트엔드 Preview 배포 `dpl_2LLNH1aSytRv7wDpq9ietS6To68w`는 `READY`다. `BUNGAE_API_ORIGIN=https://bungae-qa.justn.me`를 Preview 환경에만 설정했다. 위 미리보기 도메인에만 Vercel 배포 보호 예외를 적용했다.
- 백엔드는 `dfa7a2e`의 JAR을 코드 수정 없이 `rapi-agent:~/bungae-qa`에 별도 Docker Compose 스택으로 배포했다. JAR SHA-256: `beaf8f3e60ea2ba12e8a0dd0f9e76d819fed157baba32d7c81e24affba60d8e4` (로컬·원격 일치). PostgreSQL 16.4, Redis 7.2.5, Cloudflare 전용 터널을 함께 사용한다.
- 익명 공개 화면 `GET /` → `200`; 같은 미리보기의 `GET /v1/meetups` → 백엔드 `401 UNAUTHENTICATED` (`application/problem+json`, `instance=/api/v1/meetups`). QA 서버 컨테이너 4개가 모두 실행 중임을 확인했다.
- QA-3 계정으로 OTP 요청 `202`, 틀린 코드 `401 OTP_INVALID`, 고정 코드 로그인 `201`, 내 프로필 `200`·성인/본인 인증 `true`, 사용한 챌린지 재사용 `401`을 확인했다.
- 390×844 Chromium에서 QA-2 모임 생성 `201` → QA-1 참가 첫 요청 네트워크 중단 → 같은 `Idempotency-Key` 재시도 → `JOINED`와 ‘참여 취소’ 버튼을 확인했다. 가로 overflow는 없었다.

## 운영 명령과 범위

`ssh rapi-agent 'cd ~/bungae-qa && docker compose --env-file qa.env ps'`로 상태를 확인한다. QA 계정·서명 키·DB 암호·터널 자격증명은 서버의 권한 제한 파일에 두고 Git에 넣지 않는다. QA 계정의 OTP 해시와 프로필 인증 완료는 **이 QA DB에만 적용한 트리거**가 제공한다. 백엔드 소스와 프로덕션 DB에는 적용하지 않았다.

이 환경은 **참가자 UX 유저 QA용**이다. 실제 SMS 수신, PortOne/KCP 본인인증, 운영 배포, 참가자 관찰 결과를 증명하지 않는다. Vercel 기존 GitHub Actions 배포 경로는 별도로 실패 상태이고, 이번 미리보기는 로컬 CLI 직접 배포다. 프론트엔드 변경은 미커밋·미푸시다.
