import { describe, expect, it, vi } from "vitest";

import { ApiProblemError, createBungaeApi } from "@/lib/api/client";
import type { ImpressionRequest } from "@/lib/api/types";

const user = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  interestCodes: ["walk"],
  homeAreaCode: "MAPO",
  adultVerified: true,
  identityVerified: true,
  version: 4,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

const tokenSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
  user,
};

describe("Bungae API client", () => {
  it("uses the exact authenticated and unauthenticated v1 contracts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            requestId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
            expiresAt: "2026-09-07T00:10:00.000Z",
            retryAfterSeconds: 30,
          }),
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenSession), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenSession), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...user, displayName: "서연" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            deviceId: user.id,
            platform: "ANDROID",
            lastSeenAt: "2026-09-07T00:00:00.000Z",
            createdAt: "2026-09-07T00:00:00.000Z",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.requestOtp({ phoneNumber: "+821012345678", purpose: "SIGN_UP_OR_LOGIN" });
    await api.createSession({ requestId: user.id, otp: "123456" });
    await api.refreshSession("refresh-token");
    await api.getMe("access-token");
    await api.updateMe({ displayName: "서연" }, 4, "access-token");
    await api.deleteCurrentSession("access-token");
    await api.putPushDevice(
      user.id,
      { platform: "ANDROID", token: "fcm-token", lastSeenAt: "2026-09-07T00:00:00.000Z" },
      "access-token",
    );
    await api.deletePushDevice(user.id, "access-token");

    expect(fetchMock.mock.calls).toEqual([
      [
        "/v1/auth/otp-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: "+821012345678", purpose: "SIGN_UP_OR_LOGIN" }),
        },
      ],
      [
        "/v1/auth/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: user.id, otp: "123456" }),
        },
      ],
      ["/v1/auth/refresh", { method: "POST", headers: { "Refresh-Token": "refresh-token" } }],
      ["/v1/me", { headers: { Authorization: "Bearer access-token" } }],
      [
        "/v1/me",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer access-token",
            "If-Match": "4",
          },
          body: JSON.stringify({ displayName: "서연" }),
        },
      ],
      [
        "/v1/auth/sessions/current",
        { method: "DELETE", headers: { Authorization: "Bearer access-token" } },
      ],
      [
        `/v1/me/push-devices/${user.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" },
          body: JSON.stringify({
            platform: "ANDROID",
            token: "fcm-token",
            lastSeenAt: "2026-09-07T00:00:00.000Z",
          }),
        },
      ],
      [
        `/v1/me/push-devices/${user.id}`,
        { method: "DELETE", headers: { Authorization: "Bearer access-token" } },
      ],
    ]);
  });

  it("sends activity-policy authorization and a bodyless verification-session request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                code: "walk",
                name: "산책",
                minimumParticipants: 2,
                maximumParticipants: 4,
                venuePolicy: "PUBLIC",
                timePolicy: "FLEXIBLE",
                alcoholPolicy: "NOT_ALLOWED",
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            verificationSessionId: user.id,
            providerUrl: "https://verify.example/session",
            expiresAt: "2026-09-07T00:15:00.000Z",
          }),
          { status: 201 },
        ),
      );
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.getActivityPolicies("access-token", "walk");
    await api.createVerificationSession("access-token");

    expect(fetchMock.mock.calls).toEqual([
      [
        "/v1/activity-policies?cursor=walk",
        { headers: { Authorization: "Bearer access-token" } },
      ],
      [
        "/v1/me/verification-sessions",
        { method: "POST", headers: { Authorization: "Bearer access-token" } },
      ],
    ]);
  });


  it("uses the exact authenticated provider place-search URL and authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ places: [], page: 1, size: 15, isEnd: true }),
        { status: 200 },
      ),
    );
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.searchPlaces("한강 공원/입구", "access-token");

    expect(fetchMock.mock.calls).toEqual([
      [
        "/v1/places/search?query=%ED%95%9C%EA%B0%95+%EA%B3%B5%EC%9B%90%2F%EC%9E%85%EA%B5%AC&type=PLACE&page=1&size=15",
        { headers: { Authorization: "Bearer access-token" } },
      ],
    ]);
  });

  it("encodes the authenticated meetup list filters and meetup identifier exactly", async () => {
    const meetup = {
      id: user.id,
      activityCode: "WALK",
      title: "한강 산책",
      startsAt: "2026-09-07T09:30:00.000Z",
      endsAt: "2026-09-07T11:00:00.000Z",
      minimumParticipants: 2,
      capacity: 4,
      venue: { name: "공개 장소", latitude: 37.5, longitude: 126.9, address: "비공개 주소" },
      cost: 0,
      alcoholPolicy: "NOT_ALLOWED",
      state: "OPEN",
      joinedCount: 1,
      version: 1,
      allowedActions: ["JOIN"],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      joinDeadline: "2026-09-07T09:30:00.000Z",
      quorumStatus: "PENDING",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [meetup], nextCursor: "next" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(meetup), { status: 200 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.listMeetups(
      {
        cursor: "previous",
        activityCode: "WALK",
        startsAtFrom: "2026-09-07T00:00:00.000Z",
        startsAtTo: "2026-09-08T00:00:00.000Z",
        latitude: 37.5,
        longitude: 126.9,
        radiusMeters: 2000,
        maxCost: 0,
        alcoholPolicy: "NOT_ALLOWED",
        joinableOnly: true,
      },
      "access-token",
    );
    await api.getMeetup("id/with space", "access-token");

    expect(fetchMock.mock.calls).toEqual([
      [
        "/v1/meetups?cursor=previous&activityCode=WALK&startsAtFrom=2026-09-07T00%3A00%3A00.000Z&startsAtTo=2026-09-08T00%3A00%3A00.000Z&latitude=37.5&longitude=126.9&radiusMeters=2000&maxCost=0&alcoholPolicy=NOT_ALLOWED&joinableOnly=true",
        { headers: { Authorization: "Bearer access-token" } },
      ],
      ["/v1/meetups/id%2Fwith%20space", { headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("sends exact create join leave mutation methods, headers, bodies, and statuses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ participationId: user.id, state: "WAITLISTED", meetupState: "OPEN", joinedCount: 4, capacity: 4, waitlistPosition: 1, quorumStatus: "PENDING" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    const input = { activityCode: "WALK", title: "한강 산책", description: "소개", startsAt: "2026-09-07T09:30:00.000Z", endsAt: "2026-09-07T11:00:00.000Z", minimumParticipants: 2, capacity: 4, venue: { name: "공개 장소", latitude: 37.5, longitude: 126.9, address: "서울" }, cost: 0, alcoholPolicy: "NOT_ALLOWED" as const, preparation: "", facilitationTemplate: "자유 진행" };

    await api.createMeetup(input, "create-key", "access-token");
    await api.joinMeetup("id/with space", "join-key", "access-token");
    await api.leaveMeetup("id/with space", "access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "create-key" }, body: JSON.stringify(input) }],
      ["/v1/meetups/id%2Fwith%20space/join", { method: "POST", headers: { Authorization: "Bearer access-token", "Idempotency-Key": "join-key" } }],
      ["/v1/meetups/id%2Fwith%20space/participants/me", { method: "DELETE", headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("sends encoded cancel, quorum, and check-in contracts with exact headers and status expectations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: user.id }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ meetupId: user.id, state: "CONFIRMED", quorumDecision: "PROCEED", joinedCount: 2, decidedAt: "2026-09-07T10:00:00.000Z", version: 4, quorumStatus: "PROCEED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ participationId: user.id, state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }), { status: 201 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.cancelMeetup("id/with space", { reason: "안전 우려" }, "cancel-key", "access-token");
    await api.decideQuorum("id/with space", "PROCEED", 3, "quorum-key", "access-token");
    await api.checkInMeetup("id/with space", { method: "MEETUP_CODE", code: "MANGO 27" }, "check-key", "access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups/id%2Fwith%20space/cancel", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "cancel-key" }, body: JSON.stringify({ reason: "안전 우려" }) }],
      ["/v1/meetups/id%2Fwith%20space/quorum-decision", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "quorum-key", "If-Match": "3" }, body: JSON.stringify({ decision: "PROCEED" }) }],
      ["/v1/meetups/id%2Fwith%20space/check-ins", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "check-key" }, body: JSON.stringify({ method: "MEETUP_CODE", code: "MANGO 27" }) }],
    ]);
  });

  it("sends exact authenticated my-meetup and notification contracts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ notificationId: user.id, type: "UNKNOWN", createdAt: "2026-09-07T00:00:00.000Z", state: "READ", version: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updatedCount: 1, readAt: "2026-09-07T00:00:00.000Z" }), { status: 200 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.listMyMeetups({ relation: "ALL / HOST", state: "CANCELLED", cursor: "next/value", limit: 20 }, "access-token");
    await api.listNotifications({ cursor: "next/value", limit: 20 }, "access-token");
    await api.markNotificationRead("id/with space", 3, "access-token");
    await api.markAllNotificationsRead("access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/me/meetups?relation=ALL+%2F+HOST&state=CANCELLED&cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/notifications?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/notifications/id%2Fwith%20space", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "If-Match": "3" }, body: JSON.stringify({ state: "READ" }) }],
      ["/v1/notifications/read-all", { method: "POST", headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("sends encoded meetup message list and create contracts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "message-1", sender: { userId: user.id, displayName: user.displayName }, text: "안녕하세요", createdAt: "2026-09-07T10:00:00.000Z" }), { status: 201 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await api.listMeetupMessages("meetup/with space", { cursor: "next/value", limit: 20 }, "access-token");
    await api.createMeetupMessage("meetup/with space", "안녕하세요", "message-key", "access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups/meetup%2Fwith%20space/messages?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/meetups/meetup%2Fwith%20space/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "message-key" }, body: JSON.stringify({ text: "안녕하세요" }) }],
    ]);
  });

  it("sends exact report and block contracts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ incidentId: "incident-1", state: "RECEIVED", priority: "P1", submittedAt: "2026-09-07T00:00:00Z" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ blockedUserId: "user-2", createdAt: "2026-09-07T00:00:00Z" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    const report = { targetType: "MEETUP" as const, meetupId: "meetup-1", category: "SAFETY" as const, urgency: "P1" as const, details: "안전 위협", evidenceUploadIds: [] };
    await api.createReport(report, "report-key", "access-token");
    await api.listBlocks({ cursor: "next/value", limit: 20 }, "access-token");
    await api.createBlock("user-2", "access-token");
    await api.deleteBlock("id/with space", "access-token");
    expect(fetchMock.mock.calls).toEqual([
      ["/v1/reports", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token", "Idempotency-Key": "report-key" }, body: JSON.stringify(report) }],
      ["/v1/me/blocks?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/me/blocks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" }, body: JSON.stringify({ blockedUserId: "user-2" }) }],
      ["/v1/me/blocks/id%2Fwith%20space", { method: "DELETE", headers: { Authorization: "Bearer access-token" } }],
    ]);
  });
  it("sends exact encoded meetup feedback contract without an idempotency header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "receipt-1", createdAt: "2026-09-07T00:00:00Z" }), { status: 201 }),
    );
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    const feedback = {
      expectationMatch: 5 as const,
      feltSafe: 4 as const,
      facilitationComfort: 3 as const,
      wouldUseAgain: 2 as const,
      privateComment: "진행이 편안했어요.",
    };

    await api.createFeedback("meetup/with space", feedback, "access-token");

    expect(fetchMock.mock.calls).toEqual([
      [
        "/v1/meetups/meetup%2Fwith%20space/feedback",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" },
          body: JSON.stringify(feedback),
        },
      ],
    ]);
  });
  it("sends exact encoded impressions and next-intent contracts without idempotency headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "impression-1", createdAt: "2026-09-07T00:00:00Z" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "intent-1", createdAt: "2026-09-07T00:00:00Z" }), { status: 201 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    const impressions: ImpressionRequest = {
      impressions: [{ recipientUserId: "user-2", tags: ["KIND", "PUNCTUAL"] }],
    };
    await api.createImpressions("meetup/with space", impressions, "access-token");
    await api.createNextIntent("meetup/with space", { type: "SAME_ACTIVITY_NEW_PEOPLE" }, "access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups/meetup%2Fwith%20space/impressions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" }, body: JSON.stringify(impressions) }],
      ["/v1/meetups/meetup%2Fwith%20space/next-intents", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" }, body: JSON.stringify({ type: "SAME_ACTIVITY_NEW_PEOPLE" }) }],
    ]);
  });
  it("sends exact participant and connection contracts without idempotency headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ targetUserId: "user-2", state: "MATCHED", connectionId: "connection-1" }] }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    await api.listParticipants("meetup/with space", { cursor: "next/value", limit: 20 }, "access-token");
    await api.createConnectionIntent("meetup/with space", { targetUserIds: ["user-2"] }, "access-token");
    await api.listConnections({ cursor: "next/value", limit: 20 }, "access-token");
    await api.deleteConnection("connection/with space", "access-token");
    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups/meetup%2Fwith%20space/participants?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/meetups/meetup%2Fwith%20space/connection-intents", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" }, body: JSON.stringify({ targetUserIds: ["user-2"] }) }],
      ["/v1/connections?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/connections/connection%2Fwith%20space", { method: "DELETE", headers: { Authorization: "Bearer access-token" } }],
    ]);
  });
  it("uses the exact bodyless withdrawal contracts and treats only 404 as no schedule", async () => {
    const withdrawal = {
      id: "withdrawal-1",
      state: "SCHEDULED" as const,
      requestedAt: "2026-09-08T00:00:00.000Z",
      effectiveAt: "2026-09-15T00:00:00.000Z",
      cancelledAt: null,
      completedAt: null,
      version: 3,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 404 }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(withdrawal), { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 503 }), { status: 503 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(api.getWithdrawal("access-token")).resolves.toBeNull();
    await expect(api.scheduleWithdrawal("withdrawal-key", "access-token")).resolves.toEqual(withdrawal);
    await expect(api.cancelWithdrawal(3, "access-token")).resolves.toBeUndefined();
    await expect(api.getWithdrawal("access-token")).rejects.toBeInstanceOf(ApiProblemError);

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/me/withdrawal", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/me/withdrawal", { method: "POST", headers: { Authorization: "Bearer access-token", "Idempotency-Key": "withdrawal-key" } }],
      ["/v1/me/withdrawal", { method: "DELETE", headers: { Authorization: "Bearer access-token", "If-Match": "3" } }],
      ["/v1/me/withdrawal", { headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("uses exact appeal and incident history contracts", async () => {
    const appeal = {
      id: "appeal-1", attendanceId: "attendance-1", meetupId: "meetup-1", userId: user.id,
      reason: "기록이 정확하지 않아요.", state: "SUBMITTED" as const,
      submittedAt: "2026-09-08T00:00:00Z", deadlineAt: "2026-09-15T00:00:00Z",
      reviewedBy: null, resolution: null, reviewedAt: null, createdAt: "2026-09-08T00:00:00Z",
      updatedAt: "2026-09-08T00:00:00Z", version: 0, evidenceIds: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(appeal), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([appeal]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(appeal), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], nextCursor: "next/value" }), { status: 200 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });
    await api.createNoShowAppeal("meetup/with space", { reason: appeal.reason }, "access-token");
    await api.listNoShowAppeals("access-token");
    await api.getNoShowAppeal("appeal/with space", "access-token");
    await api.listIncidents({ cursor: "next/value", limit: 20 }, "access-token");

    expect(fetchMock.mock.calls).toEqual([
      ["/v1/meetups/meetup%2Fwith%20space/no-show-appeals", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer access-token" }, body: JSON.stringify({ reason: appeal.reason }) }],
      ["/v1/me/no-show-appeals", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/me/no-show-appeals/appeal%2Fwith%20space", { headers: { Authorization: "Bearer access-token" } }],
      ["/v1/me/incidents?cursor=next%2Fvalue&limit=20", { headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("rejects no-show appeal responses that are not a 201 receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 200 }), { status: 200 }));
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(api.createNoShowAppeal("meetup-1", { reason: "기록이 정확하지 않아요." }, "access-token")).rejects.toEqual(
      expect.objectContaining({ status: 200 } satisfies Partial<ApiProblemError>),
    );
  });

  it("parses valid RFC 9457 problems without exposing response bodies", async () => {
    const problem = {
      type: "https://bungae.example/problems/otp-invalid",
      title: "OTP is invalid",
      status: 401,
      detail: "The submitted code cannot create a session.",
      instance: "/v1/auth/sessions",
      code: "OTP_INVALID",
      traceId: "trace-123",
      errors: [{ field: "otp", code: "INVALID", message: "Enter the current code." }],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(problem), {
        status: 401,
        headers: { "content-type": "application/problem+json; charset=utf-8" },
      }),
    );
    const api = createBungaeApi({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(api.createSession({ requestId: user.id, otp: "123456" })).rejects.toEqual(
      expect.objectContaining({
        name: "ApiProblemError",
        status: 401,
        problem,
      } satisfies Partial<ApiProblemError>),
    );
  });
});
