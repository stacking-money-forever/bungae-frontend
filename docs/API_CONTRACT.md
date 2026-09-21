# 벙개 프론트엔드 ↔ 백엔드 API 계약 참고

> 상태: **HISTORICAL PROPOSAL + IMPLEMENTATION REFERENCE**
> 이 문서는 초기 제안 행을 보존하며 live backend 또는 배포 완료를 보증하지 않는다. 현재 프론트 구현의 정확한 request/response type과 status는 `src/lib/api/` 및 해당 테스트가 기준이고, 제품 완료 여부는 `PRODUCT_COMPLETION_CHECKLIST.md`에서 판정한다. 미해결 결정은 구현에서 추정하지 않는다.

## 1. 기준과 범위

기준 자료:

- [MVP 기능 명세서](<../../bungae-design/벙개_MVP_기능_명세서.md>)
- [페이지·기능 체크리스트](<../../bungae-design/벙개_MVP_페이지_기능_체크리스트.md>)
- [디자인 시스템·실행 원장](../../bungae-design/DESIGN.md)
- 현재 프론트엔드의 `src/app/**/page.tsx` 22개 라우트

계약 원칙:

1. 검증 전 사용자는 탐색만 가능하고 생성·참여는 할 수 없다.
2. 대기 등록은 별도 생성 API가 아니라 `POST /meetups/{meetupId}/join`의 `JOINED | WAITLISTED` 결과다.
3. 정확한 장소 공개는 별도 해제 API가 아니라 `GET /meetups/{meetupId}` 응답의 권한 기반 마스킹이다.
4. 최소 인원·정원·차단 관계·상태 전이는 서버가 한 트랜잭션에서 다시 검증한다.
5. 공개 프로필·탐색 응답에는 실명, 전화번호, 생년월일, 정확한 생활 위치, 신고 이력, 내부 위험 점수를 넣지 않는다.
6. 긍정 인상은 검색·추천·참여 자격 산정에 사용하지 않는다.
7. 알림 전송 실패는 모임 상태 변경을 롤백하지 않는다.
8. 물리 삭제보다 상태 전이와 감사 가능한 논리 삭제를 우선한다.

브라우저 client의 base path는 same-origin `/v1`이다. 분리 배포에서는 `next.config.ts`가 이를 `BUNGAE_API_ORIGIN`의 `/api/v1`로 전달한다. 이 문서의 `/meetups` 같은 표기는 base path 뒤의 **리소스 경로**다.

## 2. 현재 프론트엔드 라우트 인벤토리

| # | 라우트 | 현재 화면 | 주요 계약 영역 |
| ---: | --- | --- | --- |
| 1 | `/` | [탐색 홈](../src/app/page.tsx) | 모임 목록, 필터, 위치, 이미지 |
| 2 | `/filters` | [탐색 필터](../src/app/filters/page.tsx) | 목록 조건·결과 수 |
| 3 | `/meetups/new` | [모임 생성](../src/app/meetups/new/page.tsx) | 장소 검색, 생성·검증 |
| 4 | `/meetups/[meetupId]` | [모임 상세](<../src/app/meetups/[meetupId]/page.tsx>) | 상세·장소 마스킹·참여·신고·차단 |
| 5 | `/meetups/[meetupId]/join` | [참여 완료](<../src/app/meetups/[meetupId]/join/page.tsx>) | `JOINED` 결과 |
| 6 | `/meetups/[meetupId]/waitlist` | [대기 등록](<../src/app/meetups/[meetupId]/waitlist/page.tsx>) | `WAITLISTED`·대기 취소 |
| 7 | `/my-meetups` | [내 모임](../src/app/my-meetups/page.tsx) | 참가·대기·확정·완료 목록 |
| 8 | `/meetups/[meetupId]/quorum-decision` | [제안자 미달 결정](<../src/app/meetups/[meetupId]/quorum-decision/page.tsx>) | `PROCEED` / `CANCEL` |
| 9 | `/meetups/[meetupId]/quorum-update` | [참가자 미달 알림](<../src/app/meetups/[meetupId]/quorum-update/page.tsx>) | 계속 참여·무불이익 취소 |
| 10 | `/meetups/[meetupId]/hub` | [확정 모임 허브](<../src/app/meetups/[meetupId]/hub/page.tsx>) | 정확한 장소·참가자·체크인 상태 |
| 11 | `/meetups/[meetupId]/chat` | [그룹 채팅](<../src/app/meetups/[meetupId]/chat/page.tsx>) | 메시지 목록·전송·신고 |
| 12 | `/meetups/[meetupId]/check-in` | [체크인 실행](<../src/app/meetups/[meetupId]/check-in/page.tsx>) | 코드·일회성 위치 체크인 |
| 13 | `/meetups/[meetupId]/check-in/success` | [체크인 성공](<../src/app/meetups/[meetupId]/check-in/success/page.tsx>) | `CHECKED_IN` 결과 |
| 14 | `/meetups/[meetupId]/attendance` | [출석 기록](<../src/app/meetups/[meetupId]/attendance/page.tsx>) | 노쇼·이의 제기 |
| 15 | `/meetups/[meetupId]/safety-cancel` | [안전 취소](<../src/app/meetups/[meetupId]/safety-cancel/page.tsx>) | 안전 사유 취소·신고 안내 |
| 16 | `/meetups/[meetupId]/feedback` | [비공개 피드백](<../src/app/meetups/[meetupId]/feedback/page.tsx>) | 피드백·긍정 인상 |
| 17 | `/meetups/[meetupId]/connections/select` | [연결 의사 선택](<../src/app/meetups/[meetupId]/connections/select/page.tsx>) | 후보·상호 선택 |
| 18 | `/meetups/[meetupId]/connections/matched` | [상호 연결](<../src/app/meetups/[meetupId]/connections/matched/page.tsx>) | 1:1 메시지·종료·신고·차단 |
| 19 | `/connections` | [연결 목록](../src/app/connections/page.tsx) | 상호 연결 목록·종료 |
| 20 | `/notifications` | [알림 센터](../src/app/notifications/page.tsx) | 읽음·전체 읽음·설정 |
| 21 | `/profile` / `/profile/blocks` | [내 정보](../src/app/profile/page.tsx), [차단 목록](../src/app/profile/blocks/page.tsx) | 프로필·로그아웃·차단 관리 |

위 표의 21번은 `/profile`과 `/profile/blocks` 두 경로를 한 기능군으로 묶었다. 따라서 실제 `page.tsx` 라우트 수는 22개다.

아직 프론트 라우트가 없는 명세 필수 범위: 시작 화면, OTP, 성인·신원 검증, 기본 프로필 설정, 신고 내역 상세, 계정 탈퇴, 별도 운영자 도구.

## 3. 공통 전송 계약

### 3.1 인증·권한

- 사용자 앱: secure + HttpOnly + SameSite 쿠키 세션을 우선 제안한다. 쿠키 방식이면 모든 상태 변경 요청에 CSRF 방어가 필수다.
- 역할: `PARTICIPANT | OPERATOR | ADMIN`.
- 사용자 검증 상태: `NOT_STARTED | PENDING | VERIFIED | FAILED | EXPIRED`.
- 참가자 생성·참여·채팅·체크인·사후 기능은 `VERIFIED`만 허용한다. 탐색 목록·마스킹된 상세는 비로그인 또는 미검증 사용자도 허용할 수 있다.
- 운영자 응답은 역할과 업무 목적에 필요한 최소 필드만 반환하며, 민감정보 열람과 제재를 감사 로그에 남긴다.

### 3.2 성공·오류 envelope

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "serverNow": "2026-09-02T06:30:00Z",
    "nextCursor": null
  }
}
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "모임 상태가 바뀌었어요.",
    "fieldErrors": [{ "field": "startsAt", "code": "OUTSIDE_24_HOURS" }],
    "retryable": false,
    "retryAfterSeconds": null,
    "currentVersion": 12
  },
  "meta": { "requestId": "req_...", "serverNow": "2026-09-02T06:30:00Z" }
}
```

공통 상태 코드:

| HTTP | `error.code` 예 | 프론트 처리 |
| ---: | --- | --- |
| 400/422 | `VALIDATION_ERROR`, `OUTSIDE_24_HOURS`, `PRIVATE_PLACE`, `INVALID_CAPACITY` | 필드 값을 유지하고 첫 오류로 포커스, 필드별 문구 표시 |
| 401 | `AUTH_REQUIRED`, `SESSION_EXPIRED` | 로그인/OTP 흐름으로 이동 후 원래 의도 복원 |
| 403 | `VERIFICATION_REQUIRED`, `ROLE_FORBIDDEN`, `BLOCKED_RELATIONSHIP`, `EXACT_LOCATION_LOCKED` | 제한 이유와 가능한 다음 행동 표시; 민감 데이터는 응답하지 않음 |
| 404 | `NOT_FOUND` | 일반 오류와 구분한 사라진 모임/리소스 상태 |
| 409 | `VERSION_CONFLICT`, `MEETUP_STATE_CHANGED`, `CAPACITY_CHANGED`, `ALREADY_DECIDED` | 최신 리소스를 재조회해 결과 화면 갱신; 사용자의 성공 여부를 추측하지 않음 |
| 410 | `OTP_EXPIRED`, `MEETUP_ENDED` | 만료 상태와 재시작 CTA |
| 429 | `RATE_LIMITED`, `OTP_RATE_LIMITED` | `retryAfterSeconds` 카운트다운, 재전송 비활성화 |
| 500/503 | `INTERNAL_ERROR`, `TEMPORARILY_UNAVAILABLE` | 입력 유지, 재시도 CTA, 파괴적 요청은 같은 idempotency key로 재시도 |

### 3.3 시간·페이지네이션·캐시

- 모든 시각은 ISO 8601 UTC로 전송한다. 화면의 `오늘 18:30`, 시간 그룹, 남은 시간은 `serverNow`와 사용자 시간대로 계산한다.
- 목록은 cursor pagination: `limit` 기본 20, 최대 50. 같은 cursor window의 정렬 기준은 `(startsAt, meetupId)`처럼 안정적이어야 한다.
- 읽기 응답은 `ETag`; 변경 요청은 `If-Match: "<version>"`를 쓴다. 각 변경 성공 응답은 증가한 `version`을 반환한다.
- 탐색 목록은 짧은 캐시를 허용하되, 참여 가능 여부와 인원은 `join` 시 서버가 원자적으로 재확인한다.

### 3.4 중복 요청·동시성

- 다음 요청은 `Idempotency-Key`(UUID)를 필수로 한다: 세션 생성, 모임 생성, 참여/취소, 미달 결정, 메시지 전송, 체크인, 피드백·인상·연결 선택, 신고·차단, 운영자 조치.
- 같은 키+같은 body 재시도는 최초 성공 응답을 그대로 돌려준다. 같은 키+다른 body는 `409 IDEMPOTENCY_KEY_REUSED`다.
- 프론트는 응답 전 CTA를 비활성화하되 이것을 정합성 보장으로 간주하지 않는다.
- 인원 변경, 대기 승급, 미달 결정, 차단 관계 확인, 체크인은 서버 트랜잭션으로 처리한다.

## 4. 공통 데이터 모델과 enum

### 4.1 상태 enum

```ts
type MeetupState =
  | "OPEN"
  | "QUORUM_DECISION_PENDING"
  | "CONFIRMED"
  | "CHECK_IN_OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED_QUORUM"
  | "CANCELLED_SAFETY";

type ParticipationState =
  | "JOINED"
  | "WAITLISTED"
  | "CHECKED_IN"
  | "CANCELLED"
  | "NO_SHOW"
  | "REMOVED";

type AttendanceTrustBand = "NEW" | "STABLE" | "ATTENTION";
type Activity = "MEAL" | "WALK" | "BOARD_GAME" | "CAFE_CHAT";
type AlcoholPolicy = "NONE" | "ALLOWED";
type QuorumDecision = "PROCEED" | "CANCEL";
type CheckInMethod = "CODE" | "LOCATION" | "HOST_APPROVAL";
type VerificationStatus = "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
```

상태 enum은 사용자 화면에 그대로 노출하지 않고 한국어 행동 문구로 매핑한다.

### 4.2 핵심 읽기 모델

```ts
interface PublicProfile {
  userId: string;
  displayName: string;
  ageBand: "18_24" | "25_29" | "30_34" | "35_39";
  interests: Activity[];
  bio: string | null;
  identityVerified: boolean;
  attendanceTrustBand: AttendanceTrustBand;
}

interface PlaceView {
  placeId: string;
  regionLabel: string;             // 참여 전에도 공개 가능한 대략 지역
  venueType: "CAFE" | "RESTAURANT" | "PARK" | "BOARD_GAME_CAFE" | "OTHER_PUBLIC";
  publicPlaceVerified: boolean;
  disclosure: "LOCKED" | "EXACT";
  exact: null | {
    name: string;
    roadAddress: string;
    latitude: number;
    longitude: number;
  };
}

interface MeetupSummary {
  meetupId: string;
  version: number;
  activity: Activity;
  title: string;
  startsAt: string;
  endsAt: string;
  approximateRegion: string;
  distanceMeters: number | null;
  currentParticipants: number;
  minimumParticipants: number;
  capacity: number;
  newParticipantCount: number;
  verifiedParticipantRatio: number;
  expectedCostPerPerson: number;
  alcoholPolicy: AlcoholPolicy;
  state: MeetupState;
  joinAvailability: "JOIN" | "WAITLIST" | "CLOSED" | "VERIFICATION_REQUIRED";
  coverImage: null | {
    url: string;
    altText: string;
    source: "ACTIVITY_DEFAULT" | "CREATOR_UPLOAD";
  };
}

interface MeetupDetail extends MeetupSummary {
  purpose: string;
  format: string;
  supplies: string | null;
  confirmationDeadlineAt: string;
  quorumDecisionDeadlineAt: string | null;
  place: PlaceView;
  proposer: PublicProfile;
  participants: PublicProfile[] | null;
  myParticipation: ParticipationState | null;
  canEdit: boolean;
  canDecideQuorum: boolean;
  canChat: boolean;
  checkIn: {
    opensAt: string;
    closesAt: string;
    status: "LOCKED" | "OPEN" | "DONE" | "CLOSED";
    allowedMethods: CheckInMethod[];
  };
}
```

`PlaceView.exact`와 `participants`는 권한이 없으면 반드시 `null`이다. 숨겨야 하는 값을 빈 문자열·부분 주소·별도 오류 메시지에 섞어 보내지 않는다.

## 5. 인증·검증·프로필 API

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /auth/otp-requests` | 미구현 OTP 시작 | 공개 | `{ phoneNumber, purpose: "SIGN_UP_OR_SIGN_IN" }` | `{ otpRequestId, maskedPhone, expiresAt, resendAvailableAt }` | 전화번호는 다른 응답·로그에 원문 노출 금지 | `Idempotency-Key`; 발송 횟수·IP/번호 rate limit | 발송 중 버튼 잠금; `OTP_RATE_LIMITED` 카운트다운; 실패 시 번호 유지 |
| `POST /auth/sessions` | 미구현 OTP 확인 | 공개 | `{ otpRequestId, code }` | `{ user, isNewUser, sessionExpiresAt, nextStep }`, `nextStep`은 `PROFILE / IDENTITY_VERIFICATION / HOME`; 세션 쿠키 | 응답 전화번호는 마스킹; 원문 code 저장·로그 금지 | `Idempotency-Key`; OTP 1회 소비 원자 처리 | 확인 중 중복 방지; `OTP_INVALID/EXPIRED` 구분; 성공 시 `nextStep` 이동 |
| `DELETE /auth/sessions/current` | `/profile` 로그아웃 | 로그인 사용자 | body 없음 | `204` | 현재 세션만 종료 | DELETE 자체 멱등; 동일 재호출도 `204` | 처리 중 버튼 잠금; 네트워크 실패 시 로그아웃 완료로 오인하지 않음 |
| `POST /identity-verifications` | 미구현 검증 안내 | 로그인 사용자 | `{ returnUrl }` | `{ verificationId, status: "PENDING", providerRedirectUrl, expiresAt }` | 신분증 원본은 애플리케이션 서버에 저장하지 않음; provider 참조는 사용자에게 불필요하면 미노출 | `Idempotency-Key`; 활성 검증 건 재사용 | 시작 중 CTA 잠금; 실패/만료/재시도·고객지원 경로 |
| `GET /identity-verifications/current` | 미구현 검증 결과, `/profile` | 로그인 사용자 | 없음 | `{ status: VerificationStatus, verifiedAt?, failureReason?, retryAllowedAt? }` | 공급자 참조값·원본 문서 비공개 | `ETag`; provider callback과 경합 시 최신 상태 반환 | `PENDING` 진행 안내; `FAILED/EXPIRED` 재시도; 503 폴링 간격 유지 |
| `GET /me` | `/profile`, 가입 프로필 | 로그인 사용자 | 없음 | `{ userId, displayName, ageBand, interests, bio, activityRegion, availability, verificationStatus, attendanceTrustBand, notificationPreferences, version }` | 전화번호는 필요 시 `maskedPhone`만; 내부 위험·신고 정보 금지 | `ETag` | 스켈레톤; 401 로그인; 오류 시 재시도, 이전 개인정보를 다른 계정 세션에 캐시하지 않음 |
| `PATCH /me` | `/profile`, 기본 프로필 설정 | 로그인 사용자 | `{ displayName?, ageBand?, interests?, bio?, activityRegionId?, availability? }` | 갱신된 `/me` 모델 | 실명·검증 상태·출석 신뢰를 이 API로 수정 금지 | `If-Match`; `Idempotency-Key`; 이름 중복 정책은 미정 | 저장 중 잠금; 422 필드 오류와 입력 유지; 409 최신 프로필 재조회 |
| `DELETE /me` | 미구현 계정 탈퇴 | 로그인 사용자 | `{ reauthToken, reason? }` | `{ deletionRequestId, state, effectiveAt }`, `state`는 `SCHEDULED / COMPLETED` | 법적 보존 대상 외 개인정보 접근 차단 | `Idempotency-Key`; 재인증 필수; soft-delete | 영향 확인 모달; 진행 중 잠금; 실패를 완료로 표시하지 않음 |
| `GET /users/{userId}` | 참가자 목록, 연결 화면 | 로그인 사용자 | 없음 | `PublicProfile` | 차단 관계면 `404`; 공개 프로필 필드만 | `ETag` | 404/차단은 상세 비노출; 오류 재시도 |

## 6. 탐색·필터·장소 API

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /meetups` | `/`, `/filters` | 공개 또는 로그인 사용자 | query: `activity[]`, `startsAfter`, `startsBefore`, `latitude?`, `longitude?`, `radiusMeters`, `costMin?`, `costMax?`, `alcoholPolicy?`, `availableOnly`, `cursor`, `limit` | `{ items: MeetupSummary[], totalCount?, nextCursor }` | 정확한 주소·참가자 상세 금지; 로그인 시 차단 관계가 있는 모임 제외 | 안정 정렬; `ETag`; 응답 후 인원 변동 가능 | 스켈레톤; 0건은 필터 초기화/모임 만들기; 위치 거부·지역 미지원·네트워크 오류 분리 |
| `GET /meetups/{meetupId}` | 상세, join/waitlist 결과, 미달, 허브, 체크인, 피드백 | 공개 또는 로그인 사용자 | 없음 | `MeetupDetail` + `version` | 확정된 `JOINED/CHECKED_IN` 참가자 등 정책상 허용된 사용자만 정확한 장소·참가자 목록 제공; 차단 관계면 `404` | `ETag`; 클라이언트의 오래된 상태보다 서버 상태 우선 | 화면 스켈레톤; 404 사라진 모임; 409 후 재조회; 잠긴 주소는 정상 상태로 렌더링 |
| `GET /places/search` | `/meetups/new`, 지역 변경 | 로그인 사용자; 검색 자체는 미검증 허용 가능 | query: `q`, `latitude?`, `longitude?`, `radiusMeters?`, `cursor?` | `{ items: [{ placeId, name, roadAddress, regionLabel, venueType, latitude, longitude, publicPlaceVerified }], nextCursor }` | 사용자의 검색 좌표는 요청 처리 목적 외 저장 금지; provider key 비공개 | 읽기 요청; provider 장애 시 retryable 503 | 검색 debounce/취소; 0건 직접 재검색; `publicPlaceVerified=false` 선택 차단 |

`GET /meetups`의 시간대는 `오늘 저녁` 같은 문자열로 보내지 않는다. 프론트가 절대 시각 범위로 변환하며, 서버는 시작 시각이 현재 `serverNow`부터 24시간 안인지 판단한다.

## 7. 모임 생성·수정·상태 API

### 7.1 생성 요청

```ts
interface CreateMeetupRequest {
  activity: Activity;
  title: string;
  purpose: string;
  format: string;
  supplies: string | null;
  startsAt: string;
  endsAt: string;
  placeId: string;
  minimumParticipants: number;     // 2 이상
  capacity: number;                // minimum 이상, 8 이하
  expectedCostPerPerson: number;
  alcoholPolicy: AlcoholPolicy;
  confirmationDeadlineAt?: string; // 생략 시 startsAt - 60분
  coverMediaId?: string | null;
}
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /meetups` | `/meetups/new` | `VERIFIED` 참가자 | `CreateMeetupRequest` | `201 MeetupDetail`; `state: OPEN`, `myParticipation: JOINED`, 생성자가 첫 참가자 | 비공개 장소 거절; 이미지가 있으면 공개 범위·유해성 검증 | `Idempotency-Key`; 서버 시각 기준 24시간·인원 규칙 원자 검증 | 게시 중 잠금; 422 필드 오류와 입력 유지; 성공 시 생성된 `meetupId` 상세/내 모임으로 이동 |
| `PATCH /meetups/{meetupId}` | 향후 제안자 편집, 허브 장소 변경 | `VERIFIED` 제안자 또는 허용된 운영자 | `Partial<CreateMeetupRequest>` 중 정책상 편집 가능 필드 | 갱신된 `MeetupDetail`과 증가한 `version` | 제안자라도 검증·신뢰·참가 상태 수정 금지; 정확한 장소 변경 알림 본문은 주소 마스킹 | `If-Match`, `Idempotency-Key`; 시작 임박/확정 후 허용 필드 미정 | 저장 중 잠금; 409 최신 값 비교; 실패 시 입력 유지 |
| `GET /me/meetups` | `/my-meetups` | 로그인 사용자 | query: `participationState[]`, `meetupState[]`, `cursor`, `limit` | `{ items: [{ meetup: MeetupSummary, myParticipation, nextAction, nextTransitionAt, place: PlaceView }], nextCursor }` | 정확한 장소는 현재 권한에 맞춰 마스킹; 다른 참가자 정보 불필요 | `ETag`; stable cursor | 그룹별 스켈레톤; 빈 상태; 오류 재시도 |
| `POST /meetups/{meetupId}/quorum-decision` | `/quorum-decision` | `VERIFIED` 제안자만 | `{ decision: QuorumDecision, expectedVersion }` | `{ meetup: MeetupDetail, outcome }`, `outcome`은 `CONFIRMED / CANCELLED_QUORUM` | 비제안자 `403`; `PROCEED`는 현재 참가자 2명 이상 | `Idempotency-Key`, `If-Match`; 결정 마감·현재 인원·기존 결정 원자 확인 | 결정 중 두 CTA 잠금; `ALREADY_DECIDED` 최신 결과 표시; 실패 시 확인창 닫고 이유 표시 |
| `POST /meetups/{meetupId}/cancellations` | 운영·안전 중단; 참가자 화면에는 직접 노출하지 않음 | `OPERATOR/ADMIN`; 제안자 일반 취소는 미정 | `{ reason: "SAFETY", reportId?, expectedVersion }` | `{ meetup, outcome: "CANCELLED_SAFETY" }` | 신고자·상세 사유를 참가자 응답과 알림에서 마스킹 | `Idempotency-Key`, `If-Match`; 상태 변경·환급 없는 MVP 영향·알림 enqueue 원자 기록 | 운영 도구 확인/사유 필수; 참가자 화면은 안전 취소 결과·지원·무불이익 표시 |

모임 hard delete 엔드포인트는 제안하지 않는다. 현재 명세에는 일반 제안자 취소의 lifecycle state가 없으므로 `DELETE /meetups/{id}`를 만들지 않고 미해결 결정으로 둔다.

## 8. 참여·대기·취소·미달 API

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /meetups/{meetupId}/join` | 상세 → `/join` 또는 `/waitlist` | `VERIFIED` 참가자 | `{ expectedVersion }` | `{ participation: { state, waitlistPosition }, meetup }`; `state`는 `JOINED / WAITLISTED` | 차단 관계·안전 제한이면 참가 불가; `JOINED`여도 정확한 장소는 모임 `CONFIRMED` 등 공개 조건 충족 전 잠금 | `Idempotency-Key`, `If-Match`; 자리 판단·참가 등록·대기 순서 원자 처리 | 요청 중 CTA 잠금; 마지막 자리 경합은 성공 응답 `WAITLISTED`; 중복 탭은 한 결과; 종료는 409 |
| `POST /meetups/{meetupId}/participation-cancellations` | `/waitlist`, `/quorum-update`, `/my-meetups`, `/safety-cancel` | 해당 참가자 | `{ reason, detail?, reportId?, expectedVersion }`; `reason`은 `USER / QUORUM_PROCEED_OPTOUT / SAFETY` | `{ participation: { state: "CANCELLED", attendanceImpact }, meetup }`; 영향은 `NONE / PENDING_REVIEW / APPLIED` | 안전 상세·신고 연결은 다른 참가자에게 비공개 | `Idempotency-Key`, `If-Match`; 취소·대기 승급·필요한 lifecycle 재평가를 원자 처리 | 확인 모달; 처리 중 잠금; 성공 전 화면에서 제거 금지; 경합 시 최신 결과 표시 |
| `GET /meetups/{meetupId}/participation/me` | join/waitlist 결과, 내 모임 | 로그인 사용자 | 없음 | `{ state, waitlistPosition, cancellableUntil, cancellationImpact, version }`; `state`는 `ParticipationState` 또는 `null` | 본인 상태만 | `ETag` | 결과 화면 새로고침 복구; 없음은 참여 전 상태; 오류 재시도 |

대기 승급은 서버 작업 큐가 FIFO 정책과 차단 관계를 재검증해 처리하고 `WAITLISTED → JOINED`를 원자적으로 기록한다. 프론트는 알림만으로 성공을 확정하지 않고 상세/내 모임을 재조회한다.

## 9. 그룹 채팅 API

```ts
type GroupMessageKind = "USER" | "SYSTEM" | "SAFETY_NOTICE";
type GroupSystemEvent =
  | "MEETUP_CONFIRMED"
  | "PLACE_CHANGED"
  | "QUORUM_PROCEED"
  | "MEETUP_CANCELLED";
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /meetups/{meetupId}/messages` | `/chat` | 확정된 `JOINED/CHECKED_IN` 참가자 | query: `before?`, `limit` | `{ items: [{ messageId, kind, sender: PublicProfile|null, text, systemEvent?, createdAt, version }], nextCursor }` | 확정 참가자 외 `403`; 연락처 자동 공개 금지; 차단 시 접근·상대 콘텐츠 정책 미정 | 안정 cursor; `ETag`; 삭제/운영 숨김은 tombstone 처리 | 첫 로딩 스켈레톤; 빈 채팅; 이전 메시지 로딩; 접근 종료와 네트워크 오류 분리 |
| `POST /meetups/{meetupId}/messages` | `/chat` | 확정된 `JOINED/CHECKED_IN` 참가자 | `{ clientMessageId, text }` | `201 { messageId, kind: "USER", sender, text, createdAt, version }` | 메시지 길이·금칙/안전 정책 적용; 시스템 메시지 위조 금지 | `Idempotency-Key`; `clientMessageId` 사용자 범위 unique | optimistic 항목은 전송 중 표시; 실패/재전송; 같은 key 재전송으로 중복 방지 |

실시간 수신 전송 방식(WebSocket/SSE/short polling)은 미정이다. 어떤 방식을 택해도 REST pagination과 `messageId/version`을 복구 기준으로 유지한다. 메시지 신고는 공통 `POST /reports`에서 `targetType: MESSAGE`로 처리한다.

## 10. 체크인·출석 API

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /meetups/{meetupId}/check-in-context` | 허브, `/check-in` | 확정 참가자 | 없음 | `{ status, opensAt, closesAt, allowedMethods, locationRationale, version }`; `status`는 `LOCKED / OPEN / DONE / CLOSED` | 참가자에게 정답 체크인 코드를 내려주지 않음; 위치는 일회성 검증 목적 | `ETag`; 서버 시각 기준 상태 | 잠김 CTA/카운트다운; 권한 거부 시 코드 대체; 오류 재시도 |
| `POST /meetups/{meetupId}/check-ins` | `/check-in` → `/check-in/success` | 확정 참가자 | `{ method: "CODE", code, expectedVersion }` 또는 `{ method: "LOCATION", latitude, longitude, accuracyMeters, capturedAt, expectedVersion }` | `{ participation: { state: "CHECKED_IN", checkedInAt, method }, meetupState, version }`; 모임 상태는 `CHECK_IN_OPEN / IN_PROGRESS` | 좌표는 체크인 판정 후 최소 보존; 다른 참가자에게 원좌표 비공개 | `Idempotency-Key`, `If-Match`; 시간창·코드/거리·중복을 원자 판정 | 확인 중 잠금; `CHECK_IN_NOT_OPEN`, `CODE_INVALID`, `LOCATION_MISMATCH`, `LOCATION_TOO_IMPRECISE`; 이미 성공이면 성공 결과 복구 |
| `GET /meetups/{meetupId}/attendance/me` | `/attendance` | 해당 참가자 | 없음 | `{ participationState, evidence, trustImpact, appeal }`; `trustImpact`는 `NONE / PENDING / APPLIED` | 원좌표·다른 사용자 증거 비공개 | `ETag` | 근거 로딩; 기록 없음 정상 상태; 오류 재시도 |
| `POST /meetups/{meetupId}/attendance-appeals` | `/attendance` | `NO_SHOW` 또는 검토 대상 참가자 | `{ reason, detail?, evidenceMediaIds? }`; `reason`은 `ATTENDED / SAFETY / RECORD_REVIEW` | `201 { appealId, status: "RECEIVED", trustImpact: "PENDING", createdAt }` | 안전 상세·증거는 운영자 최소 권한만 | `Idempotency-Key`; 활성 appeal 하나; 처리 전 신뢰 반영 보류 정책 권장 | 제출 중 잠금; 접수와 승인 구분; 상태는 알림/재조회; 증거 업로드 실패 분리 |

## 11. 피드백·긍정 인상 API

```ts
type FeedbackScore = 1 | 2 | 3 | 4;
type Impression = "ON_TIME" | "CONSIDERATE" | "EASY_TO_TALK_TO" | "HELPFUL_FACILITATOR";
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /meetups/{meetupId}/post-meeting/me` | `/feedback`, `/connections/select` | 같은 모임 `CHECKED_IN` 참가자 | 없음 | `{ eligibility, feedback: { disposition, answers? }, impressionCandidates: PublicProfile[], connectionCandidates: PublicProfile[], closesAt }` | 후보는 같은 모임 체크인 참가자만; 차단 관계 제외 | `ETag` | 로딩; 후보 0명; 미자격/기간 종료; 오류 재시도 |
| `PUT /meetups/{meetupId}/feedback/me` | `/feedback` | 같은 모임 `CHECKED_IN` 참가자 | 제출은 `{ disposition: "SUBMITTED", expectationFit, safety, comfort, reuseIntent }`; 미루기/건너뛰기는 `disposition: DEFERRED / SKIPPED` | `{ disposition, submittedAt?, editableUntil? }` | 비공개; 공개 프로필·검색·순위·참가 자격에 노출 금지 | `Idempotency-Key`; 본인+모임 unique upsert; `If-Match` 선택 | 제출 중 잠금; `DEFERRED/SKIPPED`도 실패 시 완료 문구 금지; 입력 유지 |
| `PUT /meetups/{meetupId}/impressions/me` | `/feedback` | 같은 모임 `CHECKED_IN` 참가자 | `{ recipients: [{ userId, impressions: Impression[] }] }` | `{ saved: true, recipientCount }` | 수신자별 원 발신자 공개 여부는 정책 미정; 합산 인기 점수 금지 | `Idempotency-Key`; 사용자+모임+수신자+tag unique upsert | 저장 중 잠금; 일부 성공 금지(전체 원자); 실패 시 선택 유지 |

## 12. 상호 연결·1:1 API

```ts
type NextAction = "SAME_GROUP" | "SAME_ACTIVITY_NEW_PEOPLE" | "DIFFERENT_ACTIVITY";
type ConnectionState = "ACTIVE" | "ENDED" | "BLOCKED";
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PUT /meetups/{meetupId}/connection-intents/me` | `/connections/select` | 같은 모임 `CHECKED_IN` 참가자 | `{ selectedUserIds: string[], nextAction?: NextAction }` | `{ saved: true, matches: [{ connectionId, counterpart: PublicProfile }] }` | 한쪽 선택 상태·선택자 목록은 상대에게 비공개; 차단 관계 제외 | `Idempotency-Key`; 선택 집합 원자 교체; 쌍방 일치 시 connection unique 생성 | 저장 중 잠금; 성공 전 공개 금지; 409 후보 변경 시 재조회 |
| `GET /connections` | `/connections` | 로그인 사용자 | query: `state=ACTIVE`, `cursor`, `limit` | `{ items: [{ connectionId, counterpart: PublicProfile, sourceMeetup, createdAt, state, version }], nextCursor }` | 본인 연결만; 차단 관계 즉시 제외 | `ETag`; 안정 cursor | 스켈레톤; 0건 빈 상태; 오류 재시도 |
| `GET /connections/{connectionId}` | `/connections/matched` | 연결 당사자 | 없음 | `{ connectionId, counterpart, sourceMeetup, state, canMessage, version }` | 당사자 외 `404`; 종료/차단 후 최소 결과만 | `ETag` | 연결됨/종료/차단 상태 분리; 오류 재시도 |
| `GET /connections/{connectionId}/messages` | `/connections/matched` | `ACTIVE` 연결 당사자 | query: `before?`, `limit` | `{ items: [{ messageId, senderId, text, createdAt }], nextCursor }` | 연결 당사자만; 종료 후 보존/열람 정책 미정 | 안정 cursor; `ETag` | 빈 대화; 과거 로딩; 접근 종료와 오류 분리 |
| `POST /connections/{connectionId}/messages` | `/connections/matched` | `ACTIVE` 연결 당사자 | `{ clientMessageId, text }` | `201 { messageId, senderId, text, createdAt }` | 차단/종료 상태 재검증; 연락처는 자동 공개하지 않음 | `Idempotency-Key`; client id unique | 전송 중/실패/재시도; 차단 경합 시 작성 내용 보존 후 전송 불가 안내 |
| `DELETE /connections/{connectionId}` | `/connections`, `/connections/matched` | 연결 당사자 | body 없음 | `{ connectionId, state: "ENDED", endedAt, version }` | 상대에게 종료 사유 비공개; 1:1 전송 즉시 차단 | DELETE 멱등; `If-Match`; block과 경합하면 최종 `BLOCKED` 우선 | 확인 모달; 성공 후 목록 제거; 실패 시 유지; 이미 종료면 동일 결과 |

## 13. 알림 API

```ts
type NotificationType =
  | "JOINED" | "WAITLISTED" | "QUORUM_MET" | "QUORUM_DECISION_REQUIRED"
  | "QUORUM_PROCEED" | "MEETUP_CANCELLED" | "WAITLIST_PROMOTED"
  | "STARTS_IN_60_MIN" | "CHECK_IN_OPEN" | "PLACE_CHANGED"
  | "REPORT_STATUS_CHANGED" | "CONNECTION_MATCHED";
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /notifications` | `/notifications` | 로그인 사용자 | query: `unreadOnly?`, `cursor`, `limit` | `{ items: [{ notificationId, type, title, body, occurredAt, readAt, destination }], unreadCount, nextCursor }` | 제목/body에 정확한 주소·신고자·안전 상세 금지; destination은 앱 내부 allowlist | `ETag`; cursor | 스켈레톤; 빈 상태; 오류 재시도 |
| `PATCH /notifications/{notificationId}` | 알림 행 탭 | 알림 소유자 | `{ read: true }` | `{ notificationId, readAt }` | 본인 알림만 | `If-Match` 선택; 멱등 upsert | 이동은 로컬 즉시 가능하되 읽음 실패 재동기화; 민감 화면은 인증 확인 |
| `POST /notifications/read-all` | `/notifications` 모두 읽기 | 로그인 사용자 | `{ through: string }` | `{ readCount, readThrough }` | 본인 알림만 | `Idempotency-Key`; `through` 이전만 처리해 새 알림 보존 | 처리 중 버튼 잠금; 실패 시 기존 읽음 상태 복원/재조회 |
| `GET /me/notification-preferences` | `/notifications`, `/profile` | 로그인 사용자 | 없음 | `{ service: { push, sms }, marketing: { push, sms, consentedAt }, version }` | 마케팅 동의와 필수 서비스 알림 분리 | `ETag` | 로딩; 오류 재시도 |
| `PATCH /me/notification-preferences` | 알림 설정 | 로그인 사용자 | `{ service?, marketing? }` | 갱신 설정+`version` | 필수 법적/안전 알림을 마케팅 토글로 끌 수 없음 | `If-Match`, `Idempotency-Key`; 동의 이력 기록 | 저장 중 잠금; 항목별 실패·재시도; 성공 전 토글 확정 금지 |

## 14. 신고·차단·미디어 API

```ts
type ReportTarget = "USER" | "MEETUP" | "MESSAGE" | "CONNECTION";
type ReportReason =
  | "SAFETY_THREAT" | "HARASSMENT_HATE" | "DISGUISED_DATING_SEXUAL"
  | "SOLICITATION_RELIGION_MLM" | "PRIVACY_VIOLATION"
  | "FALSE_PLACE_OR_PURPOSE" | "NO_SHOW_OR_REPEATED_LATENESS" | "OTHER";
type ReportStatus = "RECEIVED" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
```

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /media/upload-requests` | 신고 증거, 향후 모임 사진 | 로그인 사용자 | `{ purpose, fileName, contentType, sizeBytes, checksum }`; `purpose`는 `REPORT_EVIDENCE / MEETUP_COVER` | `{ mediaId, uploadUrl, uploadHeaders, expiresAt }` | 짧은 만료 signed URL; MIME/크기 allowlist; EXIF 위치 제거 정책 | `Idempotency-Key`; checksum 기반 중복 가능 | 업로드별 진행/취소/실패; 제출 전에 완료 확인 |
| `POST /media/{mediaId}/complete` | 증거/사진 업로드 완료 | 업로드 소유자 | `{ checksum }` | `{ mediaId, status }`; `status`는 `PROCESSING / READY / REJECTED` | 악성 파일·유해 콘텐츠 검사 전 공개 금지 | `Idempotency-Key`; 상태 단조 전이 | 검사 중 표시; 거절 이유와 재선택; 신고 본문은 유지 |
| `POST /reports` | 상세, 채팅, 연결, 안전 취소 | 로그인 사용자 | `{ targetType, targetId, reason: ReportReason, urgent, detail?, evidenceMediaIds? }` | `201 { reportId, status: "RECEIVED", priority, createdAt }`; `priority`는 `URGENT / NORMAL` | 신고자 신원·상세·증거를 대상에게 비공개; 긴급은 우선 큐 | `Idempotency-Key`; 접수와 운영 해결 분리; 동일 클릭 중복 방지 | 제출 중 잠금; 필수 사유; 접수 완료만 표시; 긴급전화는 API 성공과 독립 제공 |
| `GET /me/reports` | 미구현 신고 내역, `/profile` | 로그인 사용자 | query: `cursor`, `limit` | `{ items: [{ reportId, targetSummary, reason, status: ReportStatus, createdAt, updatedAt }], nextCursor }` | 대상·운영 메모 최소화; 타 신고자·내부 위험 점수 금지 | `ETag` | 스켈레톤; 빈 상태; 오류 재시도 |
| `GET /me/reports/{reportId}` | 신고 상태 알림 destination | 신고자 | 없음 | `{ reportId, targetSummary, reason, status, userVisibleResolution?, createdAt, updatedAt }` | 내부 심사·제재·민감 정보 제외 | `ETag` | 접수/처리/결과 구분; 404 비노출 |
| `POST /me/blocks` | 상세·연결 차단 | 로그인 사용자 | `{ blockedUserId, source }`; `source`는 `PROFILE / MEETUP / MESSAGE / CONNECTION` | `201 { blockedUser: PublicProfile, blockedAt }` | 즉시 상호 프로필·모임·연결 노출 중단; 기존 연결 종료; 차단 사실의 상대 알림 여부는 미정 | `Idempotency-Key`; 관계 양방향 visibility 차단과 연결 종료 원자 처리 | 확인 모달; 처리 중 잠금; 성공 후 화면 숨김; 실패 시 숨긴 척하지 않음 |
| `GET /me/blocks` | `/profile/blocks` | 로그인 사용자 | query: `cursor`, `limit` | `{ items: [{ blockedUser: PublicProfile, blockedAt }], nextCursor }` | 본인만; 차단 목록은 상대에게 비공개 | `ETag` | 스켈레톤; 0건 빈 상태; 오류 재시도 |
| `DELETE /me/blocks/{blockedUserId}` | `/profile/blocks` | 로그인 사용자 | 없음 | `204` | 해제 후 이후 탐색/프로필에 다시 노출 가능; 과거 연결 자동 복구 금지 | DELETE 멱등; cache invalidation | 확인 모달; 성공 후 행 제거/포커스 복원; 실패 시 행 유지 |

`/meetups/[meetupId]/safety-cancel`은 현재 문구상 **개인 안전 사유 참여 취소**와 **전체 모임 `CANCELLED_SAFETY`**가 섞여 있다. 참가자 행동은 `participation-cancellations(reason=SAFETY)`와 필요 시 `POST /reports`, 전체 모임 중단은 운영자 `POST /meetups/{id}/cancellations`로 분리하는 것을 제안한다.

## 15. 운영자 API (별도 운영 도구)

현재 참가자 프론트에는 운영자 라우트가 없다. 아래는 기능 명세를 충족하기 위한 별도 도구 계약이며 참가자 번들에서 호출하지 않는다.

| Method / path | 발생 화면 | 인증·역할 | 요청 | 응답·상태 | 권한·마스킹 | 중복·버전·동시성 | 로딩·빈·오류 UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /admin/reports` | 별도 신고 큐 | `OPERATOR/ADMIN` | query: `priority`, `reason`, `status`, `cursor`, `limit` | 신고 요약 목록; `URGENT` 우선 안정 정렬 | 기본 응답 최소 정보; 민감 필드 없음 | cursor/ETag | 큐 로딩·빈·오류; 긴급 우선 표시 |
| `GET /admin/reports/{reportId}` | 신고 검토 | 허용된 운영자 | query/header: 업무 사유 | 신고·대상·허용된 맥락·증거 | 민감정보 열람 사유 필수; 열람 감사 로그 자동 기록 | `ETag`; evidence access 단기 URL | 증거 로딩/만료/권한 오류 분리 |
| `POST /admin/reports/{reportId}/actions` | 신고 조치 | 허용된 운영자 | `{ action, reason, expectedVersion }`; action은 `WARN_USER / RESTRICT_USER / RESTRICT_MEETUP / CANCEL_MEETUP_SAFETY / CLOSE_NO_ACTION` | `{ report, actionRecord, affectedResourceVersions }` | 최소 권한; 신고자 보호; 사용자 알림에는 민감 사유 마스킹 | `Idempotency-Key`, `If-Match`; 제재·감사·상태 변경 원자 기록, 알림은 비동기 | 영향 확인; 실행 중 잠금; 부분 성공 금지; 충돌 재조회 |
| `GET /admin/attendance-appeals` | 노쇼 이의 큐 | 운영자 | query: `status`, `cursor`, `limit` | 이의 요약 목록 | 필요한 체크인·취소·상태 기록만 | cursor/ETag | 로딩·빈·오류 |
| `POST /admin/attendance-appeals/{appealId}/decision` | 이의 처리 | 운영자 | `{ decision, reason, expectedVersion }`; `decision`은 `APPROVE / REJECT` | `{ appeal, attendanceTrustImpact, auditRecordId }` | 안전 상세 최소 공개; 사용자용 결과 별도 | `Idempotency-Key`, `If-Match`; 신뢰 반영과 감사 원자 | 확인·진행·충돌·완료 구분 |
| `GET /admin/audit-logs` | 감사 로그 | `ADMIN` 또는 감사 역할 | query: `actorId?`, `resourceType?`, `action?`, `from`, `to`, `cursor` | append-only 감사 목록 | 원문 비밀·OTP·신분증 금지; 조회 자체도 감사 | append-only; cursor | 로딩·빈·권한 오류 |
| `GET /admin/metrics` | 운영 지표 | 허용된 운영자 | query: `from`, `to`, `regionId?` | 성사·체크인·취소·안전 신고율·처리시간 집계 | 소수 집단 재식별 방지 threshold | snapshot timestamp 반환 | 로딩·빈 기간·오류; 데이터 시각 명시 |

## 16. 화면별 로딩·빈·오류 최소 계약

| 화면군 | 로딩 | 빈 상태 | 권한/정책 상태 | 재시도·복구 |
| --- | --- | --- | --- | --- |
| 탐색/필터 | 목록 구조 스켈레톤, 기존 필터 유지 | 조건에 맞는 모임 없음 + 초기화/생성 | 위치 권한 없음, 지역 미지원, 미검증 참여 제한 | GET만 재시도; 위치 없이 지역 기반 탐색 제공 |
| 상세 | 제목/조건/CTA 스켈레톤 | 404 사라진 모임 | 주소 잠금은 정상 상태; 차단은 `404`; 미검증은 인증 CTA | 상태 충돌 시 상세 재조회 |
| 생성/수정 | 기존 입력 유지, CTA만 잠금 | 해당 없음 | 검증 필요, 공개 장소 아님 | 필드 오류로 이동; 503은 같은 key 재시도 |
| 참여/대기/취소 | 해당 CTA만 진행 상태 | 내 참여 없음 | 모집 종료·차단·검증 필요 | 409 후 최신 `MeetupDetail`과 `participation/me` 조회 |
| 미달 결정 | 최신 인원·마감 로딩 | 해당 없음 | 제안자 전용, 2명 미만 진행 불가 | 이미 결정됨은 결과 화면; 동일 요청 재시도 |
| 허브/채팅 | 참가 권한 확인 후 콘텐츠 로딩 | 빈 채팅 | 미확정/취소/제거/차단 접근 불가 | 메시지는 실패 표시와 같은 key 재전송 |
| 체크인/출석 | 서버 시각·가능 방법 로딩 | 기록 없음은 출석 화면의 정상 근거 | 시간창 밖, 위치 거부, 코드 오류, 노쇼 | 코드 대체 경로; 이미 체크인 성공 복구 |
| 피드백/연결 | 자격·후보 로딩 | 후보 없음 | 체크인 사용자만, 기간 종료, 한쪽 선택 비공개 | 선택 유지; 후보 변경 시 재조회 |
| 알림 | 행 스켈레톤 | 알림 없음 | 정확 주소·신고자 preview 금지 | 읽음 실패 재동기화; destination allowlist |
| 신고/차단 | 제출/처리 대상만 잠금 | 신고·차단 내역 없음 | 신고자 비공개, 차단 즉시 상호 숨김 | 접수와 해결 구분; 실패 시 숨김/완료로 오인 금지 |

## 17. 구현 권장 순서

1. 공통 envelope·오류 코드·세션·`GET/PATCH /me`.
2. `GET /meetups`, `GET /meetups/{meetupId}`, `GET /places/search`, `POST /meetups`.
3. 참여/취소/대기 승급과 `GET /me/meetups`.
4. quorum state machine과 작업 큐.
5. 허브 권한·장소 마스킹·그룹 채팅·체크인.
6. 피드백·긍정 인상·상호 연결.
7. 알림·신고·차단·출석 이의.
8. 별도 운영자 도구와 감사·지표.

각 단계는 성공 happy path만 연결하지 않고 해당 표의 권한·경합·중복·오류 상태까지 같이 완료한다.

## 18. 구현 전 미해결 결정

| ID | 결정 필요 | 현재 제안 / 영향 |
| --- | --- | --- |
| `D-01` | API host, version prefix, cookie/CORS/CSRF 방식 | same-origin HttpOnly cookie 우선; 배포 구조와 함께 확정 |
| `D-02` | OTP·성인/신원 검증 공급자, callback·보존 기간 | 앱 서버는 원본 신분증 미보관; 법률/보안 검토 필요 |
| `D-03` | 장소·지도 공급자와 공개 장소 판정 기준 | backend proxy 검색을 제안; provider 약관·비용·좌표 보존 검토 |
| `D-04` | 홈 사진 출처 | 활동 기본 이미지인지 제안자 업로드인지 결정; 후자면 저작권·moderation·EXIF 제거 필요 |
| `D-05` | 일반 제안자 취소 lifecycle | 현재 enum에는 `CANCELLED_HOST`가 없음; state 추가 또는 허용 시점/결과 정의 전 hard delete 금지 |
| `D-06` | 확정 마감(기본 시작 60분 전)과 미달 결정 마감(시작 30분 전) 사이의 정확한 작업 큐 순서 | `OPEN → QUORUM_DECISION_PENDING → 30분 마감 자동 취소` 제안 |
| `D-07` | 대기 순서 공개·자동 승급 정책 | FIFO 자동 승급 제안; 위치 숫자 공개 여부 결정 |
| `D-08` | 확정 후 참가 감소 시 `CONFIRMED → QUORUM_DECISION_PENDING` 조건과 무불이익 취소 마감 | 서버 상태기계와 알림 순서 고정 필요 |
| `D-09` | `/safety-cancel`의 의미 | 개인 참여 안전 취소와 전체 안전 중단을 UI·API에서 분리 제안 |
| `D-10` | 체크인 코드 발급/표시 주체, 위치 반경·정확도, host approval | 참가자에게 정답 코드를 API로 내려주지 않음; 현장 전달 방식 결정 |
| `D-11` | 채팅 실시간 transport, 첨부, 보관·신고 보존 | REST 복구 기준 유지; WebSocket/SSE 선택 필요 |
| `D-12` | 긍정 인상 발신자 공개·수정 기간 | 인기 점수화 금지는 확정; privacy/retention 결정 |
| `D-13` | 연결 종료 후 1:1 메시지 보존/열람, 차단 알림 | 즉시 전송 차단은 확정; 기록 정책 필요 |
| `D-14` | 알림 push/SMS 공급자와 필수 서비스 알림 opt-out 범위 | 마케팅 동의는 별도 저장·감사 |
| `D-15` | 신고 증거·감사 로그·계정 탈퇴 보존 기간 | 법률 검토와 역할별 접근 정책 필요 |
| `D-16` | 공개 profile age band와 표시 이름 중복/금칙 정책 | 가입·수정 검증 규칙과 오류 코드 확정 필요 |

해결된 결정: 모임 상세의 차단 대상은 모임 자체가 아니라 해당 모임의 제안자 사용자다. 프론트는 `제안자 차단`으로 표시하고, 연동 시 상세 응답의 `proposer.userId`를 `POST /me/blocks`의 `blockedUserId`로 사용한다. 별도의 모임 숨김 기능은 이 계약에 포함하지 않는다.

## 19. 수용 기준 추적

| 명세 수용 기준 | 계약 위치 |
| --- | --- |
| 검증 전 생성·참여 금지 | §3.1, §5, §7, §8 |
| 24시간 밖 시작 거절·공개 장소만 | §6, §7 |
| 미달 진행은 제안자 `PROCEED` + 현재 2명 이상 | §7, §8 |
| 정확한 장소는 권한 있는 확정 참가자만 | §4.2, §6 |
| 차단 관계 사용자를 같은 모임에 배정하지 않음 | §6, §8, §14 |
| 만남 전 1:1 없음 | §9, §12 |
| 상호 동의 후에만 연결 | §12 |
| 긍정 인상을 순위·자격에 사용하지 않음 | §11 |
| 긴급 신고 우선 | §14, §15 |
| 상태 변경 중복 호출 안전 | §3.4와 모든 mutation 표 |
| 운영자 민감정보 열람·제재 감사 | §15 |

## 20. 확인된 현재 경계

- 현재 `src`에는 `fetch`, Axios, query client, `/api/` 호출이 없다. 화면 데이터와 상태 변경은 fixture/로컬 상태다.
- 따라서 이 문서는 기존 API를 문서화한 것이 아니라, 구현 화면 22개와 명세의 미구현 필수 범위를 빠짐없이 연결하기 위한 **첫 계약안**이다.
- Notion 원본 API 문서는 디자인 원장에 링크만 존재하고 이 작업에서는 내용이 로컬로 제공되지 않았다. 그 문서와 충돌할 경우 충돌 항목을 별도 결정 기록으로 남기고, 합의 없이 어느 쪽도 “구현됨”으로 간주하지 않는다.
