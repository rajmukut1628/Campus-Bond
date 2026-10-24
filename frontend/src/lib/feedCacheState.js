export function feedStreamKey(url) {
  if (!url) return null;
  const [path,query]=url.split('?'), params=new URLSearchParams(query);
  return `${path}:${params.get('mode') || 'for-you'}:${params.get('visibility') || 'published'}`;
}
export function feedSnapshot(bucket,url) {
  if (!url) return null;
  return bucket.entries.get(url)?.data || (bucket.retained?.stream === feedStreamKey(url) ? bucket.retained.data : null);
}
export function invalidateFeed(bucket,url,currentData,keepPrevious=false) {
  bucket.generation++;
  for(const controller of bucket.controllers)controller.abort();
  bucket.controllers.clear();
  const data=bucket.entries.get(url)?.data || currentData;
  bucket.entries.clear();
  if(url && data)bucket.entries.set(url,{data,time:0});
  bucket.retained=keepPrevious && data ? {stream:feedStreamKey(url),data} : null;
}
