export type ProblemFieldError = {
  field: string;
  code: string;
  message: string;
};

/** RFC 9457 problem payloads returned as application/problem+json. */
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
  errors?: ProblemFieldError[];
};

export type OtpRequest = {
  phoneNumber: string;
  purpose: "SIGN_UP_OR_LOGIN";
};

export type OtpChallenge = {
  requestId: string;
  expiresAt: string;
  retryAfterSeconds: number;
};

export type SessionRequest = {
  requestId: string;
  otp: string;
};

export type AgeBand = "18_24" | "25_34" | "35_44" | "45_PLUS";

export type UserProfile = {
  id: string;
  displayName: string;
  ageBand: AgeBand;
  bio?: string;
  interestCodes: string[];
  homeAreaCode: string;
  adultVerified: boolean;
  identityVerified: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ProfilePatch = Partial<
  Pick<UserProfile, "displayName" | "ageBand" | "bio" | "interestCodes" | "homeAreaCode">
>;

export type VerificationSession = {
  verificationSessionId: string;
  providerUrl: string;
  expiresAt: string;
};

export type WithdrawalState = "SCHEDULED" | "CANCELLED" | "COMPLETED";

export type Withdrawal = {
  id: string;
  state: WithdrawalState;
  requestedAt: string;
  effectiveAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  version: number;
};

export type ActivityPolicy = {
  code: string;
  name: string;
  minimumParticipants: number;
  maximumParticipants: number;
  venuePolicy: string;
  timePolicy: string;
  alcoholPolicy: "ALLOWED" | "NOT_ALLOWED";
};

export type ActivityPolicyPage = {
  items: ActivityPolicy[];
  nextCursor?: string;
};

export type ProviderPlace = {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  longitude: number;
  latitude: number;
  providerPlaceId: string;
};

export type PlaceSearchResult = {
  places: ProviderPlace[];
  page: number;
  size: number;
  isEnd: boolean;
};


/**
 * Privacy-filtered venue output. The object is always present, but every exact
 * field is omitted (or null) unless the API authorizes the current reader.
 */
export type MeetupVenue = {
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
};

/** Exact venue input is required for creation and is never inferred from discovery output. */
export type MeetupVenueInput = {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
};

export type MeetupCreate = {
  activityCode: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  minimumParticipants: number;
  capacity: number;
  venue: MeetupVenueInput;
  cost: number;
  alcoholPolicy: "ALLOWED" | "NOT_ALLOWED";
  preparation: string;
  facilitationTemplate: string;
};

export type JoinResult = {
  participationId: string;
  state: "JOINED" | "WAITLISTED";
  meetupState: MeetupState;
  joinedCount: number;
  capacity: number;
  waitlistPosition?: number;
  quorumStatus: QuorumStatus;
};

export type CancelMeetupInput = {
  reason: string;
};

export type QuorumDecision = "PROCEED" | "CANCEL";

export type QuorumDecisionResult = {
  meetupId: string;
  state: MeetupState;
  quorumDecision: QuorumDecision;
  joinedCount: number;
  decidedAt: string;
  version: number;
  quorumStatus: Exclude<QuorumStatus, "PENDING">;
};

export type CheckInMeetupInput = {
  method: "MEETUP_CODE";
  code: string;
};

export type CheckInResult = {
  participationId: string;
  state: "CHECKED_IN";
  checkedInAt: string;
};

export type MeetupState = "OPEN" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type MeetupAllowedAction = "JOIN" | "LEAVE" | "CHECK_IN" | "CANCEL" | "QUORUM_DECISION";
export type QuorumStatus = "PENDING" | "PROCEED" | "CANCEL";

export type Meetup = {
  id: string;
  activityCode: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  minimumParticipants: number;
  capacity: number;
  venue: MeetupVenue;
  cost: number;
  alcoholPolicy: "ALLOWED" | "NOT_ALLOWED";
  preparation?: string;
  facilitationTemplate?: string;
  state: MeetupState;

  joinedCount: number;
  version: number;
  allowedActions: MeetupAllowedAction[];
  createdAt: string;
  updatedAt: string;
  joinDeadline: string;
  quorumStatus: QuorumStatus;
};
export type MyMeetup = {
  id: string;
  title: string;
  state: MeetupState;
  relation: string;
  startsAt: string;
};

export type MyMeetupPage = {
  items: MyMeetup[];
  nextCursor?: string;
};

export type MyMeetupListQuery = {
  relation?: string;
  state?: MeetupState;
  cursor?: string;
  limit?: number;
};

export type NotificationState = "UNREAD" | "READ";

export type Notification = {
  notificationId: string;
  type: string;
  createdAt: string;
  state: NotificationState;
  version: number;
  readAt?: string;
};

export type NotificationPage = {
  items: Notification[];
  nextCursor?: string;
};

export type NotificationListQuery = {
  cursor?: string;
  limit?: number;
};

export type ReadAllNotificationsResult = {
  updatedCount: number;
  readAt: string;
};

export type Message = {
  id: string;
  sender: {
    userId: string;
    displayName: string;
  };
  text: string;
  createdAt: string;
};

export type MessagePage = {
  items: Message[];
  nextCursor?: string;
};

export type MeetupMessageListQuery = {
  cursor?: string;
  limit?: number;
};

export type ReportCategory = "HARASSMENT" | "SAFETY" | "FRAUD" | "OTHER";
export type ReportUrgency = "P0" | "P1" | "P2";

export type CreateReportInput = {
  targetType: "MEETUP" | "MESSAGE";
  meetupId: string;
  messageId?: string;
  category: ReportCategory;
  urgency: ReportUrgency;
  subjectUserId?: string;
  details: string;
  evidenceUploadIds: string[];
};

export type IncidentReceipt = {
  incidentId: string;
  state: "RECEIVED";
  priority: ReportUrgency;
  submittedAt: string;
};

export type NoShowAppealCreate = {
  reason: string;
  evidenceIds?: string[];
};

export type NoShowAppealState = "SUBMITTED" | "REVIEWING" | "ACCEPTED" | "REJECTED";

export type NoShowAppeal = {
  id: string;
  attendanceId: string;
  meetupId: string;
  userId: string;
  reason: string;
  state: NoShowAppealState;
  submittedAt: string;
  deadlineAt: string;
  reviewedBy: string | null;
  resolution: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  evidenceIds: string[];
};

export type Incident = {
  incidentId: string;
  meetupId: string;
  category: string;
  urgency: ReportUrgency;
  state: string;
  priority: ReportUrgency;
  submittedAt: string;
};

export type IncidentPage = {
  items: Incident[];
  nextCursor?: string;
};

export type IncidentListQuery = {
  cursor?: string;
  limit?: number;
};

export type Block = {
  blockedUserId: string;
  createdAt: string;
};

export type BlockPage = {
  items: Block[];
  nextCursor?: string;
};

export type BlockListQuery = {
  cursor?: string;
  limit?: number;
};

export type FeedbackScore = 1 | 2 | 3 | 4 | 5;

export type FeedbackRequest = {
  expectationMatch: FeedbackScore;
  feltSafe: FeedbackScore;
  facilitationComfort: FeedbackScore;
  wouldUseAgain: FeedbackScore;
  privateComment?: string;
};
export type ImpressionTag = "KIND" | "PUNCTUAL" | "ENGAGED" | "RESPECTFUL";

export type ImpressionRequest = {
  impressions: Array<{
    recipientUserId: string;
    tags: ImpressionTag[];
  }>;
};

export type NextIntentType = "SAME_GROUP" | "SAME_ACTIVITY_NEW_PEOPLE" | "DIFFERENT_ACTIVITY";

export type NextIntentRequest = {
  type: NextIntentType;
};


export type ActionReceipt = {
  id: string;
  createdAt: string;
};

export type Participant = {
  userId: string;
  displayName: string;
  state: "JOINED" | "WAITLISTED" | "CHECKED_IN";
  waitlistPosition?: number;
  joinedAt: string;
};

export type ParticipantPage = {
  items: Participant[];
  nextCursor?: string;
};

export type ConnectionIntentRequest = {
  targetUserIds: string[];
};

export type ConnectionIntentResult = {
  results: Array<{
    targetUserId: string;
    state: "PENDING" | "MATCHED";
    connectionId?: string;
  }>;
};

export type ConnectionPage = {
  items: Array<{
    connectionId: string;
    counterpart: { userId: string; displayName: string };
    matchedAt: string;
  }>;
  nextCursor?: string;
};

export type MeetupPage = {
  items: Meetup[];
  nextCursor?: string;
};

export type MeetupListQuery = {
  cursor?: string;
  limit?: number;
  activityCode?: string;
  startsAtFrom?: string;
  startsAtTo?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxCost?: number;
  alcoholPolicy?: Meetup["alcoholPolicy"];
  joinableOnly?: boolean;
};

/** Access and refresh tokens are intentionally short-lived in-memory values. */
export type TokenSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
};

export type PushDevicePlatform = "IOS" | "ANDROID";

export type PushDeviceRegistration = {
  platform: PushDevicePlatform;
  token: string;
  lastSeenAt: string;
};

export type PushDevice = {
  deviceId: string;
  platform: PushDevicePlatform;
  lastSeenAt: string;
  createdAt: string;
};
