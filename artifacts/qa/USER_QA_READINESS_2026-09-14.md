# 참가자 유저 QA 준비 상태 — 2026-09-14

판정: **격리된 QA 계정으로 기존 미리보기의 참가 흐름을 검사할 수 있음.** 새로고침 후 원래 모임 복귀 수정은 [로컬 QA](PARTICIPANT_RETURN_LOCAL_2026-09-14.md)에서 검증했지만 아직 미리보기에 배포되지 않았다. 사람 대상 복귀 과제 전에는 수정본과 배포본을 일치시켜야 한다. 실제 SMS 수신·KCP 본인인증 검증은 별개다.

## 현재 QA 환경

- 미리보기: `https://bungae-review-main-20260906-id8vi32s3-justn-hyeoks-projects.vercel.app` (`dpl_2LLNH1aSytRv7wDpq9ietS6To68w`, `READY`). 이 주소에만 Vercel 로그인 보호 예외를 적용했다. 프로덕션 도메인은 QA DB에 연결하지 않았다.
- 백엔드: `https://bungae-qa.justn.me`. `rapi-agent`의 `~/bungae-qa`에 백엔드 `dfa7a2e` 빌드, 별도 PostgreSQL·Redis, 전용 Cloudflare 터널을 배포했다. 백엔드 소스는 변경하지 않았다.
- 공개 미리보기의 `/`는 HTTP 200이고 `/v1/meetups`는 백엔드의 `application/problem+json` `401 UNAUTHENTICATED`를 반환한다. 예전 `404`와 달리 API 경로가 실제 백엔드에 연결됐다.
- 3개 QA 계정은 분리된 DB에서만 고정 테스트 OTP 및 성인·본인 인증 완료 상태로 설정했다. 계정 정보는 Git에서 제외된 [QA_ACCOUNTS.local.md](QA_ACCOUNTS.local.md)에 있다. 실제 문자 발송이나 KCP 요청은 일어나지 않는다.
- 390×844 Chromium에서 QA 계정 로그인, 모임 생성 `201`, 첫 참가 요청의 네트워크 중단, 같은 멱등성 키 재시도 후 `JOINED`, 최종 ‘참여 취소’ 버튼을 확인했다. 가로 overflow는 없었다. **참가자 사람 관찰은 아직 0건**이다.
- QA-3 계정으로 OTP 요청 `202`, 틀린 코드 `401`, 고정 코드 로그인 `201`, 프로필 성인·본인 인증 완료 `200`, 소비된 챌린지 재사용 `401`을 확인했다. 운영 구성과 재시작 명령은 [QA_ENVIRONMENT_2026-09-14.md](QA_ENVIRONMENT_2026-09-14.md)를 따른다.

## 이전 장애(08:52 KST 기준)

## 확인한 사실

- 2026-09-14 08:52 KST, 프론트엔드 작업트리를 Vercel CLI로 직접 프로덕션 배포했다. 배포 ID는 `dpl_FEfoQErrih7quMRQ44YqReRwRqUP`, 상태는 `READY`, 기존 별칭은 `https://bungae-review-main-20260906.vercel.app`이다.
- 당시 프로덕션 공개 주소의 `/`와 `/auth`는 HTTP 200이었지만 `/v1/meetups`와 `/v1/auth/otp-requests`는 HTTP 404였다. 이 도메인은 현재도 QA DB에 연결하지 않았다.
- 이전 GitHub `Deploy production` 실행 `34304528020`은 `vercel pull` 단계에서 `Could not retrieve Project Settings`로 실패했다. 이번 배포는 로그인된 로컬 Vercel CLI를 사용해 이 경로를 우회했으며, GitHub Actions의 자격 증명 문제는 해결하지 않았다.
- 당시 Vercel 프로젝트에 `BUNGAE_API_ORIGIN`이 없었다. 현재는 Preview 환경에만 QA 백엔드 origin을 설정했다.
- 백엔드 저장소의 GitHub deployments는 0건이다. 로컬 백엔드의 기본 설정은 인증 제공자 URL이 비어 있을 때 `VERIFICATION_PROVIDER_UNAVAILABLE`(503)을 반환한다. 공개 환경에서 실제 SMS·본인인증 제공자가 동작한다는 근거는 없다.
- 앞선 로컬 OTP 테스트는 일회성 DB에서 코드를 읽어 진행했다. 실제 사용자 휴대전화로 SMS가 도착하는 경로를 확인한 것이 아니다.

## 프론트엔드에서 바로잡은 계약

- `/v1/*`를 `BUNGAE_API_ORIGIN`의 `/api/v1/*`로 전달한다.
- 본인인증 시작 요청에 백엔드 필수 필드인 HTTPS `returnUrl`을 JSON 본문으로 보낸다. 실제 제공자 연동은 배포 및 제공자 설정 후 확인해야 한다.
- 로컬 실제 백엔드·DB와 390×844 브라우저에서 참가 오류→같은 키 재시도→`JOINED`와 재방문 상태를 확인했다. 자세한 근거는 `PARTICIPANT_LIVE_2026-09-14.md`에 있다.

## 실제 SMS·KCP까지 포함한 QA의 남은 조건

1. NHN SMS 및 PortOne/KCP 제공자 계정을 QA 환경에 연결한다.
2. 실제 휴대전화 OTP 수신과 본인인증 제공자 완료·콜백을 확인한다. 테스트 계정의 고정 OTP·DB 인증 처리를 이 근거로 대체하지 않는다.
3. GitHub Actions의 프로젝트 접근/토큰 문제는 별도로 해결한다.

프론트엔드 코드는 직접 배포했으나 커밋·푸시는 수행하지 않았다. QA 호스트와 테스트 계정은 실사용 데이터와 분리돼 있다.
