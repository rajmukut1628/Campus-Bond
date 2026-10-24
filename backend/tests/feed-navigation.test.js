import {describe,it,expect,vi} from "vitest";
import {readFeedPosition,saveFeedPosition,clearFeedPositions} from "../../frontend/src/lib/feedNavigation.js";
import {readConfig} from "../src/config.js";
const storage=()=>{const result={};Object.defineProperties(result,{getItem:{value:key=>result[key] ?? null},setItem:{value:(key,value)=>{result[key]=value;}},removeItem:{value:key=>{delete result[key];}}});return result;};
const position={page:2,mode:"favorites",order:"newest",visibility:"hidden",cutoff:"2026-10-24T00:00:00.000Z",scroll:1234};
describe("Feed return positions",()=>{
  it("survives a module reload and separates account, role and history entry",async()=>{
    const store=storage();saveFeedPosition("member-a:alumni:entry-a",position,store);
    vi.resetModules();const fresh=await import("../../frontend/src/lib/feedNavigation.js");
    expect(fresh.readFeedPosition("member-a:alumni:entry-a",store)).toEqual(position);
    for(const key of ["member-b:alumni:entry-a","member-a:student:entry-a","member-a:alumni:entry-b"])expect(readFeedPosition(key,store)).toBeNull();
  });
  it("clears account navigation on logout without clearing theme preferences",()=>{
    const store=storage();store.setItem("theme","dark");saveFeedPosition("a",position,store);saveFeedPosition("b",position,store);clearFeedPositions(store);
    expect(readFeedPosition("a",store)).toBeNull();expect(readFeedPosition("b",store)).toBeNull();expect(store.getItem("theme")).toBe("dark");
  });
  it("handles corrupt or unavailable storage without breaking the feed",()=>{
    const store=storage();store.setItem("campusbond:feed:a","invalid");expect(readFeedPosition("a",store)).toBeNull();
    saveFeedPosition("a",{...position,page:-1},store);expect(readFeedPosition("a",store)).toBeNull();
    const denied={getItem(){throw Error("Denied");},setItem(){throw Error("Denied");}};
    expect(readFeedPosition("a",denied)).toBeNull();expect(()=>saveFeedPosition("a",position,denied)).not.toThrow();
  });
});
it("defaults to direct access locally and a bounded Render proxy configuration",()=>{
  const env={MONGODB_URI:"mongodb://localhost/test",JWT_SECRET:"x".repeat(40),FRONTEND_ORIGIN:"https://example.test"};
  expect(readConfig(env).proxyHops).toBe(0);expect(readConfig({...env,RENDER:"true"}).proxyHops).toBe(1);
  expect(readConfig({...env,TRUST_PROXY_HOPS:"2"}).proxyHops).toBe(2);
  for(const value of ["true","-1","1.5","11"])expect(()=>readConfig({...env,TRUST_PROXY_HOPS:value})).toThrow();
});
