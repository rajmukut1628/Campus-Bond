import { expireSuspensions } from "../src/suspensions.js";
import sharp from "sharp";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import {
  models,
  Job,
  EmailToken,
  FeedInteraction,
  FeedComment,
  FeedShare,
  ShareVisit,
  CoverAsset,
  ActivityLog,
  ConversionRequest,
  AvatarAsset,
  Ownership,
  AdminAudit,
  Post,
  User,
  VerifiedUser,
  Mentorship,
  Message,
  Event,
  Donation,
  Contribution,
  Notification,
} from "../src/models.js";
import { migrateManagement } from "../src/migrations.js";
import { readConfig } from "../src/config.js";
let db, app, users, agents;
let outbox = [];
const tokenFor = (email) =>
  new URL(
    outbox
      .filter((m) => m.to === email)
      .at(-1)
      .text.match(/https?:\/\/\S+/)[0],
  ).hash.slice(7);
const config = {
  secret: "integration-test-secret-with-at-least-32-characters",
  origin: "http://localhost:5173",
  production: false,
  sendMail: async (message) => outbox.push(message),
  recoveryRateLimit: 1000,
  authRateLimit: 1000,
  apiRateLimit: 5000,
};
const pass = "Correct-Horse-42!";
async function client() {
  const agent = request.agent(app);
  const token = (await agent.get("/api/v1/csrf")).body.token;
  return { agent, token };
}
async function call(c, method, path, data) {
  if (data?.status === "suspended" && !Object.hasOwn(data, "suspensionDays")) data = { ...data, suspensionDays: 7 };
  if (method === "post" && path === "/superadmin/admins" && data)
    data = { department: "Administration", ...data };
  let req = c.agent[method](`/api/v1${path}`)
    .set("Origin", config.origin)
    .set("X-CSRF-Token", c.token);
  return data === undefined ? req : req.send(data);
}
const future = () => new Date(Date.now() + 86400000).toISOString();
const eventBody = () => ({
  title: "Career workshop",
  description: "Meet our alumni",
  location: "Main campus",
  startsAt: future(),
  capacity: 1,
  status: "published",
});
const jobBody = () => ({
  title: "Graduate developer",
  description: "Build useful software",
  company: "Campus Labs",
  location: "Dhaka",
  type: "full-time",
  status: "open",
  closesAt: future(),
});
const campaignBody = {
  title: "Scholarship fund",
  description: "Support students",
  goal: 50000,
  instructions:
    "Submit your receipt reference after contributing through the university office.",
  status: "open",
};
beforeAll(async () => {
  db = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(db.getUri());
  await Promise.all(Object.values(models).map((m) => m.init()));
  app = createApp(config);
}, 180000);
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  outbox = [];
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
  const hash = await bcrypt.hash(pass, 4);
  users = {};
  agents = {};
  for (const [key, role] of [
    ["student", "student"],
    ["other", "student"],
    ["alumni", "alumni"],
    ["unrelated", "alumni"],
    ["admin", "admin"],
    ["superadmin", "superadmin"],
  ]) {
    users[key] = await User.create({
      name: `Test ${key}`,
      email: `${key}@university.test`,
      universityId: key,
      password: hash,
      phone: "+8801712345678",
      role,
    });
    agents[key] = await client();
    const result = await call(agents[key], "post", "/auth/login", {
      identifier: users[key].email,
      password: pass,
    });
    expect(result.status).toBe(200);
  }
});
describe("Authentication and verification", () => {
  it("supports login by ID, denies bad credentials, and blocks missing sessions", async () => {
    const c = await client();
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "student",
          password: pass,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "student",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
  });
  it("denies public activation even for verified records and provisions accounts only through an Administrator", async () => {
    const c = await client();
    const data = {
      email: "new@university.test",
      universityId: "NEW001",
      password: pass,
    };
    await VerifiedUser.create({
      email: data.email,
      universityId: data.universityId,
      name: "New Student",
      role: "student",
      createdBy: users.admin._id,
    });
    expect((await call(c, "post", "/auth/register", data)).status).toBe(403);
    expect(
      (
        await call(c, "post", "/admin/users", {
          ...data,
          name: "New Student",
          department: "CSE",
          role: "student",
        })
      ).status,
    ).toBe(401);
    const result = await call(agents.admin, "post", "/admin/users", {
      ...data,
      name: "New Student",
      department: "CSE",
      role: "student",
    });
    expect(result.status).toBe(201);
    expect(result.body.user.role).toBe("student");
    expect(result.body.user.password).toBeUndefined();
    expect(result.body.item.claimed).toBe(true);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: data.email,
          password: pass,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: data.email,
          password: pass,
        })
      ).status,
    ).toBe(200);
  });
  it("checks CSRF, origins, validation and revokes sessions", async () => {
    expect(
      (await agents.student.agent.post("/api/v1/posts").send({ body: "hello" }))
        .status,
    ).toBe(403);
    expect(
      (
        await agents.student.agent
          .post("/api/v1/posts")
          .set("X-CSRF-Token", agents.student.token)
          .set("Origin", "https://evil.test")
          .send({ body: "hello" })
      ).status,
    ).toBe(403);
    expect(
      (await call(agents.student, "post", "/posts", { body: "" })).status,
    ).toBe(422);
    expect((await call(agents.student, "post", "/auth/logout")).status).toBe(
      200,
    );
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
  });
  it("changes password and invalidates an older session", async () => {
    const old = await client();
    await call(old, "post", "/auth/login", {
      identifier: "student",
      password: pass,
    });
    expect(
      (
        await call(agents.student, "put", "/auth/password", {
          currentPassword: "wrong",
          password: "New-Password-42!",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(agents.student, "put", "/auth/password", {
          currentPassword: pass,
          password: "New-Password-42!",
        })
      ).status,
    ).toBe(200);
    expect((await call(old, "get", "/auth/me")).status).toBe(401);
  });
});
describe("Mentorship and strict conversation access", () => {
  const create = () =>
    call(agents.student, "post", "/mentorships", {
      mentor: String(users.alumni._id),
      title: "Career direction",
      description: "I would like guidance on software engineering.",
    });
  it("creates requests, rejects duplicate pairs, and only permits the selected mentor to approve", async () => {
    const result = await create();
    expect(result.status).toBe(201);
    const id = result.body.item._id;
    expect((await create()).status).toBe(409);
    expect(
      (
        await call(agents.unrelated, "patch", `/mentorships/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(agents.student, "patch", `/mentorships/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(agents.alumni, "patch", `/mentorships/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(200);
    expect((await Notification.countDocuments()).valueOf()).toBe(2);
  });
  it("denies pending, rejected, unrelated, admin, and manually addressed conversations", async () => {
    const id = (await create()).body.item._id;
    for (const method of ["get", "post"])
      expect(
        (
          await call(
            agents.student,
            method,
            `/conversations/${id}/messages`,
            method === "post" ? { body: "hello" } : undefined,
          )
        ).status,
      ).toBe(403);
    expect(
      (
        await call(agents.alumni, "patch", `/mentorships/${id}`, {
          status: "rejected",
        })
      ).status,
    ).toBe(200);
    expect(
      (await call(agents.student, "get", `/conversations/${id}/messages`))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.student,
          "get",
          `/conversations/${users.unrelated._id}/messages`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await call(agents.admin, "get", `/conversations/${id}/messages`)).status,
    ).toBe(403);
  });
  it("requires the Alumni first message, permits permanent accepted replies and preserves completed read-only history", async () => {
    const id = (await create()).body.item._id;
    await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"accepted"});
    expect((await call(agents.student,"get","/conversations")).body.items).toHaveLength(0);
    expect((await call(agents.alumni,"get","/conversations")).body.items).toHaveLength(1);
    const waiting = await call(agents.student,"get",`/conversations/${id}/messages`);
    expect(waiting.body.waitingForMentor).toBe(true);
    expect(waiting.body.canSend).toBe(false);
    expect((await call(agents.student,"post",`/conversations/${id}/messages`,{body:"First from student"})).status).toBe(403);
    expect((await call(agents.alumni,"post",`/conversations/${id}/messages`,{body:"Welcome!"})).status).toBe(201);
    expect((await call(agents.student,"post",`/conversations/${id}/messages`,{body:"Thank you"})).status).toBe(201);
    expect((await call(agents.student,"get","/conversations")).body.items).toHaveLength(1);
    expect((await call(agents.other,"get",`/conversations/${id}/messages`)).status).toBe(403);
    expect((await call(agents.admin,"get",`/conversations/${id}/messages`)).status).toBe(403);
    expect((await call(agents.other,"post",`/conversations/${id}/messages`,{body:"Intruder"})).status).toBe(403);
    expect((await call(agents.student,"patch",`/mentorships/${id}`,{status:"completed"})).status).toBe(403);
    expect((await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"accepted"})).status).toBe(403);
    expect((await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"completed"})).status).toBe(200);
    for(const actor of [agents.student,agents.alumni]) {
      const history=await call(actor,"get",`/conversations/${id}/messages`);
      expect(history.status).toBe(200); expect(history.body.total).toBe(2); expect(history.body.canSend).toBe(false);
      expect((await call(actor,"post",`/conversations/${id}/messages`,{body:"Again"})).status).toBe(403);
      expect((await call(actor,"get","/conversations")).body.items[0].status).toBe("completed");
    }
    expect(await Message.countDocuments()).toBe(2);
  });
});
describe("Roles, ownership, and community resources", () => {
  it("prevents admin privilege escalation and enforces super admin boundaries", async () => {
    expect(
      (
        await call(agents.admin, "post", "/superadmin/admins", {
          name: "Admin",
          email: "a@test.com",
          universityId: "A",
          password: pass,
          role: "superadmin",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.admin,
          "patch",
          `/admin/users/${users.superadmin._id}`,
          { active: false },
        )
      ).status,
    ).toBe(403);
    const result = await call(agents.superadmin, "post", "/superadmin/admins", {
      name: "New Admin",
      email: "newadmin@test.com",
      universityId: "ADMIN02",
      password: pass,
      role: "superadmin",
    });
    expect(result.status).toBe(201);
    expect(result.body.user.role).toBe("admin");
    await call(agents.student, "patch", "/users/me", {
      name: "Still Student",
      role: "superadmin",
    });
    expect((await User.findById(users.student._id)).role).toBe("student");
    expect((await call(agents.student, "get", "/admin/users")).status).toBe(
      403,
    );
  });
  it("allows moderators to deactivate members and blocks subsequent sessions", async () => {
    expect(
      (
        await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {
          active: false,
        })
      ).status,
    ).toBe(200);
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
  });
  it("enforces post authorship and returns real authors", async () => {
    const result = await call(agents.student, "post", "/posts", {
      body: "My university story",
    });
    const id = result.body.item._id;
    expect(
      (await call(agents.other, "patch", `/posts/${id}`, { body: "Hijacked" }))
        .status,
    ).toBe(403);
    expect((await call(agents.other, "delete", `/posts/${id}`)).status).toBe(
      403,
    );
    expect(
      (await call(agents.alumni, "get", "/posts")).body.items[0].author.name,
    ).toBe(users.student.name);
    expect((await call(agents.admin, "delete", `/posts/${id}`)).status).toBe(
      200,
    );
  });
  it("restricts job creation and editing to owners or administrators", async () => {
    expect(
      (await call(agents.student, "post", "/jobs", jobBody())).status,
    ).toBe(403);
    const result = await call(agents.alumni, "post", "/jobs", jobBody());
    expect(result.status).toBe(201);
    const id = result.body.item._id;
    expect(
      (await call(agents.unrelated, "put", `/jobs/${id}`, jobBody())).status,
    ).toBe(403);
    expect(
      (
        await call(agents.alumni, "put", `/jobs/${id}`, {
          ...jobBody(),
          title: "Updated role",
        })
      ).status,
    ).toBe(200);
    expect((await call(agents.admin, "delete", `/jobs/${id}`)).status).toBe(
      200,
    );
  });
  it("manages events, prevents duplicates, and enforces capacity under concurrent registration", async () => {
    expect(
      (await call(agents.student, "post", "/events", eventBody())).status,
    ).toBe(403);
    const result = await call(agents.admin, "post", "/events", eventBody());
    expect(result.status).toBe(201);
    const id = result.body.item._id;
    expect(
      (
        await call(agents.admin, "put", `/events/${id}`, {
          ...eventBody(),
          title: "Updated workshop",
        })
      ).status,
    ).toBe(200);
    const results = await Promise.all([
      call(agents.student, "post", `/events/${id}/register`),
      call(agents.other, "post", `/events/${id}/register`),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    const event = await Event.findById(id);
    expect(event.registrations).toHaveLength(1);
    const winner =
      String(event.registrations[0].user) === String(users.student._id)
        ? agents.student
        : agents.other;
    expect((await call(winner, "post", `/events/${id}/register`)).status).toBe(
      409,
    );
    expect((await call(agents.admin, "delete", `/events/${id}`)).status).toBe(
      200,
    );
    expect(
      (await call(agents.student, "get", `/events/${id}/participants`)).status,
    ).toBe(403);
    expect(
      (await call(agents.admin, "get", `/events/${id}/participants`)).body
        .items,
    ).toHaveLength(1);
    const empty = (await call(agents.admin, "post", "/events", eventBody()))
      .body.item._id;
    expect(
      (await call(agents.admin, "delete", `/events/${empty}`)).status,
    ).toBe(200);
  });
  it("records and reviews manual contributions once without fabricating payments", async () => {
    const result = await call(agents.admin, "post", "/donations", campaignBody);
    expect(result.status).toBe(201);
    const id = result.body.item._id;
    expect(
      (
        await call(agents.student, "post", `/donations/${id}/contributions`, {
          amount: -1,
          reference: "receipt",
        })
      ).status,
    ).toBe(422);
    const contribution = await call(
      agents.student,
      "post",
      `/donations/${id}/contributions`,
      { amount: 1500, reference: "receipt-01" },
    );
    expect(contribution.status).toBe(201);
    const cid = contribution.body.item._id;
    expect(
      (await call(agents.other, "get", "/contributions")).body.items,
    ).toHaveLength(0);
    expect(
      (
        await call(agents.student, "patch", `/contributions/${cid}`, {
          status: "approved",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(agents.admin, "patch", `/contributions/${cid}`, {
          status: "approved",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(agents.admin, "patch", `/contributions/${cid}`, {
          status: "rejected",
        })
      ).status,
    ).toBe(409);
    expect(
      (await call(agents.student, "get", `/donations/${id}`)).body.total,
    ).toBe(1500);
  });
  it("limits notifications to their recipient", async () => {
    const n = await Notification.create({
      user: users.student._id,
      body: "Private update",
    });
    expect(
      (await call(agents.other, "get", "/notifications")).body.items,
    ).toHaveLength(0);
    expect(
      (
        await call(agents.other, "patch", `/notifications/${n._id}`, {
          read: true,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(agents.student, "patch", `/notifications/${n._id}`, {
          read: true,
        })
      ).status,
    ).toBe(200);
  });
  it("rejects invalid IDs, bad URLs, and missing environment configuration", async () => {
    expect((await call(agents.student, "get", "/events/invalid")).status).toBe(
      422,
    );
    expect(
      (
        await call(agents.alumni, "post", "/jobs", {
          ...jobBody(),
          applicationUrl: "javascript:alert(1)",
        })
      ).status,
    ).toBe(422);
    expect(() => readConfig({})).toThrow("Missing environment");
  });
});

it("accepts 11-character passwords and rejects 10-character passwords across provisioning and password changes", async () => {
  const data = {
    name: "Length Student",
    email: "length@university.test",
    universityId: "LENGTH11",
    role: "student",
    department: "CSE",
  };
  expect(
    (
      await call(agents.admin, "post", "/admin/users", {
        ...data,
        password: "1234567890",
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await call(agents.admin, "post", "/admin/users", {
        ...data,
        password: "12345678901",
      })
    ).status,
  ).toBe(201);

  const c = await client();
  await call(c, "post", "/auth/login", {
    identifier: data.email,
    password: "12345678901",
  });
  expect(
    (
      await call(c, "put", "/auth/password", {
        currentPassword: "12345678901",
        password: "abcdefghij",
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await call(c, "put", "/auth/password", {
        currentPassword: "12345678901",
        password: "abcdefghijk",
      })
    ).status,
  ).toBe(200);
  const admin = {
    name: "Length Admin",
    email: "lengthadmin@university.test",
    universityId: "LENGTHADMIN",
  };
  expect(
    (
      await call(agents.superadmin, "post", "/superadmin/admins", {
        ...admin,
        password: "1234567890",
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await call(agents.superadmin, "post", "/superadmin/admins", {
        ...admin,
        password: "12345678901",
      })
    ).status,
  ).toBe(201);
});

describe("Complete account management", () => {
  const identity = (user, extra = {}) => ({
    name: user.name,
    email: user.email,
    universityId: user.universityId,
    department: "Computer Science",
    ...extra,
  });
  async function verified(user) {
    return VerifiedUser.create({
      ...identity(user),
      role: user.role,
      claimed: true,
      claimedBy: user._id,
      createdBy: users.superadmin._id,
    });
  }
  it("edits member identity, synchronizes verification, revokes sessions, and rolls back duplicates", async () => {
    const record = await verified(users.student);
    let result = await call(
      agents.admin,
      "put",
      `/admin/users/${users.student._id}`,
      identity(users.student, {
        name: "Updated Student",
        email: "updated@university.test",
        universityId: "UPDATED-ID",
      }),
    );
    expect(result.status).toBe(200);
    const synced = await VerifiedUser.findById(record._id);
    expect(synced.name).toBe("Updated Student");
    expect(synced.email).toBe("updated@university.test");
    expect(synced.universityId).toBe("UPDATED-ID");
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    result = await call(
      agents.admin,
      "put",
      `/admin/users/${users.student._id}`,
      identity(users.student, { email: users.other.email }),
    );
    expect(result.status).toBe(409);
    expect((await User.findById(users.student._id)).email).toBe(
      "updated@university.test",
    );
    expect((await VerifiedUser.findById(record._id)).email).toBe(
      "updated@university.test",
    );
    expect(
      (
        await call(agents.admin, "put", `/admin/users/${users.student._id}`, {
          name: "",
        })
      ).status,
    ).toBe(422);
  });
  it("edits claimed verification accounts and prevents role escalation or inconsistent identities", async () => {
    const record = await verified(users.alumni);
    const data = {
      ...identity(users.alumni, {
        name: "Updated Alumni",
        email: "alumnus@university.test",
      }),
      role: "alumni",
    };
    expect(
      (
        await call(
          agents.admin,
          "put",
          `/admin/verified-users/${record._id}`,
          data,
        )
      ).status,
    ).toBe(200);
    expect((await User.findById(users.alumni._id)).email).toBe(data.email);
    expect(
      (
        await call(agents.admin, "put", `/admin/verified-users/${record._id}`, {
          ...data,
          role: "student",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(agents.admin, "put", `/admin/verified-users/${record._id}`, {
          ...data,
          email: users.other.email,
        })
      ).status,
    ).toBe(409);
    expect((await VerifiedUser.findById(record._id)).email).toBe(data.email);
    expect(
      (
        await call(
          agents.student,
          "put",
          `/admin/verified-users/${record._id}`,
          data,
        )
      ).status,
    ).toBe(403);
  });
  it("suspends, blocks and reactivates linked members through verified account controls", async () => {
    const record = await verified(users.student);
    for (const status of ["suspended", "blocked", "active"]) {
      expect(
        (
          await call(
            agents.admin,
            "patch",
            `/admin/verified-users/${record._id}`,
            { status },
          )
        ).status,
      ).toBe(200);
      const user = await User.findById(users.student._id);
      expect(user.status).toBe(status);
      expect(user.active).toBe(status === "active");
      expect((await VerifiedUser.findById(record._id)).status).toBe(status);
      const c = await client();
      expect(
        (
          await call(c, "post", "/auth/login", {
            identifier: user.email,
            password: pass,
          })
        ).status,
      ).toBe(status === "active" ? 200 : 401);
    }
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    expect(
      (
        await call(
          agents.admin,
          "patch",
          `/admin/verified-users/${record._id}`,
          { status: "superadmin" },
        )
      ).status,
    ).toBe(422);
  });
  it("suspends members and immediately removes accepted messaging access", async () => {
    await verified(users.alumni);
    const relation = await Mentorship.create({
      student: users.student._id,
      mentor: users.alumni._id,
      title: "Guidance",
      description: "Career",
      status: "accepted",
    });
    expect(
      (
        await call(agents.admin, "patch", `/admin/users/${users.alumni._id}`, {
          status: "suspended",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          agents.student,
          "get",
          `/conversations/${relation._id}/messages`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await call(agents.student, "get", "/conversations")).body.items,
    ).toHaveLength(0);
  });
  it("deletes members and linked verification while retaining posts and financial history", async () => {
    const record = await verified(users.student);
    await Post.create({ author: users.student._id, body: "Retained story" });
    expect(
      (await call(agents.admin, "delete", `/admin/users/${users.student._id}`))
        .status,
    ).toBe(200);
    expect((await User.findById(users.student._id)).status).toBe("deleted");
    expect((await VerifiedUser.findById(record._id)).status).toBe("deleted");
    expect(await Post.countDocuments({ author: users.student._id })).toBe(1);
    expect(
      (await call(agents.admin, "get", "/admin/users")).body.items.some(
        (u) => u._id === String(users.student._id),
      ),
    ).toBe(false);
    expect(
      (await call(agents.admin, "get", "/admin/verified-users")).body.items,
    ).toHaveLength(0);
    expect(
      (
        await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {
          status: "active",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(await client(), "post", "/auth/register", {
          email: users.student.email,
          universityId: users.student.universityId,
          password: pass,
        })
      ).status,
    ).toBe(403);
  });
  it("deletes verified records and their linked members, including unclaimed records", async () => {
    const record = await verified(users.student);
    expect(
      (
        await call(
          agents.admin,
          "delete",
          `/admin/verified-users/${record._id}`,
        )
      ).status,
    ).toBe(200);
    expect((await User.findById(users.student._id)).status).toBe("deleted");
    const pending = await VerifiedUser.create({
      email: "pending@university.test",
      universityId: "PENDING",
      name: "Pending",
      role: "student",
      createdBy: users.admin._id,
    });
    expect(
      (
        await call(
          agents.admin,
          "patch",
          `/admin/verified-users/${pending._id}`,
          { status: "blocked" },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(await client(), "post", "/auth/register", {
          email: pending.email,
          universityId: pending.universityId,
          password: pass,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.admin,
          "delete",
          `/admin/verified-users/${pending._id}`,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          agents.admin,
          "delete",
          `/admin/verified-users/${pending._id}`,
        )
      ).status,
    ).toBe(404);
  });
  it("restricts administrator editing and deletion to the owner and protects the owner account", async () => {
    expect(
      (
        await call(
          agents.admin,
          "put",
          `/superadmin/admins/${users.admin._id}`,
          identity(users.admin),
        )
      ).status,
    ).toBe(403);
    expect(
      (await call(agents.admin, "delete", `/admin/users/${users.admin._id}`))
        .status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.superadmin,
          "delete",
          `/superadmin/admins/${users.superadmin._id}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.superadmin,
          "put",
          `/superadmin/admins/${users.admin._id}`,
          identity(users.admin, { name: "Edited Admin" }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          agents.superadmin,
          "patch",
          `/superadmin/admins/${users.admin._id}`,
          { status: "suspended" },
        )
      ).status,
    ).toBe(200);
    expect((await call(agents.admin, "get", "/admin/users")).status).toBe(401);
    expect(
      (
        await call(
          agents.superadmin,
          "delete",
          `/superadmin/admins/${users.admin._id}`,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call(agents.superadmin, "get", "/superadmin/admins")).body.items,
    ).toHaveLength(0);
  });
  it("requires owner reauthentication and an active administrator for ownership transfer", async () => {
    const payload = { adminId: String(users.admin._id), currentPassword: pass };
    expect(
      (
        await call(
          agents.admin,
          "post",
          "/superadmin/ownership/transfer",
          payload,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          agents.superadmin,
          "post",
          "/superadmin/ownership/transfer",
          { ...payload, currentPassword: "wrong" },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          agents.superadmin,
          "post",
          "/superadmin/ownership/transfer",
          { ...payload, adminId: String(users.student._id) },
        )
      ).status,
    ).toBe(409);
    await User.updateOne(
      { _id: users.admin._id },
      { $set: { active: false, status: "suspended" } },
    );
    expect(
      (
        await call(
          agents.superadmin,
          "post",
          "/superadmin/ownership/transfer",
          payload,
        )
      ).status,
    ).toBe(409);
    expect(await User.countDocuments({ role: "superadmin" })).toBe(1);
  });
  it("atomically transfers ownership, demotes the previous owner and revokes old privileged sessions", async () => {
    const result = await call(
      agents.superadmin,
      "post",
      "/superadmin/ownership/transfer",
      { adminId: String(users.admin._id), currentPassword: pass },
    );
    expect(result.status).toBe(200);
    expect(result.body.user.role).toBe("admin");
    expect((await Ownership.findById("platform")).owner.toString()).toBe(
      String(users.admin._id),
    );
    expect(await User.countDocuments({ role: "superadmin" })).toBe(1);
    expect(
      (await call(agents.superadmin, "get", "/superadmin/admins")).status,
    ).toBe(403);
    expect((await call(agents.admin, "get", "/auth/me")).status).toBe(401);
    const newOwner = await client();
    expect(
      (
        await call(newOwner, "post", "/auth/login", {
          identifier: users.admin.email,
          password: pass,
        })
      ).body.user.role,
    ).toBe("superadmin");
    expect((await call(newOwner, "get", "/superadmin/admins")).status).toBe(
      200,
    );
    const audits = await AdminAudit.find({ action: "ownership.transfer" });
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(pass);
  });
  it("allows only one winner when the same owner attempts concurrent transfers", async () => {
    const other = await User.create({
      name: "Second admin",
      email: "secondadmin@university.test",
      universityId: "SECONDADMIN",
      role: "admin",
      password: await bcrypt.hash(pass, 4),
    });
    const results = await Promise.all(
      [users.admin, other].map((u) =>
        call(agents.superadmin, "post", "/superadmin/ownership/transfer", {
          adminId: String(u._id),
          currentPassword: pass,
        }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => [403, 409].includes(r.status))).toHaveLength(
      1,
    );
    expect(await User.countDocuments({ role: "superadmin" })).toBe(1);
    expect(
      await AdminAudit.countDocuments({ action: "ownership.transfer" }),
    ).toBe(1);
  });
  it("migrates the legacy unique-role index to a singleton ownership record", async () => {
    await User.collection.createIndex(
      { role: 1 },
      { unique: true, partialFilterExpression: { role: "superadmin" } },
    );
    await migrateManagement();
    expect(
      (await User.collection.indexes()).some(
        (i) => i.unique && i.key.role === 1,
      ),
    ).toBe(false);
    expect((await Ownership.findById("platform")).owner.toString()).toBe(
      String(users.superadmin._id),
    );
  });
});

describe("Member filters and 20-row pagination", () => {
  it("defaults to students, enforces 20 rows, and keeps stable non-overlapping numbered pages", async () => {
    const hash = await bcrypt.hash(pass, 4);
    await User.insertMany(
      Array.from({ length: 43 }, (_, i) => ({
        name: "Student " + String(i).padStart(3, "0"),
        email: `page${i}@university.test`,
        universityId: `PAGE${i}`,
        role: "student",
        password: hash,
        batch: "42",
        department: "CSE",
      })),
    );
    const first = await call(
      agents.superadmin,
      "get",
      "/admin/users?limit=999",
    );
    const second = await call(agents.superadmin, "get", "/admin/users?page=2");
    const third = await call(agents.superadmin, "get", "/admin/users?page=3");
    expect(first.status).toBe(200);
    expect(first.body.effectiveRole).toBe("student");
    expect(first.body.limit).toBe(20);
    expect(first.body.total).toBe(45);
    expect(first.body.pages).toBe(3);
    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(20);
    expect(third.body.items).toHaveLength(5);
    const ids = [
      ...first.body.items,
      ...second.body.items,
      ...third.body.items,
    ].map((u) => u._id);
    expect(new Set(ids).size).toBe(45);
    expect(first.body.items.every((u) => u.role === "student")).toBe(true);
    expect(first.body.items[0].password).toBeUndefined();
    expect(first.body.items[0].tokenVersion).toBeUndefined();
  });
  it("supports explicit roles and combined case-insensitive batch, department, and name searches", async () => {
    await User.updateOne(
      { _id: users.alumni._id },
      {
        $set: {
          name: "Nadia Rahman",
          batch: "Spring 2022",
          department: "Computer Science",
        },
      },
    );
    const found = await call(
      agents.superadmin,
      "get",
      "/admin/users?q=nadia&batch=2022&department=computer",
    );
    expect(found.status).toBe(200);
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0]._id).toBe(String(users.alumni._id));
    expect(found.body.effectiveRole).toBe("all");
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/admin/users?role=student&q=Nadia",
        )
      ).body.items,
    ).toHaveLength(0);
    expect(
      (
        await call(agents.superadmin, "get", "/admin/users?role=admin")
      ).body.items.map((u) => u._id),
    ).toEqual([String(users.admin._id)]);
    expect(
      (await call(agents.superadmin, "get", "/admin/users?q=Spring")).body
        .items,
    ).toHaveLength(1);
    expect(
      (await call(agents.superadmin, "get", "/admin/users?role=all")).body
        .items,
    ).toHaveLength(5);
  });
  it("keeps deleted and privileged users hidden and validates unsafe or invalid queries", async () => {
    expect(
      (await call(agents.admin, "get", "/admin/users?role=admin")).status,
    ).toBe(403);
    expect(
      (await call(agents.student, "get", "/admin/users?role=all")).status,
    ).toBe(403);
    expect(
      (
        await call(agents.admin, "get", "/admin/users?role=all")
      ).body.items.every((u) => ["student", "alumni"].includes(u.role)),
    ).toBe(true);
    await User.updateOne(
      { _id: users.student._id },
      { $set: { status: "deleted", active: false } },
    );
    expect(
      (await call(agents.superadmin, "get", "/admin/users")).body.total,
    ).toBe(1);
    for (const path of [
      "/admin/users?page=0",
      "/admin/users?page=-2",
      "/admin/users?role=superadmin",
      "/admin/users?q[]=value",
      "/admin/users?batch[$ne]=x",
    ])
      expect((await call(agents.superadmin, "get", path)).status).toBe(422);
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/admin/users?q=" + encodeURIComponent(".*"),
        )
      ).body.total,
    ).toBe(0);
  });
  it("keeps batch separate from graduation year and synchronizes member/verified batch edits", async () => {
    const record = await VerifiedUser.create({
      name: users.student.name,
      email: users.student.email,
      universityId: users.student.universityId,
      role: "student",
      batch: "41",
      claimed: true,
      claimedBy: users.student._id,
      createdBy: users.admin._id,
    });
    const result = await call(
      agents.admin,
      "put",
      `/admin/users/${users.student._id}`,
      {
        name: users.student.name,
        email: users.student.email,
        universityId: users.student.universityId,
        department: "EEE",
        batch: "42",
      },
    );
    expect(result.status).toBe(200);
    expect((await User.findById(users.student._id)).batch).toBe("42");
    expect((await VerifiedUser.findById(record._id)).batch).toBe("42");
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/admin/users?batch=42&department=eee",
        )
      ).body.total,
    ).toBe(1);
  });
});
describe("Super Admin user-wise Activity", () => {
  it("denies general admins, alumni and students both activity endpoints", async () => {
    for (const key of ["admin", "student", "alumni"])
      for (const path of ["/superadmin/activity", "/superadmin/activity/users"])
        expect((await call(agents[key], "get", path)).status).toBe(403);
    expect((await request(app).get("/api/v1/superadmin/activity")).status).toBe(
      401,
    );
  });
  it("records real successful actions, separates roles, groups users and excludes sensitive payloads", async () => {
    const privateBody = "PRIVATE-MESSAGE-LIKE-POST-CONTENT";
    await call(agents.student, "post", "/posts", {
      body: privateBody,
      role: "admin",
    });
    await call(agents.alumni, "post", "/jobs", jobBody());
    await call(agents.admin, "post", "/events", eventBody());
    const logs = await call(
      agents.superadmin,
      "get",
      `/superadmin/activity?role=student&userId=${users.student._id}`,
    );
    expect(logs.status).toBe(200);
    expect(logs.body.items.some((x) => x.action === "post.created")).toBe(true);
    expect(
      logs.body.items.every(
        (x) =>
          x.actorRole === "student" &&
          x.actor._id === String(users.student._id),
      ),
    ).toBe(true);
    const grouped = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity/users?role=student&q=student",
    );
    expect(grouped.status).toBe(200);
    expect(grouped.body.items).toHaveLength(1);
    expect(grouped.body.items[0].count).toBe(2);
    expect(grouped.body.items[0].actor.email).toBe(users.student.email);
    const alumni = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity?role=alumni",
    );
    expect(alumni.body.items.some((x) => x.action === "job.created")).toBe(
      true,
    );
    expect(alumni.body.items.every((x) => x.actorRole === "alumni")).toBe(true);
    const admins = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity?role=admin",
    );
    expect(admins.body.items.some((x) => x.action === "event.created")).toBe(
      true,
    );
    const serialized = JSON.stringify(await ActivityLog.find().lean());
    expect(serialized).not.toContain(privateBody);
    expect(serialized).not.toContain(pass);
    expect(JSON.stringify(logs.body)).not.toContain("tokenVersion");
    expect(JSON.stringify(logs.body)).not.toContain("password");
    const before = await ActivityLog.countDocuments();
    await call(agents.student, "post", "/posts", { body: "" });
    expect(await ActivityLog.countDocuments()).toBe(before);
  });
  it("retains the role at action time and bounds activity and user pages to 20", async () => {
    await ActivityLog.insertMany(
      Array.from({ length: 27 }, (_, i) => ({
        actor: users.student._id,
        actorRole: "student",
        action: "fixture.action",
        summary: "Isolated test activity " + i,
      })),
    );
    const first = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity?role=student&limit=999",
    );
    const second = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity?role=student&page=2",
    );
    expect(first.body.limit).toBe(20);
    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(9);
    expect(
      new Set([...first.body.items, ...second.body.items].map((x) => x._id))
        .size,
    ).toBe(29);
    await User.updateOne(
      { _id: users.student._id },
      { $set: { role: "admin" } },
    );
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          `/superadmin/activity?role=student&userId=${users.student._id}`,
        )
      ).body.total,
    ).toBe(28);
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          `/superadmin/activity?role=admin&userId=${users.student._id}`,
        )
      ).body.total,
    ).toBe(0);
    const hash = await bcrypt.hash(pass, 4);
    const extra = await User.insertMany(
      Array.from({ length: 22 }, (_, i) => ({
        name: "Activity Person " + i,
        email: `activity${i}@university.test`,
        universityId: `ACTIVITY${i}`,
        password: hash,
        role: "student",
      })),
    );
    await ActivityLog.insertMany(
      extra.map((u) => ({
        actor: u._id,
        actorRole: "student",
        action: "fixture.login",
        summary: "Isolated test login",
      })),
    );
    const grouped = await call(
      agents.superadmin,
      "get",
      "/superadmin/activity/users?role=student",
    );
    expect(grouped.body.total).toBe(24);
    expect(grouped.body.items).toHaveLength(20);
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/superadmin/activity/users?role=student&page=2",
        )
      ).body.items,
    ).toHaveLength(4);
  });
  it("supports user/date filters and safely rejects malformed activity queries", async () => {
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          `/superadmin/activity?role=admin&userId=${users.student._id}`,
        )
      ).body.total,
    ).toBe(0);
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/superadmin/activity?role=student&from=2100-01-01T00:00:00Z",
        )
      ).body.total,
    ).toBe(0);
    for (const path of [
      "/superadmin/activity?role=superadmin",
      "/superadmin/activity?userId=bad",
      "/superadmin/activity?page=0",
      "/superadmin/activity?from=2026-10-18&to=2026-10-17",
      "/superadmin/activity/users?q[]=bad",
    ])
      expect((await call(agents.superadmin, "get", path)).status).toBe(422);
    expect(
      (
        await call(
          agents.superadmin,
          "get",
          "/superadmin/activity/users?q=" + encodeURIComponent(".*"),
        )
      ).body.total,
    ).toBe(0);
  });
});

describe("Administrator-only account provisioning", () => {
  it("provisions private phone numbers and rejects malformed numbers", async () => {
    const data = { name: "Phone Alumni", email: "phonealumni@example.com", universityId: "PHONE-ALUMNI", department: "CSE", role: "alumni", password: pass, phone: "01744439466" };
    const preview = await call(agents.admin, "post", "/admin/users/bulk-preview", { members: [data] });
    expect(preview.body.items[0].member.phone).toBe(data.phone);
    const created = await call(agents.admin, "post", "/admin/users", data);
    expect(created.status).toBe(201);
    expect(created.body.user.phone).toBe(data.phone);
    expect(await VerifiedUser.findOne({ claimedBy: created.body.user._id })).toBeTruthy();
    expect((await call(agents.admin, "post", "/admin/users", { ...data, email: "invalidphone@example.com", universityId: "BAD-PHONE", phone: "not-a-phone" })).status).toBe(422);
  });
  const account = (extra = {}) => ({
    name: "New University Member",
    email: "newmember@university.test",
    universityId: "NEW-MEMBER",
    department: "CSE",
    batch: "42",
    role: "student",
    password: "12345678910",
    ...extra,
  });
  it("creates email-verified Student/Alumni accounts and rejects unauthorized roles, duplicates and invalid departments", async () => {
    for (const actor of ["student", "alumni"])
      expect(
        (await call(agents[actor], "post", "/admin/users", account())).status,
      ).toBe(403);
    expect(
      (
        await call(
          agents.admin,
          "post",
          "/admin/users",
          account({ role: "admin" }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await call(
          agents.admin,
          "post",
          "/admin/users",
          account({ role: "superadmin" }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await call(
          agents.admin,
          "post",
          "/admin/users",
          account({ department: "FORGED" }),
        )
      ).status,
    ).toBe(422);
    const result = await call(agents.admin, "post", "/admin/users", account());
    expect(result.status).toBe(201);
    expect(result.body.user.department).toBe("CSE");
    expect(result.body.user.batch).toBe("42");
    expect(result.body.user.password).toBeUndefined();
    expect(result.body.item.claimedBy).toBe(result.body.user._id);
    expect(
      (await call(agents.admin, "post", "/admin/users", account())).status,
    ).toBe(409);

    const c = await client();
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "NEW-MEMBER",
          password: "12345678910",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "unknown@university.test",
          password: "12345678910",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          agents.admin,
          "post",
          "/admin/verified-users",
          account({
            email: "newalumni@university.test",
            universityId: "NEW-ALUMNI",
            role: "alumni",
          }),
        )
      ).status,
    ).toBe(201);
  });
  it("does not allow bare verification creation or public activation and validates department options", async () => {
    const options = await call(agents.admin, "get", "/admin/account-options");
    expect(options.body.departments).toContain("CSE");
    expect(options.body.roles).toEqual(["student", "alumni"]);
    const data = account();
    delete data.password;
    expect(
      (await call(agents.admin, "post", "/admin/verified-users", data)).status,
    ).toBe(422);
    expect(
      (await call(await client(), "post", "/auth/register", account())).status,
    ).toBe(403);
    expect(
      (
        await call(agents.superadmin, "post", "/superadmin/admins", {
          ...account({
            email: "missingdept@university.test",
            universityId: "MISSING-DEPT",
          }),
          department: undefined,
        })
      ).status,
    ).toBe(201);
  });
  it("claims only a matching unrestricted legacy verification record and keeps blocked identities reserved", async () => {
    const record = await VerifiedUser.create({
      name: "Legacy Member",
      email: "newmember@university.test",
      universityId: "NEW-MEMBER",
      role: "student",
      department: "EEE",
      createdBy: users.admin._id,
    });
    const result = await call(agents.admin, "post", "/admin/users", account());
    expect(result.status).toBe(201);
    expect(result.body.item._id).toBe(String(record._id));
    expect((await VerifiedUser.findById(record._id)).claimed).toBe(true);
    const blocked = account({
      email: "blocked@university.test",
      universityId: "BLOCKED",
    });
    await VerifiedUser.create({
      ...Object.fromEntries(
        Object.entries(blocked).filter(([k]) => k !== "password"),
      ),
      status: "blocked",
      active: false,
      createdBy: users.admin._id,
    });
    expect(
      (await call(agents.admin, "post", "/admin/users", blocked)).status,
    ).toBe(409);
  });
});
describe("Student to Alumni conversion with history retention", () => {
  const application = {
    graduationYear: new Date().getFullYear(),
    degree: "BSc in Computer Science",
    reason: "I have completed my degree and graduation requirements.",
  };
  const apply = () => call(agents.student, "post", "/conversions", application);
  it("accepts only Student applications, prevents duplicate pending requests and notifies reviewers", async () => {
    expect(
      (await call(agents.alumni, "post", "/conversions", application)).status,
    ).toBe(403);
    expect(
      (
        await call(agents.student, "post", "/conversions", {
          ...application,
          graduationYear: new Date().getFullYear() + 1,
        })
      ).status,
    ).toBe(422);
    const results = await Promise.all([apply(), apply()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await ConversionRequest.countDocuments({
        student: users.student._id,
        status: "pending",
      }),
    ).toBe(1);
    expect(
      (await call(agents.student, "get", "/conversions")).body.pending,
    ).toBe(true);
    expect(
      await Notification.countDocuments({
        user: { $in: [users.admin._id, users.superadmin._id] },
      }),
    ).toBe(2);
    expect(
      (await call(agents.other, "get", "/conversions")).body.items,
    ).toHaveLength(0);
    expect(
      (await call(agents.student, "get", "/admin/conversions")).status,
    ).toBe(403);
  });
  it("supports rejection with a reason and resubmission without changing the Student role", async () => {
    const id = (await apply()).body.item._id;
    expect(
      (
        await call(agents.admin, "patch", `/admin/conversions/${id}`, {
          status: "rejected",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(agents.admin, "patch", `/admin/conversions/${id}`, {
          status: "rejected",
          reviewNote: "Graduation confirmation is still required.",
        })
      ).status,
    ).toBe(200);
    expect((await User.findById(users.student._id)).role).toBe("student");
    expect((await apply()).status).toBe(201);
    expect((await call(agents.student, "get", "/conversions")).body.total).toBe(
      2,
    );
  });
  it("promotes the same account, keeps all historical references and closes previous Student mentorships", async () => {
    const before = await User.findById(users.student._id);
    await VerifiedUser.create({
      name: before.name,
      email: before.email,
      universityId: before.universityId,
      role: "student",
      claimed: true,
      claimedBy: before._id,
      createdBy: users.admin._id,
    });
    const relation = await Mentorship.create({
      student: before._id,
      mentor: users.alumni._id,
      title: "Old mentorship",
      description: "Guidance",
      status: "accepted",
    });
    const pending = await Mentorship.create({
      student: before._id,
      mentor: users.unrelated._id,
      title: "Pending mentorship",
      description: "Guidance",
    });
    await Message.create({
      mentorship: relation._id,
      sender: before._id,
      body: "Retained private history",
    });
    await Post.create({ author: before._id, body: "My student story" });
    const event = await Event.create({
      ...eventBody(),
      owner: users.admin._id,
      registrations: [{ user: before._id }],
    });
    const donation = await Donation.create({
      ...campaignBody,
      owner: users.admin._id,
    });
    await Contribution.create({
      donation: donation._id,
      user: before._id,
      amount: 100,
      reference: "RETAINED-RECEIPT",
    });
    const id = (await apply()).body.item._id;
    expect(
      (
        await call(agents.admin, "patch", `/admin/conversions/${id}`, {
          status: "accepted",
          reviewNote: "Graduation verified.",
        })
      ).status,
    ).toBe(200);
    const after = await User.findById(before._id);
    expect(after.role).toBe("alumni");
    expect(after.email).toBe(before.email);
    expect(after.universityId).toBe(before.universityId);
    expect(after.graduationYear).toBe(application.graduationYear);
    expect(after.mentoring).toBe(false);
    expect((await VerifiedUser.findOne({ claimedBy: before._id })).role).toBe(
      "alumni",
    );
    expect((await Mentorship.findById(relation._id)).status).toBe("completed");
    expect((await Mentorship.findById(pending._id)).status).toBe("rejected");
    expect(await Message.countDocuments({ mentorship: relation._id })).toBe(1);
    expect(await Post.countDocuments({ author: before._id })).toBe(1);
    expect(
      (await Event.findById(event._id)).registrations[0].user.toString(),
    ).toBe(String(before._id));
    expect(await Contribution.countDocuments({ user: before._id })).toBe(1);
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    const updated = await client();
    expect(
      (
        await call(updated, "post", "/auth/login", {
          identifier: before.email,
          password: pass,
        })
      ).body.user.role,
    ).toBe("alumni");
    expect(
      (await call(updated, "get", `/conversations/${relation._id}/messages`))
        .status,
    ).toBe(403);
    expect(
      (await call(updated, "get", "/conversions")).body.items[0].status,
    ).toBe("accepted");
    expect(
      (
        await call(agents.admin, "patch", `/admin/conversions/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(409);
  });
  it("allows a single review winner, denies unauthorized approval, and rolls back approval for a suspended member", async () => {
    const id = (await apply()).body.item._id;
    expect(
      (
        await call(agents.student, "patch", `/admin/conversions/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(403);
    await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {
      status: "suspended",
    });
    expect(
      (
        await call(agents.superadmin, "patch", `/admin/conversions/${id}`, {
          status: "accepted",
        })
      ).status,
    ).toBe(409);
    expect((await ConversionRequest.findById(id)).status).toBe("pending");
    await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {
      status: "active",
    });
    const results = await Promise.all(
      [agents.admin, agents.superadmin].map((c) =>
        call(c, "patch", `/admin/conversions/${id}`, { status: "accepted" }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await User.countDocuments({ _id: users.student._id, role: "alumni" }),
    ).toBe(1);
  });
});
describe("Role-aware profiles and secure picture uploads", () => {
  it("keeps administrator profile edits separate from academic and Alumni details", async () => {
    for (const role of ["admin", "superadmin"]) {
      const before = await User.findById(users[role]._id).lean();
      const result = await call(agents[role], "patch", "/users/me", {
        name: "University Administrator",
        position: "Community Operations",
        bio: "Contact the administration for university support.",
        phone: "+8801712345678",
        interests: ["Technology"],
        headline: "Alumni headline",
        skills: ["React"],
        qualifications: [{ title: "Unwanted degree", institution: "University" }],
        socialLinks: [{ label: "Portfolio", url: "https://example.com" }],
        company: "Alumni company",
        batch: "60",
        department: "FORGED",
      });
      expect(result.status).toBe(200);
      const after = await User.findById(users[role]._id).lean();
      expect(after.position).toBe("Community Operations");
      expect(after.bio).toBe("Contact the administration for university support.");
      expect(after.phone).toBe("+8801712345678");
      expect(after.interests).toEqual(["Technology"]);
      for (const key of ["headline", "skills", "qualifications", "socialLinks", "company", "batch", "department"])
        expect(after[key]).toEqual(before[key]);
      expect(after.role).toBe(role);
    }
  });

  it("saves Alumni experience, qualifications and multiple social links while enforcing role and URL limits", async () => {
    const data = {
      headline: "Senior engineer and mentor",
      bio: "A professional story",
      skills: ["React", "Leadership"],
      workExperience: [
        {
          position: "Engineer",
          company: "First Company",
          startDate: "2020-01-01",
          endDate: "2022-12-31",
          current: false,
        },
        {
          position: "Senior Engineer",
          company: "Second Company",
          startDate: "2023-01-01",
          current: true,
        },
      ],
      qualifications: [
        {
          title: "BSc Computer Science",
          institution: "University",
          year: 2020,
        },
      ],
      socialLinks: [
        { label: "LinkedIn", url: "https://linkedin.com/in/test" },
        { label: "Portfolio", url: "https://example.com" },
      ],
    };
    const result = await call(agents.alumni, "patch", "/users/me", data);
    expect(result.status).toBe(200);
    expect(result.body.user.workExperience).toHaveLength(2);
    expect(result.body.user.qualifications).toHaveLength(1);
    expect(result.body.user.socialLinks).toHaveLength(2);
    expect(
      (
        await call(agents.student, "patch", "/users/me", {
          workExperience: data.workExperience,
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(agents.alumni, "patch", "/users/me", {
          socialLinks: [{ label: "Bad", url: "javascript:alert(1)" }],
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(agents.alumni, "patch", "/users/me", {
          socialLinks: Array.from({ length: 11 }, () => ({
            label: "Link",
            url: "https://example.com",
          })),
        })
      ).status,
    ).toBe(422);
    const publicUser = (
      await call(agents.student, "get", `/users/${users.alumni._id}`)
    ).body.user;
    expect(publicUser.workExperience).toHaveLength(2);
    expect(publicUser.email).toBeUndefined();
    expect(publicUser.phone).toBeUndefined();
    expect(publicUser.universityId).toBeUndefined();
    await call(agents.student, "patch", "/users/me", {
      role: "alumni",
      department: "FORGED",
      avatar: "https://evil.test/image.png",
      name: "Student Name",
    });
    const student = await User.findById(users.student._id);
    expect(student.role).toBe("student");
    expect(student.avatar).toBeUndefined();
    expect(student.department).not.toBe("FORGED");
  });
  it("uploads real images for every role, preserves aspect ratio, stores sanitized WebP and protects downloads", async () => {
    const image = await sharp({
      create: { width: 300, height: 100, channels: 3, background: "#167b5e" },
    })
      .png()
      .toBuffer();
    for (const key of ["student", "alumni", "admin", "superadmin"]) {
      const c = agents[key];
      const response = await c.agent
        .post("/api/v1/users/me/avatar")
        .set("Origin", config.origin)
        .set("X-CSRF-Token", c.token)
        .attach("image", image, {
          filename: "profile.png",
          contentType: "image/png",
        });
      expect(response.status).toBe(200);
      expect(response.body.user.avatar).toMatch(/^\/api\/v1\/users\//);
      const download = await call(
        agents.student,
        "get",
        `/users/${users[key]._id}/avatar`,
      );
      expect(download.status).toBe(200);
      expect(download.headers["content-type"]).toContain("image/webp");
      const metadata = await sharp(download.body).metadata();
      expect(metadata.width / metadata.height).toBe(3);
      expect(metadata.exif).toBeUndefined();
    }
    expect(await AvatarAsset.countDocuments()).toBe(4);
    expect(
      (await request(app).get(`/api/v1/users/${users.alumni._id}/avatar`))
        .status,
    ).toBe(401);
    expect(
      (await call(agents.alumni, "delete", "/users/me/avatar")).status,
    ).toBe(200);
    expect(
      (await call(agents.student, "get", `/users/${users.alumni._id}/avatar`))
        .status,
    ).toBe(404);
  });
  it("rejects spoofed, malformed, oversized, SVG and unauthorized uploads", async () => {
    const c = agents.student;
    const upload = (buffer, filename, type) =>
      c.agent
        .post("/api/v1/users/me/avatar")
        .set("Origin", config.origin)
        .set("X-CSRF-Token", c.token)
        .attach("image", buffer, { filename, contentType: type });
    expect(
      (
        await upload(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
          "evil.svg",
          "image/svg+xml",
        )
      ).status,
    ).toBe(422);
    expect(
      (await upload(Buffer.from("not-an-image"), "fake.png", "image/png"))
        .status,
    ).toBe(422);
    expect(
      (await upload(Buffer.alloc(5 * 1024 * 1024 + 1), "big.png", "image/png"))
        .status,
    ).toBe(413);
    const image = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "blue" },
    })
      .jpeg()
      .toBuffer();
    expect((await upload(image, "picture.exe", "image/jpeg")).status).toBe(422);
    expect(
      (
        await c.agent.post("/api/v1/users/me/avatar").attach("image", image, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        })
      ).status,
    ).toBe(403);
    expect(await AvatarAsset.countDocuments()).toBe(0);
  });
});
describe("Resource contact numbers", () => {
  it("stores and updates clickable contact data for jobs, events and donation campaigns", async () => {
    const number = "+880 1712-345678";
    const jobs = await call(agents.alumni, "post", "/jobs", {
      ...jobBody(),
      contactNumber: number,
    });
    expect(jobs.status).toBe(201);
    expect(jobs.body.item.contactNumber).toBe(number);
    expect(
      (
        await call(agents.alumni, "put", `/jobs/${jobs.body.item._id}`, {
          ...jobBody(),
          contactNumber: "01712345678",
        })
      ).body.item.contactNumber,
    ).toBe("01712345678");
    const event = await call(agents.admin, "post", "/events", {
      ...eventBody(),
      contactNumber: number,
    });
    expect(event.status).toBe(201);
    expect(
      (await call(agents.student, "get", `/events/${event.body.item._id}`)).body
        .item.contactNumber,
    ).toBe(number);
    const donation = await call(agents.admin, "post", "/donations", {
      ...campaignBody,
      contactNumber: number,
    });
    expect(donation.status).toBe(201);
    expect(
      (
        await call(
          agents.student,
          "get",
          `/donations/${donation.body.item._id}`,
        )
      ).body.item.contactNumber,
    ).toBe(number);
    expect(
      (
        await call(agents.alumni, "post", "/jobs", {
          ...jobBody(),
          contactNumber: "<script>alert(1)</script>",
        })
      ).status,
    ).toBe(422);
  });
});
it("allows read-only graduation archives only for original active participants", async () => {
  const relation = await Mentorship.create({
    student: users.student._id,
    mentor: users.alumni._id,
    title: "Graduation archive",
    description: "Original history",
    status: "completed",
    closedForConversion: true,
  });
  await Message.create({
    mentorship: relation._id,
    sender: users.student._id,
    body: "Private retained message",
  });
  const archive = await call(
    agents.student,
    "get",
    `/mentorships/${relation._id}/archive/messages`,
  );
  expect(archive.status).toBe(200);
  expect(archive.body.readOnly).toBe(true);
  expect(archive.body.items[0].body).toBe("Private retained message");
  expect(
    (
      await call(
        agents.alumni,
        "get",
        `/mentorships/${relation._id}/archive/messages`,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await call(
        agents.other,
        "get",
        `/mentorships/${relation._id}/archive/messages`,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call(
        agents.admin,
        "get",
        `/mentorships/${relation._id}/archive/messages`,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call(
        agents.student,
        "post",
        `/conversations/${relation._id}/messages`,
        { body: "Cannot send" },
      )
    ).status,
  ).toBe(403);
  await Mentorship.updateOne(
    { _id: relation._id },
    { $set: { closedForConversion: false } },
  );
  expect(
    (
      await call(
        agents.student,
        "get",
        `/mentorships/${relation._id}/archive/messages`,
      )
    ).status,
  ).toBe(403);
});
it("accepts JPEG, WebP, GIF and AVIF image files and normalizes their display orientation", async () => {
  const c = agents.alumni;
  for (const [format, ext, mime] of [
    ["jpeg", "jpg", "image/jpeg"],
    ["webp", "webp", "image/webp"],
    ["gif", "gif", "image/gif"],
    ["avif", "avif", "image/avif"],
  ]) {
    const image = await sharp({
      create: { width: 12, height: 18, channels: 3, background: "#548b73" },
    })
      [format]()
      .toBuffer();
    const result = await c.agent
      .post("/api/v1/users/me/avatar")
      .set("Origin", config.origin)
      .set("X-CSRF-Token", c.token)
      .attach("image", image, {
        filename: "portrait." + ext,
        contentType: mime,
      });
    expect(result.status).toBe(200);
    const asset = await AvatarAsset.findOne({ user: users.alumni._id }).select(
      "+data",
    );
    const metadata = await sharp(asset.data).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(12);
    expect(metadata.height).toBe(18);
  }
  const rotated = await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#317a5c" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const result = await c.agent
    .post("/api/v1/users/me/avatar")
    .set("Origin", config.origin)
    .set("X-CSRF-Token", c.token)
    .attach("image", rotated, {
      filename: "rotated.jpg",
      contentType: "image/jpeg",
    });
  expect(result.status).toBe(200);
  const asset = await AvatarAsset.findOne({ user: users.alumni._id }).select(
    "+data",
  );
  expect(asset.width).toBe(20);
  expect(asset.height).toBe(40);
});

describe("Verified email and account recovery", () => {
  const account = {
    name: "Mail Member",
    email: "real.member+test@gmail.com",
    universityId: "MAIL01",
    department: "CSE",
    role: "student",
    password: pass,
  };
  it("creates administrator-approved accounts without verification emails and allows immediate login", async () => {
    const r = await call(agents.admin, "post", "/admin/users", account);
    expect(r.status).toBe(201);
    expect(outbox).toHaveLength(0);
    expect(await EmailToken.countDocuments()).toBe(0);
    const c = await client();
    expect((await call(c, "post", "/auth/login", { identifier: account.email, password: pass })).status).toBe(200);
    expect((await call(c, "get", "/auth/me")).status).toBe(200);
    for (const endpoint of ["/auth/verify-email", "/auth/resend-verification"])
      expect((await call(c, "post", endpoint, { email: account.email, token: "a".repeat(64) })).status).toBe(410);
    expect(outbox).toHaveLength(0);
  });
  it("resets once, revokes previous sessions and uses non-enumerating responses", async () => {
    const c = await client(),
      missing = await call(c, "post", "/auth/forgot-password", {
        email: "missing@university.test",
      }),
      exists = await call(c, "post", "/auth/forgot-password", {
        email: users.student.email,
      });
    expect(exists.body).toEqual(missing.body);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].html).toContain("Reset your password");
    const token = tokenFor(users.student.email),
      newPass = "New-Recovery-42!";
    expect(
      (
        await call(c, "post", "/auth/reset-password", {
          token,
          password: "123",
        })
      ).status,
    ).toBe(422);
    const results = await Promise.all([
      call(c, "post", "/auth/reset-password", { token, password: newPass }),
      call(c, "post", "/auth/reset-password", { token, password: newPass }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "student",
          password: pass,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call(c, "post", "/auth/login", {
          identifier: "student",
          password: newPass,
        })
      ).status,
    ).toBe(200);
  });
  it("rejects expired links, changed emails, blocked accounts and missing CSRF", async () => {
    const c = await client();
    await call(c, "post", "/auth/forgot-password", {
      email: users.student.email,
    });
    const token = tokenFor(users.student.email);
    await EmailToken.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect(
      (await call(c, "post", "/auth/reset-password", { token, password: pass }))
        .status,
    ).toBe(400);
    await call(c, "post", "/auth/forgot-password", {
      email: users.other.email,
    });
    const other = tokenFor(users.other.email);
    await User.updateOne(
      { _id: users.other._id },
      { $set: { email: "changed@university.test" } },
    );
    expect(
      (
        await call(c, "post", "/auth/reset-password", {
          token: other,
          password: pass,
        })
      ).status,
    ).toBe(400);
    await call(c, "post", "/auth/forgot-password", {
      email: users.alumni.email,
    });
    const blocked = tokenFor(users.alumni.email);
    await User.updateOne(
      { _id: users.alumni._id },
      { $set: { active: false, status: "blocked" } },
    );
    expect(
      (
        await call(c, "post", "/auth/reset-password", {
          token: blocked,
          password: pass,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await c.agent
          .post("/api/v1/auth/forgot-password")
          .send({ email: users.student.email })
      ).status,
    ).toBe(403);
  });
  it("does not require SMTP for account creation and keeps recovery failures private", async () => {
    const original = config.sendMail;
    config.sendMail = async () => { throw Error("secret smtp error"); };
    try {
      const r = await call(agents.admin, "post", "/admin/users", account);
      expect(r.status).toBe(201);
      expect(await EmailToken.countDocuments()).toBe(0);
      const c = await client();
      expect((await call(c, "post", "/auth/login", { identifier: account.email, password: pass })).status).toBe(200);
      const reset = await call(c, "post", "/auth/forgot-password", { email: account.email });
      expect(reset.status).toBe(200);
      expect(reset.body.message).not.toContain("secret");
    } finally { config.sendMail = original; }
  });
  it("allows direct login after an administrator changes an email while revoking old sessions", async () => {
    const r = await call(agents.admin, "put", `/admin/users/${users.student._id}`, {
      name: "Student Updated", email: "student.new@university.test", universityId: "student", department: "CSE"
    });
    expect(r.status).toBe(200);
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    expect(outbox).toHaveLength(0);
    const c = await client();
    expect((await call(c, "post", "/auth/login", { identifier: "student.new@university.test", password: pass })).status).toBe(200);
  });
  it("creates administrators ready for login without sending verification email", async () => {
    const data = { name: "New Administrator", email: "directadmin@example.com", universityId: "DIRECT-ADMIN", department: "Administration", password: pass };
    const result = await call(agents.superadmin, "post", "/superadmin/admins", data);
    expect(result.status).toBe(201);
    expect(outbox).toHaveLength(0);
    const c = await client();
    expect((await call(c, "post", "/auth/login", { identifier: data.email, password: pass })).status).toBe(200);
    expect((await call(c, "get", "/admin/users")).status).toBe(200);
  });
});

describe("Premium unified Newsfeed", () => {
  async function fixture() {
    const post = await Post.create({
      author: users.admin._id,
      body: "Technology update",
      topics: ["Technology"],
      createdAt: new Date("2026-01-01"),
    });
    const job = await Job.create({
      ...jobBody(),
      owner: users.alumni._id,
      topics: ["Careers"],
      createdAt: new Date("2026-01-02"),
    });
    const event = await Event.create({
      ...eventBody(),
      owner: users.admin._id,
      topics: ["Community"],
      createdAt: new Date("2026-01-03"),
    });
    const donation = await Donation.create({
      ...campaignBody,
      owner: users.admin._id,
      topics: ["Education"],
      createdAt: new Date("2026-01-04"),
    });
    return { post, job, event, donation };
  }
  it("combines resources, sorts latest and reranks when interests change", async () => {
    const f = await fixture();
    let r = await call(agents.student, "get", "/feed?mode=latest");
    expect(r.status).toBe(200);
    expect(r.body.items.map((p) => p.kind)).toEqual([
      "donations",
      "events",
      "jobs",
      "posts",
    ]);
    expect(
      r.body.items.find((p) => p.kind === "events").registrations,
    ).toBeUndefined();
    await call(agents.student, "patch", "/users/me", {
      interests: ["Technology"],
    });
    r = await call(agents.student, "get", "/feed");
    expect(r.body.items[0]._id).toBe(String(f.post._id));
    await call(agents.student, "patch", "/users/me", {
      interests: ["Careers"],
    });
    expect((await call(agents.student, "get", "/feed")).body.items[0]._id).toBe(
      String(f.job._id),
    );
    const newest = await call(agents.admin, "post", "/posts", {
      body: "Fresh after refresh",
      topics: ["Community"],
    });
    expect(
      (await call(agents.student, "get", "/feed?mode=latest")).body.items[0]
        ._id,
    ).toBe(newest.body.item._id);
  });
  it("records visible views per user, keeps stable pagination and excludes other users history", async () => {
    const f = await fixture();
    expect(
      (await call(agents.student, "get", "/feed?mode=viewed")).body.total,
    ).toBe(0);
    await call(agents.student, "put", `/feed/posts/${f.post._id}/reaction`, {
      reaction: "like",
    });
    await call(agents.student, "post", `/feed/posts/${f.post._id}/view`);
    await call(agents.student, "post", `/feed/posts/${f.post._id}/view`);
    expect(await FeedInteraction.countDocuments()).toBe(1);
    expect(
      (await call(agents.student, "get", "/feed?mode=viewed")).body.total,
    ).toBe(1);
    expect(
      (await call(agents.student, "get", "/feed")).body.items.some(
        (x) => x._id === String(f.post._id),
      ),
    ).toBe(false);
    expect(
      (await call(agents.other, "get", "/feed?mode=viewed")).body.total,
    ).toBe(0);
    await Post.insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        author: users.admin._id,
        body: "Page " + i,
      })),
    );
    const a = (await call(agents.student, "get", "/feed?mode=latest&page=1"))
        .body,
      b = (await call(agents.student, "get", "/feed?mode=latest&page=2")).body;
    expect(a.items).toHaveLength(12);
    expect(b.items).toHaveLength(12);
    expect(
      a.items.filter((x) => b.items.some((y) => y._id === x._id)),
    ).toHaveLength(0);
  });
  it("supports reaction replacement/removal and comment ownership", async () => {
    const { post } = await fixture(),
      url = `/feed/posts/${post._id}`;
    expect(
      (
        await call(agents.student, "put", url + "/reaction", {
          reaction: "like",
        })
      ).status,
    ).toBe(200);
    await call(agents.student, "put", url + "/reaction", { reaction: "love" });
    let r = await call(agents.student, "get", url);
    expect(r.body.item.stats.reactions).toEqual({ love: 1 });
    expect(r.body.item.stats.myReaction).toBe("love");
    await call(agents.student, "put", url + "/reaction", { reaction: "" });
    expect(
      (await call(agents.student, "get", url)).body.item.stats.reactions,
    ).toEqual({});
    const c = await call(agents.student, "post", url + "/comments", {
      body: "Thoughtful comment",
    });
    expect(c.status).toBe(201);
    expect(
      (await call(agents.other, "delete", "/feed/comments/" + c.body.item._id))
        .status,
    ).toBe(403);
    expect(
      (await call(agents.alumni, "get", url + "/comments")).body.items[0].author
        .name,
    ).toBe(users.student.name);
    expect(
      (await call(agents.admin, "delete", "/feed/comments/" + c.body.item._id))
        .status,
    ).toBe(200);
    expect(
      (
        await call(agents.student, "put", url + "/reaction", {
          reaction: "hack",
        })
      ).status,
    ).toBe(422);
  });
  it("counts a share only when a different member opens it and deduplicates repeat visits across links", async () => {
    const { post } = await fixture(),
      url = `/feed/posts/${post._id}`;
    const a = await call(agents.student, "post", url + "/share"),
      token = new URL(a.body.path, "http://local").searchParams.get("share");
    expect(
      (await call(agents.student, "get", url)).body.item.stats.shares,
    ).toBe(0);
    await call(agents.student, "post", url + "/share-view", { token });
    expect(await ShareVisit.countDocuments()).toBe(0);
    await call(agents.other, "post", url + "/share-view", { token });
    await call(agents.other, "post", url + "/share-view", { token });
    const b = await call(agents.alumni, "post", url + "/share");
    await call(agents.other, "post", url + "/share-view", {
      token: new URL(b.body.path, "http://local").searchParams.get("share"),
    });
    expect(
      (await call(agents.student, "get", url)).body.item.stats.shares,
    ).toBe(1);
    await call(agents.alumni, "post", url + "/share-view", { token });
    expect(await ShareVisit.countDocuments()).toBe(2);
    expect(
      (
        await call(agents.other, "post", url + "/share-view", {
          token: "a".repeat(48),
        })
      ).status,
    ).toBe(404);
  });
  it("enforces moderator hide/archive/restore/delete in feed, details, interactions and resource lists", async () => {
    const { job } = await fixture(),
      url = `/feed/jobs/${job._id}`;
    expect(
      (
        await call(agents.alumni, "patch", url + "/visibility", {
          visibility: "hidden",
        })
      ).status,
    ).toBe(403);
    for (const visibility of ["hidden", "archived"]) {
      expect(
        (await call(agents.admin, "patch", url + "/visibility", { visibility }))
          .status,
      ).toBe(200);
      expect(
        (await call(agents.student, "get", "/feed")).body.items.some(
          (p) => p._id === String(job._id),
        ),
      ).toBe(false);
      expect(
        (await call(agents.student, "get", `/jobs/${job._id}`)).status,
      ).toBe(404);
      expect(
        (await call(agents.student, "get", "/jobs")).body.items,
      ).toHaveLength(0);
      expect(
        (
          await call(agents.student, "post", url + "/comments", {
            body: "Hidden",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await call(
            agents.admin,
            "get",
            `/feed?mode=moderation&visibility=${visibility}`,
          )
        ).body.total,
      ).toBe(1);
    }
    expect(
      (await call(agents.student, "get", "/feed?mode=moderation")).status,
    ).toBe(403);
    await call(agents.admin, "patch", url + "/visibility", {
      visibility: "published",
    });
    expect((await call(agents.student, "get", `/jobs/${job._id}`)).status).toBe(
      200,
    );
    await call(agents.admin, "patch", url + "/visibility", {
      visibility: "deleted",
    });
    expect(
      (
        await call(agents.admin, "patch", url + "/visibility", {
          visibility: "published",
        })
      ).status,
    ).toBe(404);
  });
});

describe("Cover pictures, resource metadata and participant management", () => {
  it("uploads sanitized covers for all resource types, enforces ownership and hides archived pictures", async () => {
    const { default: sharp } = await import("sharp");
    const image = await sharp({
      create: { width: 90, height: 30, channels: 3, background: "#44bbaa" },
    })
      .png()
      .toBuffer();
    for (const [kind, actor, data] of [
      ["jobs", "alumni", jobBody()],
      ["events", "admin", eventBody()],
      ["donations", "admin", campaignBody],
    ]) {
      const r = await call(agents[actor], "post", "/" + kind, data),
        id = r.body.item._id;
      const upload = await agents[actor].agent
        .post(`/api/v1/${kind}/${id}/cover`)
        .set("Origin", config.origin)
        .set("X-CSRF-Token", agents[actor].token)
        .attach("image", image, "cover.png");
      expect(upload.status).toBe(200);
      expect(upload.body.item.cover).toContain("/cover?v=");
      const read = await call(agents.student, "get", `/${kind}/${id}/cover`);
      expect(read.status).toBe(200);
      expect(read.headers["content-type"]).toContain("image/webp");
      const meta = await sharp(read.body).metadata();
      expect(meta.width / meta.height).toBe(3);
      expect(
        (
          await agents.other.agent
            .post(`/api/v1/${kind}/${id}/cover`)
            .set("X-CSRF-Token", agents.other.token)
            .attach("image", image, "cover.png")
        ).status,
      ).toBe(403);
      await call(agents.admin, "patch", `/${kind}/${id}/visibility`, {
        visibility: "archived",
      });
      expect(
        (await call(agents.student, "get", `/${kind}/${id}/cover`)).status,
      ).toBe(404);
      expect(
        (await call(agents.admin, "delete", `/${kind}/${id}/cover`)).status,
      ).toBe(200);
    }
    expect(await CoverAsset.countDocuments()).toBe(0);
  });
  it("stores useful real-world post fields and rejects invalid dates and dangerous URLs", async () => {
    const job = await call(agents.alumni, "post", "/jobs", {
      ...jobBody(),
      salary: "BDT 40,000–60,000 / month",
      workMode: "hybrid",
      requirements: "JavaScript, teamwork",
      benefits: "Health insurance",
      applicationEmail: "hiring@example.com",
      topics: ["Technology"],
    });
    expect(job.body.item.salary).toContain("40,000");
    const event = await call(agents.admin, "post", "/events", {
      ...eventBody(),
      organizer: "Career office",
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      agenda: "Talk and Q&A",
      onlineUrl: "https://meet.google.com/test",
    });
    expect(event.status).toBe(201);
    expect(event.body.item.organizer).toBe("Career office");
    expect(
      (
        await call(agents.admin, "post", "/events", {
          ...eventBody(),
          endsAt: new Date().toISOString(),
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call(agents.admin, "post", "/events", {
          ...eventBody(),
          onlineUrl: "javascript:alert(1)",
        })
      ).status,
    ).toBe(422);
    const d = await call(agents.admin, "post", "/donations", {
      ...campaignBody,
      beneficiary: "Scholarship students",
      purpose: "Tuition support",
      deadline: future(),
    });
    expect(d.body.item.beneficiary).toBe("Scholarship students");
  });
  it("books from account identity, removes participants, reopens full capacity and supports manual rebooking", async () => {
    const event = (await call(agents.admin, "post", "/events", eventBody()))
        .body.item,
      id = event._id;
    expect(
      (await call(agents.student, "post", `/events/${id}/register`)).status,
    ).toBe(201);
    expect(
      (await call(agents.other, "post", `/events/${id}/register`)).status,
    ).toBe(409);
    const rows = (await call(agents.admin, "get", `/events/${id}/participants`))
      .body;
    expect(rows.total).toBe(1);
    expect(rows.items[0].snapshot).toMatchObject({
      name: users.student.name,
      email: users.student.email,
      universityId: "student",
      phone: users.student.phone,
    });
    expect(
      (
        await call(agents.other, "post", `/events/${id}/participants`, {
          user: String(users.other._id),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(agents.admin, "patch", `/events/${id}/registrations`, {
          user: String(users.student._id),
          status: "cancelled",
        })
      ).body.item.participants,
    ).toBe(0);
    expect(
      (
        await call(agents.admin, "post", `/events/${id}/participants`, {
          user: String(users.other._id),
        })
      ).status,
    ).toBe(201);
    await call(agents.admin, "patch", `/events/${id}/registrations`, {
      user: String(users.other._id),
      status: "cancelled",
    });
    expect(
      (await call(agents.student, "post", `/events/${id}/register`)).status,
    ).toBe(201);
    expect((await Event.findById(id)).registrations).toHaveLength(2);
    expect(
      (await call(agents.admin, "get", `/events/${id}/participants`)).body
        .total,
    ).toBe(1);
  });
  it("requires phone, enforces deadline and retains participation and contributions after deletion", async () => {
    await User.updateOne({ _id: users.student._id }, { $unset: { phone: 1 } });
    let event = await Event.create({ ...eventBody(), owner: users.admin._id });
    expect(
      (await call(agents.student, "post", `/events/${event._id}/register`))
        .status,
    ).toBe(422);
    expect(
      (await call(agents.other, "post", `/events/${event._id}/register`))
        .status,
    ).toBe(201);
    await call(agents.admin, "delete", `/events/${event._id}`);
    expect((await Event.findById(event._id)).registrations).toHaveLength(1);
    expect(
      (await call(agents.other, "get", `/events/${event._id}`)).status,
    ).toBe(404);
    event = await Event.create({
      ...eventBody(),
      owner: users.admin._id,
      registrationDeadline: new Date(Date.now() - 1000),
    });
    expect(
      (await call(agents.other, "post", `/events/${event._id}/register`))
        .status,
    ).toBe(409);
    const d = await Donation.create({
      ...campaignBody,
      owner: users.admin._id,
    });
    await Contribution.create({
      donation: d._id,
      user: users.other._id,
      amount: 500,
      reference: "keep",
      status: "approved",
    });
    expect(
      (await call(agents.admin, "delete", `/donations/${d._id}`)).status,
    ).toBe(200);
    expect(await Contribution.countDocuments({ donation: d._id })).toBe(1);
    expect(
      (
        await call(agents.other, "post", `/donations/${d._id}/contributions`, {
          amount: 10,
          reference: "no",
        })
      ).status,
    ).toBe(409);
  });
});
it("keeps hidden content out of the dashboard and lets an owner restore their archived job", async () => {
  const post = await Post.create({
    author: users.admin._id,
    body: "Hidden update",
    visibility: "hidden",
  });
  const job = await Job.create({
    ...jobBody(),
    owner: users.alumni._id,
    visibility: "archived",
  });
  const dash = await call(agents.student, "get", "/dashboard");
  expect(dash.body.recent).toHaveLength(0);
  expect(dash.body.stats.jobs).toBe(0);
  expect(
    (await call(agents.alumni, "get", "/jobs?mine=true")).body.items[0]._id,
  ).toBe(String(job._id));
  expect((await call(agents.alumni, "get", `/jobs/${job._id}`)).status).toBe(
    200,
  );
  expect(
    (
      await call(agents.alumni, "patch", `/jobs/${job._id}/visibility`, {
        visibility: "published",
      })
    ).status,
  ).toBe(200);
  expect((await call(agents.student, "get", `/jobs/${job._id}`)).status).toBe(
    200,
  );
});
it("keeps For you pagination stable while visible cards become viewed during the same refresh session", async () => {
  await Post.insertMany(
    Array.from({ length: 30 }, (_, i) => ({
      author: users.admin._id,
      body: "Unseen item " + i,
    })),
  );
  const cutoff = new Date().toISOString(),
    a = (
      await call(
        agents.student,
        "get",
        "/feed?page=1&cutoff=" + encodeURIComponent(cutoff),
      )
    ).body;
  for (const post of a.items)
    await call(agents.student, "post", `/feed/posts/${post._id}/view`);
  const b = (
    await call(
      agents.student,
      "get",
      "/feed?page=2&cutoff=" + encodeURIComponent(cutoff),
    )
  ).body;
  expect(a.items).toHaveLength(12);
  expect(b.items).toHaveLength(12);
  expect(b.total).toBe(30);
  expect(a.items.some((x) => b.items.some((y) => y._id === x._id))).toBe(false);
  expect(
    (await call(agents.student, "get", "/feed?cutoff=not-a-date")).status,
  ).toBe(422);
});

describe("Multiple member import preview", () => {
  const member = (extra = {}) => ({
    name: "Bulk Member",
    email: "bulk@university.test",
    universityId: "BULK001",
    department: "CSE",
    role: "student",
    batch: "50",
    password: pass,
    ...extra,
  });
  it("permits only administrators, validates limits, and keeps previews read-only without echoing passwords", async () => {
    for (const actor of ["student", "alumni"])
      expect(
        (
          await call(agents[actor], "post", "/admin/users/bulk-preview", {
            members: [member()],
          })
        ).status,
      ).toBe(403);
    expect(
      (
        await call(await client(), "post", "/admin/users/bulk-preview", {
          members: [member()],
        })
      ).status,
    ).toBe(401);
    for (const members of [
      [],
      Array.from({ length: 101 }, () => member()),
      [null],
      ["bad"],
    ])
      expect(
        (
          await call(agents.admin, "post", "/admin/users/bulk-preview", {
            members,
          })
        ).status,
      ).toBe(422);
    const logs = await ActivityLog.countDocuments(),
      count = await User.countDocuments();
    for (const actor of ["admin", "superadmin"]) {
      const r = await call(agents[actor], "post", "/admin/users/bulk-preview", {
        members: [member({ email: "Person.Name+class@gmail.com" })],
      });
      expect(r.status).toBe(200);
      expect(r.body.ready).toBe(1);
      expect(r.body.items[0].member.email).toBe("person.name+class@gmail.com");
      expect(JSON.stringify(r.body)).not.toContain(pass);
      expect(r.body.items[0].member.password).toBeUndefined();
    }
    expect(await User.countDocuments()).toBe(count);
    expect(await EmailToken.countDocuments()).toBe(0);
    expect(await ActivityLog.countDocuments()).toBe(logs);
    expect(outbox).toHaveLength(0);
  });
  it("flags every duplicate row, malformed fields, and reserved identities including deleted users", async () => {
    await User.updateOne(
      { _id: users.other._id },
      { $set: { status: "deleted", active: false } },
    );
    const r = await call(agents.admin, "post", "/admin/users/bulk-preview", {
      members: [
        member(),
        member({ email: "BULK@university.test", universityId: "BULK002" }),
        member({ email: "otherbulk@university.test" }),
        member({ email: users.other.email, universityId: "NEW003" }),
        member({
          email: "not-email",
          universityId: "",
          department: "fake",
          role: "superadmin",
          password: "short",
        }),
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.ready).toBe(0);
    expect(r.body.invalid).toBe(5);
    expect(r.body.items[0].errors.map((e) => e.field)).toContain("email");
    expect(r.body.items[2].errors.map((e) => e.field)).toContain(
      "universityId",
    );
    expect(r.body.items[3].errors.some((e) => e.field === "identity")).toBe(
      true,
    );
    expect(r.body.items[4].errors.map((e) => e.field)).toEqual(
      expect.arrayContaining([
        "email",
        "universityId",
        "department",
        "role",
        "password",
      ]),
    );
  });
  it("accepts only matching unrestricted legacy verification records and denies mismatches", async () => {
    await VerifiedUser.create({
      name: "Legacy Bulk",
      email: "legacybulk@university.test",
      universityId: "LEGACY-BULK",
      role: "student",
      active: true,
      createdBy: users.admin._id,
    });
    const matching = member({
      email: "legacybulk@university.test",
      universityId: "LEGACY-BULK",
    });
    expect(
      (
        await call(agents.admin, "post", "/admin/users/bulk-preview", {
          members: [matching],
        })
      ).body.ready,
    ).toBe(1);
    expect(
      (
        await call(agents.admin, "post", "/admin/users/bulk-preview", {
          members: [{ ...matching, role: "alumni" }],
        })
      ).body.ready,
    ).toBe(0);
    await VerifiedUser.updateOne(
      { email: matching.email },
      { $set: { status: "blocked", active: false } },
    );
    expect(
      (
        await call(agents.admin, "post", "/admin/users/bulk-preview", {
          members: [matching],
        })
      ).body.ready,
    ).toBe(0);
  });
  it("creates the reviewed valid rows through normal provisioning and safely rejects repeated creation", async () => {
    const members = [
      member(),
      member({
        email: "bulk2@university.test",
        universityId: "BULK002",
        role: "alumni",
      }),
      member({ email: "bad", universityId: "BULK-BAD" }),
    ];
    const preview = await call(
      agents.admin,
      "post",
      "/admin/users/bulk-preview",
      { members },
    );
    expect(preview.body.ready).toBe(2);
    for (const row of preview.body.items.filter((r) => r.valid)) {
      const response = await call(agents.admin, "post", "/admin/users", {
        ...row.member,
        password: pass,
      });
      expect(response.status).toBe(201);
      expect(response.body.emailSent).toBeUndefined();
      expect(response.body.user.emailVerified).toBe(false);
      expect(
        (
          await call(agents.admin, "post", "/admin/users", {
            ...row.member,
            password: pass,
          })
        ).status,
      ).toBe(409);
    }
    expect(outbox).toHaveLength(0);
    expect(
      (
        await call(agents.admin, "post", "/admin/users/bulk-preview", {
          members,
        })
      ).body.ready,
    ).toBe(0);
  });
});


describe("Timed account suspension", () => {
  it("stores the same expiry on linked records, revokes sessions, expires automatically and prevents old session reuse", async () => {
    const record = await VerifiedUser.create({ name: users.student.name, email: users.student.email, universityId: users.student.universityId, role: "student", createdBy: users.admin._id, claimed: true, claimedBy: users.student._id });
    const start = Date.now();
    const result = await call(agents.admin, "patch", `/admin/users/${users.student._id}`, { status: "suspended", suspensionDays: 3, suspensionReason: "Community policy review" });
    expect(result.status).toBe(200);
    const who = await User.findById(users.student._id), linked = await VerifiedUser.findById(record._id);
    expect(who.suspensionUntil.getTime()).toBeGreaterThanOrEqual(start + 3 * 86400000);
    expect(linked.suspensionUntil).toEqual(who.suspensionUntil);
    expect(who.suspensionReason).toBe("Community policy review");
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
    const c = await client();
    expect((await call(c, "post", "/auth/login", { identifier: users.student.email, password: pass })).status).toBe(401);
    const past = new Date(Date.now() - 1000);
    await User.updateOne({ _id: who._id }, { $set: { suspensionUntil: past } });
    await VerifiedUser.updateOne({ _id: record._id }, { $set: { suspensionUntil: past } });
    expect((await call(c, "post", "/auth/login", { identifier: users.student.email, password: pass })).status).toBe(200);
    expect((await VerifiedUser.findById(record._id)).status).toBe("active");
    expect((await User.findById(who._id)).suspensionUntil).toBeUndefined();
    expect((await call(agents.student, "get", "/auth/me")).status).toBe(401);
  });
  it("rejects missing, fractional and invalid durations; early restore clears expiry; later blocks are never auto-restored", async () => {
    for (const suspensionDays of [null, 0, -1, 1.5, 3651, "bad"]) {
      expect((await call(agents.admin, "patch", `/admin/users/${users.student._id}`, { status: "suspended", suspensionDays })).status).toBe(422);
    }
    expect((await agents.admin.agent.patch(`/api/v1/admin/users/${users.student._id}`).set("X-CSRF-Token", agents.admin.token).set("Origin", config.origin).send({status:"suspended"})).status).toBe(422);
    await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {status:"suspended",suspensionDays:1});
    await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {status:"active"});
    expect((await User.findById(users.student._id)).suspensionUntil).toBeUndefined();
    await call(agents.admin, "patch", `/admin/users/${users.student._id}`, {status:"blocked"});
    await User.updateOne({_id:users.student._id},{$set:{suspensionUntil:new Date(0)}});
    await expireSuspensions();
    expect((await User.findById(users.student._id)).status).toBe("blocked");
  });
  it("supports owner suspension of administrators and expiry through verified-account management", async () => {
    const r = await call(agents.superadmin,"patch",`/superadmin/admins/${users.admin._id}`,{status:"suspended",suspensionDays:2});
    expect(r.status).toBe(200);
    expect((await call(agents.admin,"get","/admin/users")).status).toBe(401);
    const record = await VerifiedUser.create({name:"Unclaimed Member",email:"unclaimed@example.com",universityId:"SUSPEND-UNCLAIMED",role:"alumni",createdBy:users.superadmin._id});
    expect((await call(agents.superadmin,"patch",`/admin/verified-users/${record._id}`,{status:"suspended",suspensionDays:1})).status).toBe(200);
    await VerifiedUser.updateOne({_id:record._id},{$set:{suspensionUntil:new Date(0)}});
    await expireSuspensions();
    expect((await VerifiedUser.findById(record._id)).active).toBe(true);
  });
});

 it("matches numeric batch filters exactly while preserving legacy term-text searches", async () => {
   await User.updateOne({_id:users.student._id},{$set:{batch:"45"}});
   await User.updateOne({_id:users.other._id},{$set:{batch:"145"}});
   const r = await call(agents.admin,"get","/admin/users?batch=45");
   expect(r.body.items.map(u=>u._id)).toEqual([String(users.student._id)]);
 });


describe("Mentor request status and first-message boundaries", () => {
  async function accepted() {
    const r=await call(agents.student,"post","/mentorships",{mentor:String(users.alumni._id),title:"Career guidance",description:"Please guide my career"});
    expect(r.status).toBe(201);
    await call(agents.alumni,"patch",`/mentorships/${r.body.item._id}`,{status:"accepted"});
    return r.body.item._id;
  }
  it("returns private per-student request state immediately and consistently after reload", async () => {
    const before=await call(agents.student,"get",`/users/${users.alumni._id}`);
    expect(before.body.mentorship).toBeNull();
    const result=await call(agents.student,"post","/mentorships",{mentor:String(users.alumni._id),title:"Career guidance",description:"Please guide my career"});
    for(let i=0;i<2;i++) {
      const list=await call(agents.student,"get","/mentors");
      expect(list.body.items.find(u=>u._id===String(users.alumni._id)).mentorship.status).toBe("pending");
      expect((await call(agents.student,"get",`/users/${users.alumni._id}`)).body.mentorship._id).toBe(result.body.item._id);
    }
    expect((await call(agents.other,"get",`/users/${users.alumni._id}`)).body.mentorship).toBeNull();
    expect((await call(agents.student,"post","/mentorships",{mentor:String(users.alumni._id),title:"Duplicate",description:"A duplicate request"})).status).toBe(409);
  });
  it("keeps accepted connections active without an expiry and honors pre-existing Alumni messages", async () => {
    const id=await accepted();
    await Mentorship.updateOne({_id:id},{$set:{createdAt:new Date("2000-01-01"),updatedAt:new Date("2000-01-01")}});
    await Message.create({mentorship:id,sender:users.alumni._id,body:"Existing mentor introduction"});
    expect((await call(agents.student,"post",`/conversations/${id}/messages`,{body:"A reply years later"})).status).toBe(201);
    expect((await call(agents.student,"get",`/users/${users.alumni._id}`)).body.mentorship.mentorStarted).toBe(true);
    expect((await call(agents.student,"get","/conversations")).body.items).toHaveLength(1);
  });
  it("serializes completion against a concurrent reply and permanently denies later sends", async () => {
    const id=await accepted();
    await call(agents.alumni,"post",`/conversations/${id}/messages`,{body:"Welcome"});
    const results=await Promise.all([
      call(agents.alumni,"patch",`/mentorships/${id}`,{status:"completed"}),
      call(agents.student,"post",`/conversations/${id}/messages`,{body:"Concurrent reply"})
    ]);
    expect(results[0].status).toBe(200);
    expect([201,403]).toContain(results[1].status);
    expect((await Mentorship.findById(id)).status).toBe("completed");
    expect((await call(agents.student,"post",`/conversations/${id}/messages`,{body:"Too late"})).status).toBe(403);
  });
});


describe("Alumni resource publishing", () => {
  it("allows Alumni events and help information, protects ownership and rejects monetary records on information", async () => {
    const created = await call(agents.alumni, "post", "/events", eventBody());
    expect(created.status).toBe(201);
    const event = created.body.item._id;
    expect((await call(agents.alumni, "get", `/events/${event}/member-options?q=student`)).status).toBe(200);
    expect((await call(agents.unrelated, "get", `/events/${event}/member-options?q=student`)).status).toBe(403);
    const help = await call(agents.alumni, "post", "/donations", { title: "Official blood help", description: "Contact the official blood centre.", mode: "information", instructions: "Use the official contact page.", status: "open" });
    expect(help.status).toBe(201);
    expect(help.body.item.goal).toBeNull();
    expect((await call(agents.student, "post", `/donations/${help.body.item._id}/contributions`, { amount: 100, reference: "receipt" })).status).toBe(409);
    expect((await call(agents.student, "post", "/donations", campaignBody)).status).toBe(403);
    expect((await call(agents.alumni, "post", "/donations", { ...campaignBody, goal: undefined })).status).toBe(422);
    expect((await call(agents.alumni, "post", "/donations", campaignBody)).status).toBe(201);
  });
});

it("publishes accurate event recaps without fabricated capacity and rejects bookings", async () => {
  const data = { title: "NUB seminar recap", description: "Past event from the official university source.", location: "NUB campus", mode: "recap", status: "published" };
  const result = await call(agents.alumni, "post", "/events", data);
  expect(result.status).toBe(201);
  expect(result.body.item.capacity).toBeNull();
  expect((await call(agents.student, "post", `/events/${result.body.item._id}/register`)).status).toBe(409);
  expect((await call(agents.alumni, "post", "/events", { ...data, startsAt: future() })).status).toBe(422);
});


describe("Alumni mentees and post authors", () => {
  it("keeps Alumni mentorship direction, approvals, first-message access and completion secure", async () => {
    const data = { mentor: String(users.unrelated._id), title: "Peer career guidance", description: "Please guide my career." };
    expect((await call(agents.alumni, "post", "/mentorships", { ...data, mentor: String(users.alumni._id) })).status).toBe(422);
    const created = await call(agents.alumni, "post", "/mentorships", data);
    expect(created.status).toBe(201);
    const id = created.body.item._id;
    expect((await call(agents.alumni, "post", "/mentorships", data)).status).toBe(409);
    const mentors = await call(agents.alumni, "get", "/mentors");
    expect(mentors.body.items.some(u => u._id === String(users.alumni._id))).toBe(false);
    expect(mentors.body.items.find(u => u._id === String(users.unrelated._id)).mentorship.status).toBe("pending");
    expect((await call(agents.alumni, "get", `/users/${users.unrelated._id}`)).body.mentorship._id).toBe(id);
    expect((await call(agents.alumni, "patch", `/mentorships/${id}`, { status: "accepted" })).status).toBe(403);
    expect((await call(agents.unrelated, "patch", `/mentorships/${id}`, { status: "accepted" })).status).toBe(200);
    expect((await call(agents.alumni, "get", "/conversations")).body.items).toHaveLength(0);
    expect((await call(agents.unrelated, "get", "/conversations")).body.items[0].canSend).toBe(true);
    const waiting = await call(agents.alumni, "get", `/conversations/${id}/messages`);
    expect(waiting.body.waitingForMentor).toBe(true);
    expect(waiting.body.canSend).toBe(false);
    expect((await call(agents.alumni, "post", `/conversations/${id}/messages`, { body: "Too early" })).status).toBe(403);
    expect((await call(agents.unrelated, "post", `/conversations/${id}/messages`, { body: "Welcome" })).status).toBe(201);
    expect((await call(agents.alumni, "get", "/conversations")).body.items[0].canSend).toBe(true);
    expect((await call(agents.alumni, "post", `/conversations/${id}/messages`, { body: "Thank you" })).status).toBe(201);
    expect((await call(agents.student, "get", `/conversations/${id}/messages`)).status).toBe(403);
    expect((await call(agents.alumni, "patch", `/mentorships/${id}`, { status: "completed" })).status).toBe(403);
    expect((await call(agents.unrelated, "patch", `/mentorships/${id}`, { status: "completed" })).status).toBe(200);
    for (const actor of [agents.alumni, agents.unrelated]) {
      expect((await call(actor, "post", `/conversations/${id}/messages`, { body: "Closed" })).status).toBe(403);
      const history = await call(actor, "get", `/conversations/${id}/messages`);
      expect(history.body.items).toHaveLength(2);
      expect(history.body.canSend).toBe(false);
    }
  });
  it("returns publisher identity on all resource lists and details", async () => {
    for (const [kind, body] of [["jobs",jobBody()],["events",eventBody()],["donations",campaignBody]]) {
      const created = await call(agents.alumni, "post", `/${kind}`, body);
      expect(created.status).toBe(201);
      for (const path of [`/${kind}`,`/${kind}/${created.body.item._id}`]) {
        const result = await call(agents.student, "get", path);
        const item = result.body.item || result.body.items[0];
        expect(item.owner._id).toBe(String(users.alumni._id));
        expect(item.owner.name).toBe(users.alumni.name);
        expect(item.owner.role).toBe("alumni");
      }
    }
  });
});


describe("Role-aware notification centre", () => {
  it("isolates inboxes, categorises legacy alerts, filters and paginates with accurate unread summaries", async () => {
    await Notification.insertMany(Array.from({length:25}, (_, i) => ({user:users.student._id, body:`Mentor update ${i}`, link:"/app/requests", read:i < 5})));
    await Notification.create({user:users.alumni._id, body:"Incoming request", category:"mentorship", link:"/app/requests"});
    const first=await call(agents.student,"get","/notifications?category=mentorship&status=unread");
    expect(first.status).toBe(200); expect(first.body.total).toBe(20); expect(first.body.unread).toBe(20); expect(first.body.items).toHaveLength(20);
    expect(first.body.items.every(n=>n.category==="mentorship" && !n.read)).toBe(true);
    expect((await call(agents.student,"get","/notifications?page=2")).body.items).toHaveLength(5);
    expect((await call(agents.alumni,"get","/notifications")).body.items).toHaveLength(1);
    expect((await call(agents.admin,"get","/notifications")).body.items).toHaveLength(0);
    expect((await call(agents.student,"get","/notifications?category=invalid")).status).toBe(422);
    await call(agents.student,"patch","/notifications/read");
    expect((await call(agents.student,"get","/notifications/summary")).body.unread).toBe(0);
    expect((await call(agents.alumni,"get","/notifications/summary")).body.unread).toBe(1);
    expect((await call(agents.student,"get","/notifications?status=read")).body.total).toBe(25);
  });
  it("routes relevant opportunities to members, oversight to admins, and deduplicates likes", async () => {
    await User.updateOne({_id:users.student._id},{$set:{interests:["Technology"]}});
    await User.updateOne({_id:users.other._id},{$set:{interests:["Sports"]}});
    const created=await call(agents.alumni,"post","/jobs",{...jobBody(),topics:["Technology"]});
    expect(created.status).toBe(201);
    const link=`/app/jobs/${created.body.item._id}`;
    expect(await Notification.countDocuments({user:users.student._id,link,category:"careers"})).toBe(1);
    expect(await Notification.countDocuments({user:users.other._id,link})).toBe(0);
    expect(await Notification.countDocuments({user:users.alumni._id,link})).toBe(0);
    for(const actor of ["admin","superadmin"]) expect(await Notification.countDocuments({user:users[actor]._id,link,category:"moderation"})).toBe(1);
    const path=`/feed/jobs/${created.body.item._id}`;
    await call(agents.student,"put",path+"/reaction",{reaction:"love"});
    await call(agents.student,"put",path+"/reaction",{reaction:""});
    await call(agents.student,"put",path+"/reaction",{reaction:"love"});
    expect(await Notification.countDocuments({user:users.alumni._id,category:"community",eventKey:{$exists:true}})).toBe(1);
    await call(agents.student,"post",path+"/comments",{body:"Thank you for sharing"});
    expect(await Notification.countDocuments({user:users.alumni._id,category:"community"})).toBe(2);
    const inbox=await call(agents.alumni,"get","/notifications?category=community");
    expect(inbox.body.items[0].actor.name).toBe(users.student.name);
  });
  it("notifies mentor and mentee of requests, decisions, messages and participant activity", async () => {
    const created=await call(agents.student,"post","/mentorships",{mentor:String(users.alumni._id),title:"Guidance",description:"Career guidance please"});
    const id=created.body.item._id;
    expect(await Notification.countDocuments({user:users.alumni._id,category:"mentorship"})).toBe(1);
    await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"accepted"});
    expect(await Notification.countDocuments({user:users.student._id,category:"mentorship"})).toBe(1);
    await call(agents.alumni,"post",`/conversations/${id}/messages`,{body:"Welcome"});
    expect(await Notification.countDocuments({user:users.student._id,category:"messages"})).toBe(1);
    const event=(await call(agents.alumni,"post","/events",eventBody())).body.item;
    await call(agents.student,"post",`/events/${event._id}/register`);
    expect(await Notification.countDocuments({user:users.alumni._id,link:`/app/events/${event._id}`,category:"events"})).toBe(1);
  });
});


describe("Owner-reviewed manual wallet donations", () => {
  it("counts only approved payments, protects contributor identities and prevents duplicate or repeated approval", async () => {
    const campaign=(await call(agents.alumni,"post","/donations",{...campaignBody,goal:1000,bkashNumber:"01744439466",nagadNumber:"01876585382"})).body.item;
    const url=`/donations/${campaign._id}`;
    expect((await request(app).get("/api/v1"+url)).status).toBe(401);
    const submitted=await call(agents.student,"post",url+"/contributions",{amount:500,method:"bkash",reference:" real-txn-123 "});
    expect(submitted.status).toBe(201);expect(submitted.body.item.status).toBe("pending");
    let details=await call(agents.student,"get",url);expect(details.body.total).toBe(0);expect(details.body.remaining).toBe(1000);
    expect((await call(agents.other,"post",url+"/contributions",{amount:500,method:"bkash",reference:"REAL-TXN-123"})).status).toBe(409);
    expect((await call(agents.other,"get",url+"/contributions")).status).toBe(403);
    expect((await call(agents.unrelated,"patch",`/contributions/${submitted.body.item._id}`,{status:"approved"})).status).toBe(403);
    const ledger=await call(agents.alumni,"get",url+"/contributions");expect(ledger.body.items[0].user.email).toBe(users.student.email);
    const reviewed=await Promise.all([call(agents.alumni,"patch",`/contributions/${submitted.body.item._id}`,{status:"approved"}),call(agents.admin,"patch",`/contributions/${submitted.body.item._id}`,{status:"approved"})]);
    expect(reviewed.map(r=>r.status).sort()).toEqual([200,409]);
    details=await call(agents.student,"get",url);expect(details.body.total).toBe(500);expect(details.body.remaining).toBe(500);
    const rejected=await call(agents.other,"post",url+"/contributions",{amount:200,method:"nagad",reference:"REAL-TXN-456"});
    expect((await call(agents.alumni,"patch",`/contributions/${rejected.body.item._id}`,{status:"rejected"})).status).toBe(200);
    expect((await call(agents.student,"get",url)).body.total).toBe(500);
    const tile=(await call(agents.student,"get","/donations")).body.items.find(x=>x._id===campaign._id);expect(tile.total).toBe(500);expect(tile.remaining).toBe(500);
    expect((await call(agents.alumni,"post",url+"/contributions",{amount:10,method:"bkash",reference:"OWN-REF"})).status).toBe(422);
    expect((await call(agents.student,"post",url+"/contributions",{amount:1.001,method:"bkash",reference:"BAD-REF"})).status).toBe(422);
    expect((await call(agents.student,"post",url+"/contributions",{amount:10,method:"card",reference:"FAKE-CARD"})).status).toBe(422);
  });
  it("rejects unconfigured wallet methods and does not expose the contributor list to regular members",async()=>{
    const campaign=(await call(agents.alumni,"post","/donations",campaignBody)).body.item;
    expect((await call(agents.student,"post",`/donations/${campaign._id}/contributions`,{amount:100,method:"bkash",reference:"MISSING-WALLET"})).status).toBe(422);
    expect((await call(agents.student,"get",`/donations/${campaign._id}/contributions`)).status).toBe(403);
  });
});

it("creates and edits administrators with only name, email and password, retaining academic requirements for students", async () => {
  const created=await call(agents.superadmin,"post","/superadmin/admins",{name:"System Administrator",email:"system.admin@example.com",password:pass});
  expect(created.status).toBe(201);
  expect(created.body.user.role).toBe("admin");
  expect(created.body.user.department).toBeFalsy();
  expect(created.body.user.batch).toBeFalsy();
  const id=created.body.user._id;
  const edited=await call(agents.superadmin,"put",`/superadmin/admins/${id}`,{name:"Updated Administrator",email:"updated.admin@example.com"});
  expect(edited.status).toBe(200);
  const c=await client();
  expect((await call(c,"post","/auth/login",{identifier:"updated.admin@example.com",password:pass})).status).toBe(200);
  expect((await call(agents.admin,"post","/superadmin/admins",{name:"Forbidden",email:"forbidden@example.com",password:pass})).status).toBe(403);
  expect((await call(agents.admin,"put",`/admin/users/${users.student._id}`,{name:users.student.name,email:users.student.email})).status).toBe(422);
});


describe("Private message deletion",()=>{
  it("lets each sender remove their own message while preserving mentor access and blocking other users",async()=>{
    const created=await call(agents.student,"post","/mentorships",{mentor:String(users.alumni._id),title:"Guidance",description:"Career guidance"});
    const id=created.body.item._id;
    await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"accepted"});
    const first=await call(agents.alumni,"post",`/conversations/${id}/messages`,{body:"Mentor introduction"});
    const reply=await call(agents.student,"post",`/conversations/${id}/messages`,{body:"Student reply"});
    const endpoint=`/conversations/${id}/messages/`;
    expect((await call(agents.student,"delete",endpoint+first.body.item._id)).status).toBe(403);
    expect((await call(agents.other,"delete",endpoint+first.body.item._id)).status).toBe(403);
    expect((await call(agents.admin,"delete",endpoint+first.body.item._id)).status).toBe(403);
    expect((await call(agents.alumni,"delete",endpoint+first.body.item._id)).status).toBe(200);
    const history=await call(agents.student,"get",`/conversations/${id}/messages`);
    expect(history.body.canSend).toBe(true);
    expect(history.body.counterpart.name).toBe(users.alumni.name);
    const removed=history.body.items.find(m=>m._id===first.body.item._id);
    expect(removed.deletedAt).toBeTruthy();expect(removed.body).toBe("[Message deleted]");
    expect((await call(agents.alumni,"delete",endpoint+first.body.item._id)).status).toBe(403);
    expect((await call(agents.student,"delete",endpoint+reply.body.item._id)).status).toBe(200);
    const next=await call(agents.student,"post",`/conversations/${id}/messages`,{body:"History must remain read only"});
    await call(agents.alumni,"patch",`/mentorships/${id}`,{status:"completed"});
    expect((await call(agents.student,"delete",endpoint+next.body.item._id)).status).toBe(403);
  });
});
