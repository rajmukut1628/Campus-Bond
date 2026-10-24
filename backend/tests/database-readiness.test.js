import {it, expect} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app.js';
it('reports database unavailability without querying protected data',async()=>{
 const app=createApp({secret:'test-secret-long-enough-for-test-only',origin:'http://localhost:5173',databaseReady:()=>false});
 const health=await request(app).get('/health');
 expect(health.status).toBe(503);
 expect(health.body.status).toBe('unavailable');
 const response=await request(app).get('/api/v1/auth/me');
 expect(response.status).toBe(503);
 expect(response.headers['retry-after']).toBe('10');
 expect(response.body.message).toContain('temporarily unavailable');
});
