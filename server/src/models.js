import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const text = (max, required = false) => ({
  type: String,
  trim: true,
  maxlength: max,
  required,
});
const accountStatus = {
  type: String,
  enum: ["active", "suspended", "blocked", "deleted"],
  default: "active",
};
const options = { timestamps: true, strict: "throw" };
const userSchema = new Schema(
  {
    name: text(100, true),
    email: { ...text(180, true), lowercase: true, unique: true },
    universityId: { ...text(60, true), unique: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["student", "alumni", "admin", "superadmin"],
      required: true,
    },
    active: { type: Boolean, default: true },
    status: accountStatus,
    suspensionUntil: Date,
    suspensionReason: text(500),
    deletedAt: Date,
    tokenVersion: { type: Number, default: 0 },
    managementVersion: { type: Number, default: 0, select: false },
    department: text(100),
    batch: text(60),
    graduationYear: { type: Number, min: 1950, max: 2100 },
    emailVerified: { type: Boolean, default: true },
    interests: [{ type: String, maxlength: 60 }],
    bio: text(2000),
    headline: text(160),
    phone: text(40),
    createdBy: ref("User", false),
    conversionVersion: { type: Number, default: 0, select: false },
    workExperience: [
      {
        company: text(120, true),
        position: text(120, true),
        location: text(160),
        description: text(2000),
        startDate: Date,
        endDate: Date,
        current: { type: Boolean, default: false },
      },
    ],
    qualifications: [
      {
        title: text(160, true),
        institution: text(160, true),
        year: { type: Number, min: 1950, max: 2100 },
      },
    ],
    socialLinks: [{ label: text(40, true), url: text(500, true) }],
    skills: [{ type: String, maxlength: 60 }],
    company: text(120),
    position: text(120),
    experience: text(3000),
    linkedin: text(500),
    avatar: text(500),
    mentoring: { type: Boolean, default: true },
  },
  options,
);
userSchema.index({ status: 1, suspensionUntil: 1 });
userSchema.index({ role: 1, status: 1, name: 1, _id: 1 });
userSchema.index({ role: 1, batch: 1, department: 1, _id: 1 });
userSchema.set("toJSON", {
  transform: (_, obj) => {
    delete obj.password;
    delete obj.tokenVersion;
    delete obj.managementVersion;
    delete obj.conversionVersion;
    delete obj.__v;
    return obj;
  },
});
export const User = model("User", userSchema);
export const VerifiedUser = model(
  "VerifiedUser",
  new Schema(
    {
      email: { ...text(180, true), lowercase: true, unique: true },
      universityId: { ...text(60, true), unique: true },
      name: text(100, true),
      role: { type: String, enum: ["student", "alumni"], required: true },
      department: text(100),
      batch: text(60),
      active: { type: Boolean, default: true },
      claimed: { type: Boolean, default: false },
      claimedBy: ref("User", false),
      status: accountStatus,
      suspensionUntil: Date,
      suspensionReason: text(500),
      deletedAt: Date,
      createdBy: ref("User"),
    },
    options,
  ),
);
VerifiedUser.schema.index({ status: 1, suspensionUntil: 1 });
const mentorshipSchema = new Schema(
  {
    student: ref("User"),
    mentor: ref("User"),
    title: text(160, true),
    description: text(3000, true),
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed"],
      default: "pending",
    },
    mentorStartedAt: Date,
    accessVersion: { type: Number, default: 0 },
    closedForConversion: { type: Boolean, default: false },
  },
  options,
);
mentorshipSchema.index({ student: 1, mentor: 1 }, { unique: true });
export const Mentorship = model("Mentorship", mentorshipSchema);
export const Message = model(
  "Message",
  new Schema(
    {
      mentorship: ref("Mentorship"),
      sender: ref("User"),
      body: text(4000, true),
      deletedAt: Date,
    },
    options,
  ),
);
Message.schema.index({ mentorship: 1, createdAt: -1 });
Message.schema.index({ mentorship: 1, sender: 1 });
export const Post = model(
  "Post",
  new Schema(
    {
      author: ref("User"),
      body: text(5000, true),
      topics: [String],
      visibility: {
        type: String,
        enum: ["published", "hidden", "archived", "deleted"],
        default: "published",
      },
    },
    options,
  ),
);
export const Job = model(
  "Job",
  new Schema(
    {
      owner: ref("User"),
      visibility: {
        type: String,
        enum: ["published", "hidden", "archived", "deleted"],
        default: "published",
      },
      topics: [String],
      cover: text(300),
      title: text(160, true),
      company: text(160, true),
      location: text(160, true),
      type: {
        type: String,
        enum: ["full-time", "part-time", "internship", "contract", "not-specified"],
        default: "full-time",
      },
      description: text(8000, true),
      status: { type: String, enum: ["open", "closed"], default: "open" },
      closesAt: { type: Date, required: true },
      applicationUrl: text(500),
      workMode: {
        type: String,
        enum: ["on-site", "remote", "hybrid", "not-specified"],
        default: "on-site",
      },
      salary: text(160),
      requirements: text(5000),
      benefits: text(3000),
      applicationEmail: text(180),
      contactNumber: text(40),
    },
    options,
  ),
);
const registration = new Schema(
  {
    user: ref("User"),
    status: {
      type: String,
      enum: ["registered", "cancelled"],
      default: "registered",
    },
    registeredAt: { type: Date, default: Date.now },
    snapshot: {
      name: String,
      email: String,
      universityId: String,
      phone: String,
    },
    addedBy: ref("User", false),
  },
  { _id: false },
);
export const Event = model(
  "Event",
  new Schema(
    {
      owner: ref("User"),
      visibility: {
        type: String,
        enum: ["published", "hidden", "archived", "deleted"],
        default: "published",
      },
      topics: [String],
      cover: text(300),
      title: text(160, true),
      description: text(8000, true),
      location: text(200, true),
      mode: { type: String, enum: ["booking", "recap"], default: "booking" },
      startsAt: { type: Date, required: function () { return this.mode !== "recap"; } },
      capacity: { type: Number, min: 1, max: 100000, required: function () { return this.mode !== "recap"; } },
      status: {
        type: String,
        enum: ["published", "cancelled"],
        default: "published",
      },
      registrations: [registration],
      organizer: text(160),
      endsAt: Date,
      registrationDeadline: Date,
      onlineUrl: text(500),
      agenda: text(4000),
      contactNumber: text(40),
    },
    options,
  ),
);
export const Donation = model(
  "Donation",
  new Schema(
    {
      owner: ref("User"),
      visibility: {
        type: String,
        enum: ["published", "hidden", "archived", "deleted"],
        default: "published",
      },
      topics: [String],
      cover: text(300),
      title: text(160, true),
      description: text(8000, true),
      mode: { type: String, enum: ["fundraising", "information"], default: "fundraising" },
      goal: { type: Number, min: 1, required: function () { return this.mode !== "information"; } },
      status: { type: String, enum: ["open", "closed"], default: "open" },
      instructions: text(3000, true),
      beneficiary: text(200),
      deadline: Date,
      purpose: text(3000),
      bkashNumber: text(40),
      nagadNumber: text(40),
      contactNumber: text(40),
    },
    options,
  ),
);
export const Contribution = model(
  "Contribution",
  new Schema(
    {
      donation: ref("Donation"),
      user: ref("User"),
      donorName: text(160),
      donorEmail: text(180),
      donorPhone: text(40),
      method: { type: String, enum: ["bkash", "nagad", "manual"], default: "manual" },
      paymentStatus: { type: String, enum: ["submitted", "awaiting_gateway", "verified", "failed"], default: "submitted" },
      reviewedAt: Date,
      amount: { type: Number, min: 1, max: 100000000, required: true },
      reference: text(160, true),
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      reviewedBy: ref("User", false),
    },
    options,
  ),
);
Contribution.schema.index({ user: 1, reference: 1 }, { unique: true });
Contribution.schema.index({ method: 1, reference: 1 }, { unique: true, partialFilterExpression: { method: { $in: ["bkash", "nagad", "card"] } } });
export const Notification = model(
  "Notification",
  new Schema(
    {
      user: ref("User"),
      body: text(500, true),
      category: { type: String, default: "" },
      actor: ref("User", false),
      eventKey: text(200),
      link: text(200),
      read: { type: Boolean, default: false },
    },
    options,
  ),
);
Notification.schema.index({ user: 1, createdAt: -1 });
Notification.schema.index({ user: 1, read: 1, category: 1, createdAt: -1 });
Notification.schema.index({ user: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } });
export const Ownership = model(
  "Ownership",
  new Schema(
    { _id: { type: String, default: "platform" }, owner: ref("User") },
    options,
  ),
);
export const AdminAudit = model(
  "AdminAudit",
  new Schema(
    {
      actor: ref("User"),
      target: Schema.Types.ObjectId,
      action: text(80, true),
      details: text(500),
    },
    options,
  ),
);
export const ActivityLog = model(
  "ActivityLog",
  new Schema(
    {
      actor: ref("User"),
      actorRole: {
        type: String,
        enum: ["admin", "alumni", "student", "superadmin"],
        required: true,
      },
      action: text(100, true),
      summary: text(200, true),
      resourceId: Schema.Types.ObjectId,
      route: text(160),
    },
    options,
  ),
);
ActivityLog.schema.index({ actorRole: 1, createdAt: -1, _id: -1 });
ActivityLog.schema.index({ actorRole: 1, actor: 1, createdAt: -1, _id: -1 });
export const AvatarAsset = model(
  "AvatarAsset",
  new Schema(
    {
      user: { ...ref("User"), unique: true },
      data: { type: Buffer, required: true, select: false },
      mime: { type: String, default: "image/webp" },
      hash: text(64, true),
      width: Number,
      height: Number,
    },
    options,
  ),
);
export const ConversionRequest = model(
  "ConversionRequest",
  new Schema(
    {
      student: ref("User"),
      graduationYear: { type: Number, required: true, min: 1950, max: 2100 },
      degree: text(160, true),
      reason: text(2000, true),
      department: text(100),
      batch: text(60),
      status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
      },
      reviewedBy: ref("User", false),
      reviewedAt: Date,
      reviewNote: text(1000),
    },
    options,
  ),
);
ConversionRequest.schema.index(
  { student: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
ConversionRequest.schema.index({ status: 1, createdAt: -1, _id: -1 });

export const EmailToken = model(
  "EmailToken",
  new Schema(
    {
      user: ref("User"),
      email: text(180, true),
      purpose: { type: String, enum: ["verify", "reset"], required: true },
      hash: { type: String, required: true, unique: true },
      expiresAt: { type: Date, required: true },
      usedAt: Date,
    },
    options,
  ),
);
EmailToken.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const CoverAsset = model(
  "CoverAsset",
  new Schema(
    {
      kind: {
        type: String,
        enum: ["jobs", "events", "donations"],
        required: true,
      },
      record: { type: Schema.Types.ObjectId, required: true },
      data: { type: Buffer, required: true, select: false },
      hash: text(64, true),
    },
    options,
  ),
);
CoverAsset.schema.index({ kind: 1, record: 1 }, { unique: true });
export const FeedInteraction = model(
  "FeedInteraction",
  new Schema(
    {
      kind: { type: String, required: true },
      record: { type: Schema.Types.ObjectId, required: true },
      user: ref("User"),
      viewedAt: Date,
      reaction: {
        type: String,
        enum: ["like", "love", "celebrate", "support", "insightful", ""],
      },
    },
    options,
  ),
);
FeedInteraction.schema.index({ kind: 1, record: 1, user: 1 }, { unique: true });
export const FeedComment = model(
  "FeedComment",
  new Schema(
    {
      kind: { type: String, required: true },
      record: { type: Schema.Types.ObjectId, required: true },
      author: ref("User"),
      body: text(2000, true),
    },
    options,
  ),
);
FeedComment.schema.index({ kind: 1, record: 1, createdAt: -1 });
export const FeedShare = model(
  "FeedShare",
  new Schema(
    {
      kind: { type: String, required: true },
      record: { type: Schema.Types.ObjectId, required: true },
      creator: ref("User"),
      token: { type: String, required: true, unique: true },
    },
    options,
  ),
);
export const ShareVisit = model(
  "ShareVisit",
  new Schema(
    {
      kind: { type: String, required: true },
      record: { type: Schema.Types.ObjectId, required: true },
      viewer: ref("User"),
      creator: ref("User"),
    },
    options,
  ),
);
ShareVisit.schema.index({ kind: 1, record: 1, viewer: 1 }, { unique: true });

export const models = {
  EmailToken,
  CoverAsset,
  FeedInteraction,
  FeedComment,
  FeedShare,
  ShareVisit,
  AvatarAsset,
  ConversionRequest,
  ActivityLog,
  Ownership,
  AdminAudit,
  User,
  VerifiedUser,
  Mentorship,
  Message,
  Post,
  Job,
  Event,
  Donation,
  Contribution,
  Notification,
};
