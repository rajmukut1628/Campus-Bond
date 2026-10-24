export function connectionHint(error) {
  const message = String(error?.message || '');
  if (/TLS|SSL|ssl|tls/.test(message)) return 'Atlas TLS handshake failed. Check the cluster primary, IP access list and network route. TLS verification remains enabled.';
  if (error?.code === 18 || /Authentication failed/i.test(message)) return 'Database authentication failed. Check the private database credentials.';
  if (/ENOTFOUND|querySrv|ECONNREFUSED|timed out/i.test(message)) return 'Database is unreachable. Check DNS, network access and cluster availability.';
  return `Database connection failed (${error?.name || 'Error'}).`;
}
export async function connectWithRetry(connect, { signal, disconnect = async () => {}, report = console.error, wait = delay } = {}) {
  let attempt = 0;
  while (!signal?.aborted) {
    try { await connect(); return; }
    catch (error) {
      await disconnect();
      if (signal?.aborted) return;
      if (error?.name !== 'MongooseServerSelectionError' && error?.name !== 'MongoServerSelectionError' && error?.name !== 'MongoNetworkError') throw error;
      const ms = Math.min(30000, 2000 * 2 ** Math.min(attempt++, 4));
      report(`${connectionHint(error)} Retrying in ${ms / 1000}s; existing data is unchanged.`);
      await wait(ms, signal);
    }
  }
}
function delay(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}
