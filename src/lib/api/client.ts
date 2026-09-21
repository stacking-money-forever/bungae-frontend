import type {
  ActivityPolicyPage,
  CancelMeetupInput,
  CheckInMeetupInput,
  CheckInResult,
  Block,
  BlockListQuery,
  BlockPage,
  CreateReportInput,
  ActionReceipt,
  ConnectionIntentRequest,
  ConnectionIntentResult,
  ConnectionPage,
  FeedbackRequest,
  ImpressionRequest,
  NextIntentRequest,
  JoinResult,
  Meetup,
  MeetupCreate,
  MeetupListQuery,
  MeetupPage,
  MyMeetupListQuery,
  MyMeetupPage,
  Notification,
  NotificationListQuery,
  NotificationPage,
  Message,
  MessagePage,
  IncidentReceipt,
  IncidentListQuery,
  IncidentPage,
  NoShowAppeal,
  NoShowAppealCreate,
  MeetupMessageListQuery,
  ParticipantPage,
  OtpChallenge,
  OtpRequest,
  ProblemDetails,
  ProfilePatch,
  PushDevice,
  PlaceSearchResult,
  PushDeviceRegistration,
  QuorumDecision,
  QuorumDecisionResult,
  ReadAllNotificationsResult,
  SessionRequest,
  TokenSession,
  UserProfile,
  VerificationSession,
  Withdrawal,
} from "@/lib/api/types";

export const API_BASE_URL = "/v1";

export class ApiProblemError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | null,
  ) {
    super(problem?.title ?? `API request failed with ${status}`);
    this.name = "ApiProblemError";
  }
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== "object") return false;
  const problem = value as Record<string, unknown>;
  return (
    typeof problem.type === "string" &&
    typeof problem.title === "string" &&
    typeof problem.status === "number" &&
    typeof problem.detail === "string" &&
    typeof problem.instance === "string" &&
    typeof problem.code === "string" &&
    typeof problem.traceId === "string" &&
    (problem.errors === undefined ||
      (Array.isArray(problem.errors) &&
        problem.errors.every(
          (error) =>
            Boolean(error) &&
            typeof error === "object" &&
            typeof (error as Record<string, unknown>).field === "string" &&
            typeof (error as Record<string, unknown>).code === "string" &&
            typeof (error as Record<string, unknown>).message === "string",
        )))
  );
}

async function readProblem(response: Response): Promise<ProblemDetails | null> {
  if (!response.headers.get("content-type")?.includes("application/problem+json")) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return isProblemDetails(payload) ? payload : null;
}

export type BungaeApi = {
  requestOtp(input: OtpRequest): Promise<OtpChallenge>;
  createSession(input: SessionRequest): Promise<TokenSession>;
  refreshSession(refreshToken: string): Promise<TokenSession>;
  getMe(accessToken: string): Promise<UserProfile>;
  updateMe(input: ProfilePatch, version: number, accessToken: string): Promise<UserProfile>;
  getActivityPolicies(accessToken: string, cursor?: string): Promise<ActivityPolicyPage>;
  createVerificationSession(returnUrl: string, accessToken: string): Promise<VerificationSession>;
  getWithdrawal(accessToken: string): Promise<Withdrawal | null>;
  scheduleWithdrawal(idempotencyKey: string, accessToken: string): Promise<Withdrawal>;
  cancelWithdrawal(version: number, accessToken: string): Promise<void>;
  listMeetups(input: MeetupListQuery, accessToken: string): Promise<MeetupPage>;
  getMeetup(meetupId: string, accessToken: string): Promise<Meetup>;
  createMeetup(input: MeetupCreate, idempotencyKey: string, accessToken: string): Promise<Meetup>;
  joinMeetup(meetupId: string, idempotencyKey: string, accessToken: string): Promise<JoinResult>;
  leaveMeetup(meetupId: string, accessToken: string): Promise<void>;
  cancelMeetup(
    meetupId: string,
    input: CancelMeetupInput,
    idempotencyKey: string,
    accessToken: string,
  ): Promise<Meetup>;
  decideQuorum(
    meetupId: string,
    decision: QuorumDecision,
    version: number,
    idempotencyKey: string,
    accessToken: string,
  ): Promise<QuorumDecisionResult>;
  checkInMeetup(
    meetupId: string,
    input: CheckInMeetupInput,
    idempotencyKey: string,
    accessToken: string,
  ): Promise<CheckInResult>;
  listMyMeetups(input: MyMeetupListQuery, accessToken: string): Promise<MyMeetupPage>;
  listNotifications(input: NotificationListQuery, accessToken: string): Promise<NotificationPage>;
  markNotificationRead(notificationId: string, version: number, accessToken: string): Promise<Notification>;
  markAllNotificationsRead(accessToken: string): Promise<ReadAllNotificationsResult>;
  listMeetupMessages(meetupId: string, input: MeetupMessageListQuery, accessToken: string): Promise<MessagePage>;
  createMeetupMessage(meetupId: string, text: string, idempotencyKey: string, accessToken: string): Promise<Message>;
  deleteCurrentSession(accessToken: string): Promise<void>;
  createReport(input: CreateReportInput, idempotencyKey: string, accessToken: string): Promise<IncidentReceipt>;
  createNoShowAppeal(meetupId: string, input: NoShowAppealCreate, accessToken: string): Promise<NoShowAppeal>;
  listNoShowAppeals(accessToken: string): Promise<NoShowAppeal[]>;
  getNoShowAppeal(appealId: string, accessToken: string): Promise<NoShowAppeal>;
  listIncidents(input: IncidentListQuery, accessToken: string): Promise<IncidentPage>;
  listBlocks(input: BlockListQuery, accessToken: string): Promise<BlockPage>;
  createBlock(blockedUserId: string, accessToken: string): Promise<Block>;
  deleteBlock(blockedUserId: string, accessToken: string): Promise<void>;
  createFeedback(meetupId: string, input: FeedbackRequest, accessToken: string): Promise<ActionReceipt>;
  createImpressions(meetupId: string, input: ImpressionRequest, accessToken: string): Promise<ActionReceipt>;
  createNextIntent(meetupId: string, input: NextIntentRequest, accessToken: string): Promise<ActionReceipt>;
  listParticipants(meetupId: string, input: { cursor?: string; limit?: number }, accessToken: string): Promise<ParticipantPage>;
  createConnectionIntent(meetupId: string, input: ConnectionIntentRequest, accessToken: string): Promise<ConnectionIntentResult>;
  listConnections(input: { cursor?: string; limit?: number }, accessToken: string): Promise<ConnectionPage>;
  deleteConnection(connectionId: string, accessToken: string): Promise<void>;
  searchPlaces(query: string, accessToken: string): Promise<PlaceSearchResult>;
  putPushDevice(
    deviceId: string,
    input: PushDeviceRegistration,
    accessToken: string,
  ): Promise<PushDevice>;
  deletePushDevice(deviceId: string, accessToken: string): Promise<void>;
};

export type BungaeApiOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

/**
 * Typed browser transport for the authoritative `/v1` contract. It only emits
 * JSON requests and turns RFC 9457 responses into ApiProblemError instances.
 */
export function createBungaeApi({
  fetchImpl = fetch,
  baseUrl = API_BASE_URL,
}: BungaeApiOptions = {}): BungaeApi {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const jsonHeaders = { "Content-Type": "application/json" };

  async function request<T>(
    path: string,
    init: RequestInit,
    expectedStatus: number | readonly number[],
  ): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, init);
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    if (!expected.includes(response.status)) {
      throw new ApiProblemError(response.status, await readProblem(response));
    }
    return response.json() as Promise<T>;
  }

  async function requestEmpty(
    path: string,
    init: RequestInit,
    expectedStatus: number,
  ): Promise<void> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, init);
    if (response.status !== expectedStatus) {
      throw new ApiProblemError(response.status, await readProblem(response));
    }
  }

  return {
    requestOtp(input) {
      return request<OtpChallenge>(
        "/auth/otp-requests",
        { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) },
        202,
      );
    },
    createSession(input) {
      return request<TokenSession>(
        "/auth/sessions",
        { method: "POST", headers: jsonHeaders, body: JSON.stringify(input) },
        201,
      );
    },
    refreshSession(refreshToken) {
      return request<TokenSession>(
        "/auth/refresh",
        { method: "POST", headers: { "Refresh-Token": refreshToken } },
        200,
      );
    },
    getMe(accessToken) {
      return request<UserProfile>(
        "/me",
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    updateMe(input, version, accessToken) {
      return request<UserProfile>(
        "/me",
        {
          method: "PATCH",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${accessToken}`,
            "If-Match": String(version),
          },
          body: JSON.stringify(input),
        },
        200,
      );
    },
    getActivityPolicies(accessToken, cursor) {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      return request<ActivityPolicyPage>(
        `/activity-policies${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    createVerificationSession(returnUrl, accessToken) {
      return request<VerificationSession>(
        "/me/verification-sessions",
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ returnUrl }),
        },
        201,
      );
    },
    async getWithdrawal(accessToken) {
      try {
        return await request<Withdrawal>(
          "/me/withdrawal",
          { headers: { Authorization: `Bearer ${accessToken}` } },
          200,
        );
      } catch (error) {
        if (error instanceof ApiProblemError && error.status === 404) return null;
        throw error;
      }
    },
    scheduleWithdrawal(idempotencyKey, accessToken) {
      return request<Withdrawal>(
        "/me/withdrawal",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Idempotency-Key": idempotencyKey },
        },
        202,
      );
    },
    cancelWithdrawal(version, accessToken) {
      return requestEmpty(
        "/me/withdrawal",
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}`, "If-Match": String(version) } },
        204,
      );
    },
    listMeetups(input, accessToken) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) query.set(key, String(value));
      }
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<MeetupPage>(
        `/meetups${suffix}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    listMyMeetups(input, accessToken) {
      const query = new URLSearchParams({ relation: input.relation ?? "ALL" });
      if (input.state !== undefined) query.set("state", input.state);
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      return request<MyMeetupPage>(
        `/me/meetups?${query.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    getMeetup(meetupId, accessToken) {
      return request<Meetup>(
        `/meetups/${encodeURIComponent(meetupId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    searchPlaces(query, accessToken) {
      return request<PlaceSearchResult>(
        `/places/search?${new URLSearchParams({ query, type: "PLACE", page: "1", size: "15" })}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    createMeetup(input, idempotencyKey, accessToken) {
      return request<Meetup>(
        "/meetups",
        {
          method: "POST",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    joinMeetup(meetupId, idempotencyKey, accessToken) {
      return request<JoinResult>(
        `/meetups/${encodeURIComponent(meetupId)}/join`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
          },
        },
        200,
      );
    },
    leaveMeetup(meetupId, accessToken) {
      return requestEmpty(
        `/meetups/${encodeURIComponent(meetupId)}/participants/me`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        204,
      );
    },
    cancelMeetup(meetupId, input, idempotencyKey, accessToken) {
      return request<Meetup>(
        `/meetups/${encodeURIComponent(meetupId)}/cancel`,
        {
          method: "POST",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(input),
        },
        200,
      );
    },
    decideQuorum(meetupId, decision, version, idempotencyKey, accessToken) {
      return request<QuorumDecisionResult>(
        `/meetups/${encodeURIComponent(meetupId)}/quorum-decision`,
        {
          method: "POST",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
            "If-Match": String(version),
          },
          body: JSON.stringify({ decision }),
        },
        200,
      );
    },
    checkInMeetup(meetupId, input, idempotencyKey, accessToken) {
      return request<CheckInResult>(
        `/meetups/${encodeURIComponent(meetupId)}/check-ins`,
        {
          method: "POST",
          headers: {
            ...jsonHeaders,
            Authorization: `Bearer ${accessToken}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    listNotifications(input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<NotificationPage>(
        `/notifications${suffix}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    markNotificationRead(notificationId, version, accessToken) {
      return request<Notification>(
        `/notifications/${encodeURIComponent(notificationId)}`,
        {
          method: "PATCH",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}`, "If-Match": String(version) },
          body: JSON.stringify({ state: "READ" }),
        },
        200,
      );
    },
    markAllNotificationsRead(accessToken) {
      return request<ReadAllNotificationsResult>(
        "/notifications/read-all",
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    listMeetupMessages(meetupId, input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<MessagePage>(
        `/meetups/${encodeURIComponent(meetupId)}/messages${suffix}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    createMeetupMessage(meetupId, text, idempotencyKey, accessToken) {
      return request<Message>(
        `/meetups/${encodeURIComponent(meetupId)}/messages`,
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}`, "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ text }),
        },
        201,
      );
    },
    createReport(input, idempotencyKey, accessToken) {
      return request<IncidentReceipt>(
        "/reports",
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}`, "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(input),
        },
        202,
      );
    },
    createNoShowAppeal(meetupId, input, accessToken) {
      return request<NoShowAppeal>(
        `/meetups/${encodeURIComponent(meetupId)}/no-show-appeals`,
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    listNoShowAppeals(accessToken) {
      return request<NoShowAppeal[]>("/me/no-show-appeals", { headers: { Authorization: `Bearer ${accessToken}` } }, 200);
    },
    getNoShowAppeal(appealId, accessToken) {
      return request<NoShowAppeal>(
        `/me/no-show-appeals/${encodeURIComponent(appealId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    listIncidents(input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<IncidentPage>("/me/incidents" + suffix, { headers: { Authorization: `Bearer ${accessToken}` } }, 200);
    },
    createFeedback(meetupId, input, accessToken) {
      return request<ActionReceipt>(
        `/meetups/${encodeURIComponent(meetupId)}/feedback`,
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    createImpressions(meetupId, input, accessToken) {
      return request<ActionReceipt>(
        `/meetups/${encodeURIComponent(meetupId)}/impressions`,
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    createNextIntent(meetupId, input, accessToken) {
      return request<ActionReceipt>(
        `/meetups/${encodeURIComponent(meetupId)}/next-intents`,
        {
          method: "POST",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(input),
        },
        201,
      );
    },
    listParticipants(meetupId, input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<ParticipantPage>(
        `/meetups/${encodeURIComponent(meetupId)}/participants${suffix}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        200,
      );
    },
    createConnectionIntent(meetupId, input, accessToken) {
      return request<ConnectionIntentResult>(
        `/meetups/${encodeURIComponent(meetupId)}/connection-intents`,
        { method: "POST", headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) },
        201,
      );
    },
    listConnections(input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<ConnectionPage>("/connections" + suffix, { headers: { Authorization: `Bearer ${accessToken}` } }, 200);
    },
    deleteConnection(connectionId, accessToken) {
      return requestEmpty(`/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }, 204);
    },
    listBlocks(input, accessToken) {
      const query = new URLSearchParams();
      if (input.cursor !== undefined) query.set("cursor", input.cursor);
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size ? `?${query.toString()}` : "";
      return request<BlockPage>("/me/blocks" + suffix, { headers: { Authorization: `Bearer ${accessToken}` } }, 200);
    },
    createBlock(blockedUserId, accessToken) {
      return request<Block>(
        "/me/blocks",
        { method: "POST", headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ blockedUserId }) },
        201,
      );
    },
    deleteBlock(blockedUserId, accessToken) {
      return requestEmpty(`/me/blocks/${encodeURIComponent(blockedUserId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }, 204);
    },
    deleteCurrentSession(accessToken) {
      return requestEmpty(
        "/auth/sessions/current",
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        204,
      );
    },
    putPushDevice(deviceId, input, accessToken) {
      return request<PushDevice>(
        `/me/push-devices/${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          headers: { ...jsonHeaders, Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(input),
        },
        [200, 201],
      );
    },
    deletePushDevice(deviceId, accessToken) {
      return requestEmpty(
        `/me/push-devices/${encodeURIComponent(deviceId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        204,
      );
    },
  };
}
