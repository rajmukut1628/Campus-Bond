const prefix="campusbond:feed:";
export function readFeedPosition(key, storage) {
  try {
    storage ||= globalThis.sessionStorage;
    const value=JSON.parse(storage.getItem(prefix+key) || "null");
    if(!value || !["for-you","favorites","viewed","moderation"].includes(value.mode) || !Number.isInteger(value.page) || value.page<1 || value.page>100000) return null;
    if(!["recommended","newest"].includes(value.order) || !["hidden","archived","published"].includes(value.visibility)) return null;
    if(typeof value.cutoff !== "string" || !Number.isFinite(Date.parse(value.cutoff))) return null;
    return {...value,scroll:Number.isFinite(value.scroll) ? Math.max(0,value.scroll) : 0};
  } catch {return null;}
}
export function saveFeedPosition(key,value,storage) {
  try {
    storage ||= globalThis.sessionStorage;
    storage.setItem(prefix+key,JSON.stringify(value));
    const keys=Object.keys(storage).filter(k=>k.startsWith(prefix));
    while(keys.length>50) storage.removeItem(keys.shift());
  } catch {}
}
export function clearFeedPositions(storage) {
  try {storage ||= globalThis.sessionStorage;for(const key of Object.keys(storage)) if(key.startsWith(prefix) || key.startsWith("campusbond:list:"))storage.removeItem(key);} catch {}
}
