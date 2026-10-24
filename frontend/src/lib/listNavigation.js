const prefix="campusbond:list:";
export function listKey(user,location,section="") {return `${user._id}:${user.role}:${section}:${location.key}`;}
export function readListPosition(key,storage) {
  try {storage ||= globalThis.sessionStorage;const value=JSON.parse(storage.getItem(prefix+key) || "null");return value && typeof value.values === "object" && value.values && Number.isFinite(value.scroll) ? value : null;} catch{return null;}
}
export function saveListPosition(key,value,storage) {
  try {storage ||= globalThis.sessionStorage;storage.setItem(prefix+key,JSON.stringify(value));const keys=Object.keys(storage).filter(k=>k.startsWith(prefix));while(keys.length>50)storage.removeItem(keys.shift());} catch{}
}
