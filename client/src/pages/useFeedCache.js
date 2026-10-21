import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../components/ui.jsx";

// Private to the mounted feed; never shared across account sessions.
export function useFeedCache(url, scope) {
  const store = useRef({ scope, entries: new Map(), controllers: new Set(), generation: 0 });
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: "", data: null, loading: true, error: "" });
  if (store.current.scope !== scope) {
    for (const controller of store.current.controllers) controller.abort();
    store.current = { scope, entries: new Map(), controllers: new Set(), generation: 0 };
  }
  const key = scope + url;
  useEffect(() => {
    if (!url) return;
    const bucket = store.current, cached = bucket.entries.get(url), controller = new AbortController();
    let active = true;
    bucket.controllers.add(controller);
    setState({ key, data: cached?.data || null, loading: !cached?.data, refreshing: true, error: "" });
    api.get(url, { signal: controller.signal }).then(response => {
      if (!active) return;
      bucket.entries.set(url, { data: response.data, time: Date.now() });
      setState({ key, data: response.data, loading: false, refreshing: false, error: "" });
    }).catch(error => {
      if (active && !controller.signal.aborted) setState({ key, data: cached?.data || null, loading: false, refreshing: false, error: errorText(error) });
    }).finally(() => bucket.controllers.delete(controller));
    return () => { active = false; controller.abort(); };
  }, [url, scope, version]);
  useEffect(() => () => { for (const controller of store.current.controllers) controller.abort(); }, []);
  const prefetch = target => {
    if (!target) return;
    const bucket = store.current, entry = bucket.entries.get(target);
    if (entry && (entry.pending || Date.now() - entry.time < 15000)) return;
    const controller = new AbortController(), generation = bucket.generation;
    bucket.controllers.add(controller);
    bucket.entries.set(target, { ...entry, pending: true });
    api.get(target, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted && bucket.generation === generation) bucket.entries.set(target, { data: response.data, time: Date.now() });
    }).catch(() => { if (bucket.generation === generation) bucket.entries.delete(target); })
      .finally(() => bucket.controllers.delete(controller));
  };
  const reload = () => {
    const bucket = store.current;
    bucket.generation++;
    for (const controller of bucket.controllers) controller.abort();
    bucket.entries.clear();
    setVersion(v => v + 1);
  };
  const updateFavorite = (kind, id, favorite) => {
    const bucket = store.current;
    bucket.generation++;
    for (const controller of bucket.controllers) controller.abort();
    const patch = (data, target) => {
      if (!data) return data;
      const favorites = new URLSearchParams(target.split("?")[1]).get("mode") === "favorites";
      const removed = favorites && !favorite && data.items.some(item => item.kind === kind && item._id === id);
      const items = data.items.filter(item => !(removed && item.kind === kind && item._id === id)).map(item => item.kind === kind && item._id === id ? {...item, stats:{...item.stats, favorite}} : item);
      const total = Math.max(0, data.total - (removed ? 1 : 0));
      return {...data, items, total, pages:Math.ceil(total/20)};
    };
    for (const [target, entry] of bucket.entries) {
      if (!entry.data || (target !== url && new URLSearchParams(target.split("?")[1]).get("mode") === "favorites")) bucket.entries.delete(target);
      else bucket.entries.set(target, {...entry, data:patch(entry.data,target), pending:false});
    }
    setState(current => ({...current, data:patch(current.data,url), refreshing:false}));
  };
  const cached = store.current.entries.get(url)?.data;
  return { ...(state.key === key ? state : { data: cached || null, loading: !cached?.data, refreshing: true, error: "" }), reload, prefetch, updateFavorite };
}
