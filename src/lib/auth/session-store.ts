import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
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
  FeedbackRequest,
  ImpressionRequest,
  NextIntentRequest,
  ConnectionIntentRequest,
  ConnectionIntentResult,
  ConnectionPage,
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
  IncidentReceipt,
  IncidentListQuery,
  IncidentPage,
  NoShowAppeal,
  NoShowAppealCreate,
  OtpChallenge,
  OtpRequest,
  ProfilePatch,
  PlaceSearchResult,
  QuorumDecision,
  QuorumDecisionResult,
  ReadAllNotificationsResult,
  SessionRequest,
  TokenSession,
  UserProfile,
  VerificationSession,
  Withdrawal,
} from "@/lib/api/types";

type ActiveSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
};

export type AuthSnapshot =
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: UserProfile };

export class SessionExpiredError extends Error {
  constructor(readonly cause: unknown = null) {
    super("The authenticated session has expired");
    this.name = "SessionExpiredError";
  }
}

export type RemoteLogoutResult =
  | { ok: true; attempted: boolean }
  | { ok: false; attempted: boolean; error: unknown };

/**
 * In-memory token coordinator. No browser persistence is used: every reload
 * requires reauthentication until the API contract specifies secure persistence.
 */
export class AuthSessionStore {
  private current: ActiveSession | null = null;
  private refreshInFlight = new WeakMap<ActiveSession, Promise<ActiveSession | null>>();
  private listeners = new Set<() => void>();
  private snapshot: AuthSnapshot = { status: "anonymous", user: null };

  constructor(
    private readonly api: BungaeApi,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): AuthSnapshot {
    return this.snapshot;
  }

  getSubject(): string | null {
    return this.current?.user.id ?? null;
  }

  requestOtp(input: OtpRequest): Promise<OtpChallenge> {
    return this.api.requestOtp(input);
  }

  async createSession(
    input: SessionRequest,
    canCommit?: () => boolean,
  ): Promise<UserProfile | null> {
    const session = await this.api.createSession(input);
    if (canCommit && !canCommit()) return null;
    this.setSession(session);
    return session.user;
  }

  async getAccessToken(): Promise<string | null> {
    const session = this.current;
    return session ? this.accessTokenFor(session) : null;
  }

  async getMe(): Promise<UserProfile> {
    const user = await this.withAuthenticatedRequest((accessToken) => this.api.getMe(accessToken));
    this.setUser(user);
    return user;
  }

  async updateMe(input: ProfilePatch, version: number): Promise<UserProfile> {
    const user = await this.withAuthenticatedRequest((accessToken) =>
      this.api.updateMe(input, version, accessToken),
    );
    this.setUser(user);
    return user;
  }

  getActivityPolicies(cursor?: string): Promise<ActivityPolicyPage> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.getActivityPolicies(accessToken, cursor),
    );
  }

  createVerificationSession(): Promise<VerificationSession> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.createVerificationSession(accessToken),
    );
  }

  getWithdrawal(): Promise<Withdrawal | null> {
    return this.withAuthenticatedRequest((accessToken) => this.api.getWithdrawal(accessToken));
  }

  scheduleWithdrawal(idempotencyKey: string): Promise<Withdrawal> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.scheduleWithdrawal(idempotencyKey, accessToken),
    );
  }

  cancelWithdrawal(version: number): Promise<void> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.cancelWithdrawal(version, accessToken),
    );
  }

  listMeetups(input: MeetupListQuery): Promise<MeetupPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listMeetups(input, accessToken));
  }

  listMyMeetups(input: MyMeetupListQuery): Promise<MyMeetupPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listMyMeetups(input, accessToken));
  }

  listNotifications(input: NotificationListQuery): Promise<NotificationPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listNotifications(input, accessToken));
  }

  markNotificationRead(notificationId: string, version: number): Promise<Notification> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.markNotificationRead(notificationId, version, accessToken),
    );
  }

  markAllNotificationsRead(): Promise<ReadAllNotificationsResult> {
    return this.withAuthenticatedRequest((accessToken) => this.api.markAllNotificationsRead(accessToken));
  }

  listMeetupMessages(meetupId: string, input: MeetupMessageListQuery): Promise<MessagePage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listMeetupMessages(meetupId, input, accessToken));
  }

  createMeetupMessage(meetupId: string, text: string, idempotencyKey: string): Promise<Message> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.createMeetupMessage(meetupId, text, idempotencyKey, accessToken),
    );
  }

  createReport(input: CreateReportInput, idempotencyKey: string): Promise<IncidentReceipt> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createReport(input, idempotencyKey, accessToken));
  }

  createNoShowAppeal(meetupId: string, input: NoShowAppealCreate): Promise<NoShowAppeal> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.createNoShowAppeal(meetupId, input, accessToken),
    );
  }

  listNoShowAppeals(): Promise<NoShowAppeal[]> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listNoShowAppeals(accessToken));
  }

  getNoShowAppeal(appealId: string): Promise<NoShowAppeal> {
    return this.withAuthenticatedRequest((accessToken) => this.api.getNoShowAppeal(appealId, accessToken));
  }

  listIncidents(input: IncidentListQuery): Promise<IncidentPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listIncidents(input, accessToken));
  }

  createFeedback(meetupId: string, input: FeedbackRequest): Promise<ActionReceipt> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createFeedback(meetupId, input, accessToken));
  }
  createImpressions(meetupId: string, input: ImpressionRequest): Promise<ActionReceipt> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createImpressions(meetupId, input, accessToken));
  }

  createNextIntent(meetupId: string, input: NextIntentRequest): Promise<ActionReceipt> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createNextIntent(meetupId, input, accessToken));
  }


  listParticipants(meetupId: string, input: { cursor?: string; limit?: number }): Promise<ParticipantPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listParticipants(meetupId, input, accessToken));
  }

  createConnectionIntent(meetupId: string, input: ConnectionIntentRequest): Promise<ConnectionIntentResult> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createConnectionIntent(meetupId, input, accessToken));
  }

  listConnections(input: { cursor?: string; limit?: number }): Promise<ConnectionPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listConnections(input, accessToken));
  }

  deleteConnection(connectionId: string): Promise<void> {
    return this.withAuthenticatedRequest((accessToken) => this.api.deleteConnection(connectionId, accessToken));
  }

  listBlocks(input: BlockListQuery): Promise<BlockPage> {
    return this.withAuthenticatedRequest((accessToken) => this.api.listBlocks(input, accessToken));
  }

  createBlock(blockedUserId: string): Promise<Block> {
    return this.withAuthenticatedRequest((accessToken) => this.api.createBlock(blockedUserId, accessToken));
  }

  deleteBlock(blockedUserId: string): Promise<void> {
    return this.withAuthenticatedRequest((accessToken) => this.api.deleteBlock(blockedUserId, accessToken));
  }

  getMeetup(meetupId: string): Promise<Meetup> {
    return this.withAuthenticatedRequest((accessToken) => this.api.getMeetup(meetupId, accessToken));
  }

  searchPlaces(query: string): Promise<PlaceSearchResult> {
    return this.withAuthenticatedRequest((accessToken) => this.api.searchPlaces(query, accessToken));
  }
  createMeetup(input: MeetupCreate, idempotencyKey: string): Promise<Meetup> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.createMeetup(input, idempotencyKey, accessToken),
    );
  }

  joinMeetup(meetupId: string, idempotencyKey: string): Promise<JoinResult> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.joinMeetup(meetupId, idempotencyKey, accessToken),
    );
  }

  leaveMeetup(meetupId: string): Promise<void> {
    return this.withAuthenticatedRequest((accessToken) => this.api.leaveMeetup(meetupId, accessToken));
  }

  cancelMeetup(
    meetupId: string,
    input: CancelMeetupInput,
    idempotencyKey: string,
  ): Promise<Meetup> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.cancelMeetup(meetupId, input, idempotencyKey, accessToken),
    );
  }

  decideQuorum(
    meetupId: string,
    decision: QuorumDecision,
    version: number,
    idempotencyKey: string,
  ): Promise<QuorumDecisionResult> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.decideQuorum(meetupId, decision, version, idempotencyKey, accessToken),
    );
  }

  checkInMeetup(
    meetupId: string,
    input: CheckInMeetupInput,
    idempotencyKey: string,
  ): Promise<CheckInResult> {
    return this.withAuthenticatedRequest((accessToken) =>
      this.api.checkInMeetup(meetupId, input, idempotencyKey, accessToken),
    );
  }

  /** Runs an authenticated operation with at most one refresh-and-retry on its starting session. */
  async withAuthenticatedRequest<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
    const session = this.current;
    if (!session) throw new SessionExpiredError();

    const accessToken = await this.accessTokenFor(session);
    if (!accessToken || this.current !== session) throw new SessionExpiredError();

    try {
      const result = await operation(accessToken);
      if (this.current !== session) throw new SessionExpiredError();
      return result;
    } catch (error) {
      if (!(error instanceof ApiProblemError) || error.status !== 401) throw error;
    }

    if (this.current !== session) throw new SessionExpiredError();
    const refreshed = await this.refresh(session);
    if (refreshed !== session || this.current !== session) throw new SessionExpiredError();

    const result = await operation(session.accessToken);
    if (this.current !== session) throw new SessionExpiredError();
    return result;
  }

  /** Always clears local secrets, including when the remote session deletion fails. */
  async deleteCurrentSession(): Promise<RemoteLogoutResult> {
    const session = this.current;
    try {
      if (!session) return { ok: true, attempted: false };
      await this.withAuthenticatedRequest((accessToken) => this.api.deleteCurrentSession(accessToken));
      return { ok: true, attempted: true };
    } catch (error) {
      return { ok: false, attempted: true, error };
    } finally {
      if (session) this.clear(session);
    }
  }

  clear(expectedSession?: ActiveSession): void {
    if (!this.current || (expectedSession && this.current !== expectedSession)) return;
    this.current = null;
    this.snapshot = { status: "anonymous", user: null };
    this.notify();
  }

  private async accessTokenFor(session: ActiveSession): Promise<string | null> {
    if (this.current !== session) return null;
    if (session.expiresAt > this.now()) return session.accessToken;

    const refreshed = await this.refresh(session);
    return refreshed === session && this.current === session ? session.accessToken : null;
  }

  private refresh(session: ActiveSession): Promise<ActiveSession | null> {
    if (this.current !== session) return Promise.resolve(null);

    const existing = this.refreshInFlight.get(session);
    if (existing) return existing;

    const refresh = this.api
      .refreshSession(session.refreshToken)
      .then((next) => {
        if (this.current !== session) return null;
        session.accessToken = next.accessToken;
        session.refreshToken = next.refreshToken;
        session.expiresAt = this.now() + next.expiresIn * 1000;
        session.user = next.user;
        this.snapshot = { status: "authenticated", user: next.user };
        this.notify();
        return session;
      })
      .catch(() => {
        this.clear(session);
        return null;
      })
      .finally(() => {
        this.refreshInFlight.delete(session);
      });
    this.refreshInFlight.set(session, refresh);
    return refresh;
  }

  private setSession(session: TokenSession): void {
    this.current = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: this.now() + session.expiresIn * 1000,
      user: session.user,
    };
    this.snapshot = { status: "authenticated", user: session.user };
    this.notify();
  }

  private setUser(user: UserProfile): void {
    if (!this.current) return;
    this.current.user = user;
    this.snapshot = { status: "authenticated", user };
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
