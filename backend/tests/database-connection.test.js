import { describe, it, expect, vi } from 'vitest';
import { connectionHint, connectWithRetry } from '../src/database-connection.js';
describe('database startup recovery', () => {
 it('retries a transient failure and connects without changing connection arguments', async () => {
  const failure = Object.assign(new Error('TLS handshake failed'), { name: 'MongooseServerSelectionError' });
  const connect = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
  const disconnect = vi.fn(), wait = vi.fn(), report = vi.fn();
  await connectWithRetry(connect, { disconnect, wait, report });
  expect(connect).toHaveBeenCalledTimes(2);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(wait).toHaveBeenCalledWith(2000, undefined);
  expect(report.mock.calls[0][0]).toContain('TLS verification remains enabled');
 });
 it('does not retry invalid credentials', async () => {
  const error = Object.assign(new Error('Authentication failed'), { code:18, name:'MongoServerError' });
  const connect = vi.fn().mockRejectedValue(error), wait = vi.fn();
  await expect(connectWithRetry(connect, { wait })).rejects.toBe(error);
  expect(connect).toHaveBeenCalledTimes(1);
  expect(wait).not.toHaveBeenCalled();
 });
 it('stops retries when shutdown is requested', async () => {
  const controller = new AbortController();
  const connect = vi.fn().mockRejectedValue(Object.assign(new Error('offline'),{name:'MongoNetworkError'}));
  const wait = vi.fn(async () => controller.abort());
  await connectWithRetry(connect,{signal:controller.signal, wait, report:()=>{}});
  expect(connect).toHaveBeenCalledTimes(1);
 });
 it('does not print a private connection string for unexpected errors',()=>{
  expect(connectionHint(new Error('mongodb://private:password@host'))).not.toContain('password');
 });
});
