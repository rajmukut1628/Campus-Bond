import {describe,it,expect} from "vitest";
import {canAccessRoute,loginDestination} from "../../client/src/route-access.js";
describe("Account-switch navigation isolation",()=>{
  it("always starts a fresh login on Newsfeed instead of any previous account page",()=>{
    for(const role of ["student","alumni","admin","superadmin"]) for(const previous of [undefined,"/app/verified","/app/admins","/app/conversion","/app/mentors","/app/requests","/app/messages/old-conversation","/app/profile","/app/jobs/123?source=feed","https://example.com"]) expect(loginDestination(role,previous)).toBe("/app/feed");
  });
  it("continues blocking member access to administrator routes",()=>{
    for(const role of ["student","alumni"]) for(const page of ["users","verified","admins","activity","alumni-requests"]) expect(canAccessRoute(role,`/app/${page}`)).toBe(false);
  });
  it("preserves route permissions after sign-in",()=>{
    expect(canAccessRoute("admin","/app/verified")).toBe(true);
    expect(canAccessRoute("admin","/app/admins")).toBe(false);
    expect(canAccessRoute("superadmin","/app/admins")).toBe(true);
    expect(canAccessRoute("admin","/app/mentors")).toBe(false);
    for(const role of ["student","alumni"]) expect(canAccessRoute(role,"/app/mentors")).toBe(true);
  });
});
