"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { createBungaeApi, type BungaeApi } from "@/lib/api/client";
import type {
  ActivityPolicyPage,
  CancelMeetupInput,
  CheckInMeetupInput,
  Block,
  BlockListQuery,
  BlockPage,
  CreateReportInput,
  ActionReceipt,
  FeedbackRequest,
  ImpressionRequest,
  NextIntentRequest,
  ConnectionIntentRequest,
  ConnectionIntentResult,
  ConnectionPage,
  CheckInResult,
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
  MeetupMessageListQuery,
  ParticipantPage,
  OtpChallenge,
  IncidentReceipt,
  IncidentListQuery,
  IncidentPage,
  NoShowAppeal,
  NoShowAppealCreate,
  OtpRequest,
  ProfilePatch,
  PlaceSearchResult,
  QuorumDecision,
  QuorumDecisionResult,
  ReadAllNotificationsResult,
  SessionRequest,
  UserProfile,
  VerificationSession,
  Withdrawal,
} from "@/lib/api/types";
import {
  unsubscribeFromPush,
  type PushAuthSession,
  type PushDependencies,
  type UnsubscribeResult,
} from "@/lib/pwa/push";
import { AuthSessionStore, type AuthSnapshot, type RemoteLogoutResult } from "@/lib/auth/session-store";

export type LogoutResult = {
  ok: boolean;
  push: { attempted: boolean; result?: UnsubscribeResult; failedUnexpectedly?: boolean };
  remote: RemoteLogoutResult;
};

export type AuthSessionContextValue = {
  snapshot: AuthSnapshot;
  /**
   * Monotonic UI session generation. Bumps on login, logout, and account
   * switch so the same user logging in again is a new session. Owned by this
   * provider; the session store transport is not modified.
   */
  sessionEpoch: number;
  requestOtp(input: OtpRequest): Promise<OtpChallenge>;
  createSession(input: SessionRequest, canCommit?: () => boolean): Promise<UserProfile | null>;
  getAccessToken(): Promise<string | null>;
  getMe(): Promise<UserProfile>;
  updateMe(input: ProfilePatch, version: number): Promise<UserProfile>;
  getActivityPolicies(cursor?: string): Promise<ActivityPolicyPage>;
  createVerificationSession(returnUrl: string): Promise<VerificationSession>;
  getWithdrawal(): Promise<Withdrawal | null>;
  scheduleWithdrawal(idempotencyKey: string): Promise<Withdrawal>;
  cancelWithdrawal(version: number): Promise<void>;
  listMeetups(input: MeetupListQuery): Promise<MeetupPage>;
  getMeetup(meetupId: string): Promise<Meetup>;
  searchPlaces(query: string): Promise<PlaceSearchResult>;
  createMeetup(input: MeetupCreate, idempotencyKey: string): Promise<Meetup>;
  joinMeetup(meetupId: string, idempotencyKey: string): Promise<JoinResult>;
  leaveMeetup(meetupId: string): Promise<void>;
  cancelMeetup(meetupId: string, input: CancelMeetupInput, idempotencyKey: string): Promise<Meetup>;
  decideQuorum(
    meetupId: string,
    decision: QuorumDecision,
    version: number,
    idempotencyKey: string,
  ): Promise<QuorumDecisionResult>;
  checkInMeetup(
    meetupId: string,
    input: CheckInMeetupInput,
    idempotencyKey: string,
  ): Promise<CheckInResult>;
  listMyMeetups(input: MyMeetupListQuery): Promise<MyMeetupPage>;
  listNotifications(input: NotificationListQuery): Promise<NotificationPage>;
  markNotificationRead(notificationId: string, version: number): Promise<Notification>;
  markAllNotificationsRead(): Promise<ReadAllNotificationsResult>;
  listMeetupMessages(meetupId: string, input: MeetupMessageListQuery): Promise<MessagePage>;
  createMeetupMessage(meetupId: string, text: string, idempotencyKey: string): Promise<Message>;
  createReport(input: CreateReportInput, idempotencyKey: string): Promise<IncidentReceipt>;
  createNoShowAppeal(meetupId: string, input: NoShowAppealCreate): Promise<NoShowAppeal>;
  listNoShowAppeals(): Promise<NoShowAppeal[]>;
  getNoShowAppeal(appealId: string): Promise<NoShowAppeal>;
  listIncidents(input: IncidentListQuery): Promise<IncidentPage>;
  createFeedback(meetupId: string, input: FeedbackRequest): Promise<ActionReceipt>;
  createImpressions(meetupId: string, input: ImpressionRequest): Promise<ActionReceipt>;
  createNextIntent(meetupId: string, input: NextIntentRequest): Promise<ActionReceipt>;
  listParticipants(meetupId: string, input: { cursor?: string; limit?: number }): Promise<ParticipantPage>;
  createConnectionIntent(meetupId: string, input: ConnectionIntentRequest): Promise<ConnectionIntentResult>;
  listConnections(input: { cursor?: string; limit?: number }): Promise<ConnectionPage>;
  deleteConnection(connectionId: string): Promise<void>;
  listBlocks(input: BlockListQuery): Promise<BlockPage>;
  createBlock(blockedUserId: string): Promise<Block>;
  deleteBlock(blockedUserId: string): Promise<void>;
  logout(): Promise<LogoutResult>;
  pushDependencies: PushDependencies | undefined;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export type AuthSessionProviderProps = {
  children: ReactNode;
  api?: BungaeApi;
  unsubscribePush?: (dependencies?: PushDependencies) => Promise<UnsubscribeResult>;
};

export function AuthSessionProvider({
  children,
  api,
  unsubscribePush = unsubscribeFromPush,
}: AuthSessionProviderProps) {
  const [store] = useState(() => new AuthSessionStore(api ?? createBungaeApi()));
  const snapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
  const sessionEpochRef = useRef(0);
  const subject = snapshot.status === "authenticated" ? snapshot.user.id : null;
  const previousSubject = useRef<string | null>(null);
  if (previousSubject.current !== subject) {
    // A login, logout, or account switch always starts a new UI session
    // generation even when the subject id is unchanged across a logout.
    sessionEpochRef.current += 1;
    previousSubject.current = subject;
  }
  const sessionEpoch = sessionEpochRef.current;
  const pushSession = useMemo<PushAuthSession | undefined>(() => {
    if (!subject) return undefined;
    return {
      subject,
      getAccessToken: () => store.getAccessToken(),
    };
  }, [store, subject]);
  const pushDependencies = useMemo<PushDependencies | undefined>(
    () => (pushSession ? { session: pushSession } : undefined),
    [pushSession],
  );
  const pushDependenciesRef = useRef(pushDependencies);
  pushDependenciesRef.current = pushDependencies;
  const logoutInFlight = useRef<Promise<LogoutResult> | null>(null);

  const logout = useCallback(() => {
    if (logoutInFlight.current) return logoutInFlight.current;

    const run = (async () => {
      const dependencies = pushDependenciesRef.current;
      let push: LogoutResult["push"] = { attempted: false };
      if (dependencies) {
        try {
          push = { attempted: true, result: await unsubscribePush(dependencies) };
        } catch {
          push = { attempted: true, failedUnexpectedly: true };
        }
      }

      const remote = await store.deleteCurrentSession();
      return {
        ok: (!push.attempted || push.result?.ok === true) && remote.ok,
        push,
        remote,
      };
    })().finally(() => {
      logoutInFlight.current = null;
    });
    logoutInFlight.current = run;
    return run;
  }, [store, unsubscribePush]);

  const requestOtp = useCallback((input: OtpRequest) => store.requestOtp(input), [store]);
  const createSession = useCallback(
    (input: SessionRequest, canCommit?: () => boolean) => store.createSession(input, canCommit),
    [store],
  );
  const getAccessToken = useCallback(() => store.getAccessToken(), [store]);
  const getMe = useCallback(() => store.getMe(), [store]);
  const updateMe = useCallback(
    (input: ProfilePatch, version: number) => store.updateMe(input, version),
    [store],
  );
  const getActivityPolicies = useCallback(
    (cursor?: string) => store.getActivityPolicies(cursor),
    [store],
  );
  const createVerificationSession = useCallback(
    (returnUrl: string) => store.createVerificationSession(returnUrl),
    [store],
  );
  const getWithdrawal = useCallback(() => store.getWithdrawal(), [store]);
  const scheduleWithdrawal = useCallback(
    (idempotencyKey: string) => store.scheduleWithdrawal(idempotencyKey),
    [store],
  );
  const cancelWithdrawal = useCallback(
    (version: number) => store.cancelWithdrawal(version),
    [store],
  );
  const listMeetups = useCallback((input: MeetupListQuery) => store.listMeetups(input), [store]);
  const getMeetup = useCallback((meetupId: string) => store.getMeetup(meetupId), [store]);
  const searchPlaces = useCallback((query: string) => store.searchPlaces(query), [store]);
  const createMeetup = useCallback(
    (input: MeetupCreate, idempotencyKey: string) => store.createMeetup(input, idempotencyKey),
    [store],
  );
  const joinMeetup = useCallback(
    (meetupId: string, idempotencyKey: string) => store.joinMeetup(meetupId, idempotencyKey),
    [store],
  );
  const leaveMeetup = useCallback((meetupId: string) => store.leaveMeetup(meetupId), [store]);
  const cancelMeetup = useCallback(
    (meetupId: string, input: CancelMeetupInput, idempotencyKey: string) =>
      store.cancelMeetup(meetupId, input, idempotencyKey),
    [store],
  );
  const decideQuorum = useCallback(
    (meetupId: string, decision: QuorumDecision, version: number, idempotencyKey: string) =>
      store.decideQuorum(meetupId, decision, version, idempotencyKey),
    [store],
  );
  const checkInMeetup = useCallback(
    (meetupId: string, input: CheckInMeetupInput, idempotencyKey: string) =>
      store.checkInMeetup(meetupId, input, idempotencyKey),
    [store],
  );
  const listMyMeetups = useCallback((input: MyMeetupListQuery) => store.listMyMeetups(input), [store]);
  const listNotifications = useCallback((input: NotificationListQuery) => store.listNotifications(input), [store]);
  const markNotificationRead = useCallback(
    (notificationId: string, version: number) => store.markNotificationRead(notificationId, version),
    [store],
  );
  const markAllNotificationsRead = useCallback(() => store.markAllNotificationsRead(), [store]);
  const listMeetupMessages = useCallback(
    (meetupId: string, input: MeetupMessageListQuery) => store.listMeetupMessages(meetupId, input),
    [store],
  );
  const createMeetupMessage = useCallback(
    (meetupId: string, text: string, idempotencyKey: string) => store.createMeetupMessage(meetupId, text, idempotencyKey),
    [store],
  );

  const createReport = useCallback(
    (input: CreateReportInput, idempotencyKey: string) => store.createReport(input, idempotencyKey),
    [store],
  );

  const createFeedback = useCallback(
    (meetupId: string, input: FeedbackRequest) => store.createFeedback(meetupId, input),
    [store],
  );
  const createImpressions = useCallback(
    (meetupId: string, input: ImpressionRequest) => store.createImpressions(meetupId, input),
    [store],
  );
  const createNextIntent = useCallback(
    (meetupId: string, input: NextIntentRequest) => store.createNextIntent(meetupId, input),
    [store],
  );
  const createNoShowAppeal = useCallback(
    (meetupId: string, input: NoShowAppealCreate) => store.createNoShowAppeal(meetupId, input),
    [store],
  );
  const listNoShowAppeals = useCallback(() => store.listNoShowAppeals(), [store]);
  const getNoShowAppeal = useCallback((appealId: string) => store.getNoShowAppeal(appealId), [store]);
  const listIncidents = useCallback((input: IncidentListQuery) => store.listIncidents(input), [store]);
  const listParticipants = useCallback(
    (meetupId: string, input: { cursor?: string; limit?: number }) => store.listParticipants(meetupId, input),
    [store],
  );
  const createConnectionIntent = useCallback(
    (meetupId: string, input: ConnectionIntentRequest) => store.createConnectionIntent(meetupId, input),
    [store],
  );
  const listConnections = useCallback((input: { cursor?: string; limit?: number }) => store.listConnections(input), [store]);
  const deleteConnection = useCallback((connectionId: string) => store.deleteConnection(connectionId), [store]);
  const listBlocks = useCallback((input: BlockListQuery) => store.listBlocks(input), [store]);
  const createBlock = useCallback((blockedUserId: string) => store.createBlock(blockedUserId), [store]);
  const deleteBlock = useCallback((blockedUserId: string) => store.deleteBlock(blockedUserId), [store]);
  const value = useMemo<AuthSessionContextValue>(
    () => ({
      snapshot,
      requestOtp,
      createSession,
      getAccessToken,
      getMe,
      updateMe,
      getActivityPolicies,
      createVerificationSession,
      getWithdrawal,
      scheduleWithdrawal,
      cancelWithdrawal,
      listMeetups,
      getMeetup,
      searchPlaces,
      createMeetup,
      joinMeetup,
      leaveMeetup,
      cancelMeetup,
      decideQuorum,
      checkInMeetup,
      listMyMeetups,
      listNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      listMeetupMessages,
      createMeetupMessage,
      createReport,
      createFeedback,
      createImpressions,
      createNextIntent,
      listParticipants,
      createConnectionIntent,
      listConnections,
      createNoShowAppeal,
      listNoShowAppeals,
      getNoShowAppeal,
      listIncidents,
      deleteConnection,
      listBlocks,
      createBlock,
      deleteBlock,
      logout,
      pushDependencies,
      sessionEpoch,
    }),
    [
      sessionEpoch,
      listMyMeetups,
      listNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      listMeetupMessages,
      createMeetupMessage,
      createReport,
      createFeedback,
      createImpressions,
      createNextIntent,
      listParticipants,
      createConnectionIntent,
      listConnections,
      deleteConnection,
      listBlocks,
      createBlock,
      deleteBlock,
      createSession,
      getAccessToken,
      getMe,
      logout,
      pushDependencies,
      requestOtp,
      snapshot,
      createVerificationSession,
      getWithdrawal,
      scheduleWithdrawal,
      cancelWithdrawal,
      getActivityPolicies,
      cancelMeetup,
      decideQuorum,
      checkInMeetup,
      createNoShowAppeal,
      listNoShowAppeals,
      getNoShowAppeal,
      listIncidents,
      updateMe,
      getMeetup,
      searchPlaces,
      listMeetups,
      createMeetup,
      joinMeetup,
      leaveMeetup,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useOptionalAuthSession(): AuthSessionContextValue | null {
  return useContext(AuthSessionContext);
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("useAuthSession must be used within AuthSessionProvider");
  return value;
}
