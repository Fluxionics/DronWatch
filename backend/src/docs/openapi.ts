export const openApiSpec: any = {
  openapi: '3.0.3',
  info: {
    title: 'DronWatch API',
    version: '1.0.0',
    description: 'Uptime monitoring, alerts, incidents, status pages, agents and synthetic checks. Auth via Bearer JWT, X-API-Key (scopes) or X-Agent-Token (agent heartbeat only).',
    contact: { url: 'https://github.com/Fluxionics/DronWatch' }
  },
  servers: [{ url: '/api', description: 'Relative – set VITE_API_URL to absolute in production' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      agentToken: { type: 'apiKey', in: 'header', name: 'X-Agent-Token' }
    }
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  paths: {
    '/auth/register': { post: { summary: 'Register', tags: ['auth'], responses: { '201': { description: 'Created' } } } },
    '/auth/login': { post: { summary: 'Login', tags: ['auth'], responses: { '200': { description: 'OK' } } } },
    '/auth/refresh': { post: { summary: 'Refresh JWT', tags: ['auth'], responses: { '200': { description: 'OK' } } } },
    '/auth/forgot-password': { post: { summary: 'Forgot password', tags: ['auth'], responses: { '200': { description: 'OK' } } } },
    '/auth/reset-password': { post: { summary: 'Reset password', tags: ['auth'], responses: { '200': { description: 'OK' } } } },
    '/monitors': { get: { summary: 'List monitors', tags: ['monitors'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create monitor', tags: ['monitors'], responses: { '201': { description: 'Created' } } } },
    '/monitors/{id}': { get: { summary: 'Get monitor', tags: ['monitors'], responses: { '200': { description: 'OK' } } }, put: { summary: 'Update monitor', tags: ['monitors'], responses: { '200': { description: 'OK' } } }, delete: { summary: 'Delete monitor', tags: ['monitors'], responses: { '204': { description: 'No content' } } } },
    '/monitors/{id}/test': { post: { summary: 'Test monitor now', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/checks': { get: { summary: 'Recent checks', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/stats': { get: { summary: 'Stats', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/report': { get: { summary: 'Service report', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/regions': { get: { summary: 'Per-region status', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/security': { get: { summary: 'Security inspector', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/{id}/anomalies': { get: { summary: 'Anomalies', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/monitors/available-regions': { get: { summary: 'List available probe regions', tags: ['monitors'], responses: { '200': { description: 'OK' } } } },
    '/alerts': { get: { summary: 'List alerts', tags: ['alerts'], responses: { '200': { description: 'OK' } } } },
    '/alerts/test': { post: { summary: 'Test a channel', tags: ['alerts'], responses: { '200': { description: 'OK' } } } },
    '/alert-rules': { get: { summary: 'List alert rules', tags: ['alerts'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create rule', tags: ['alerts'], responses: { '201': { description: 'Created' } } } },
    '/escalation-policies': { get: { summary: 'List escalation policies', tags: ['alerts'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create policy', tags: ['alerts'], responses: { '201': { description: 'Created' } } } },
    '/incidents': { get: { summary: 'List incidents', tags: ['incidents'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create incident', tags: ['incidents'], responses: { '201': { description: 'Created' } } } },
    '/status-pages': { get: { summary: 'List status pages', tags: ['status-pages'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create page', tags: ['status-pages'], responses: { '201': { description: 'Created' } } } },
    '/status-pages/public/{slug}': { get: { summary: 'Public status page', tags: ['status-pages'], responses: { '200': { description: 'OK' } } } },
    '/agents': { get: { summary: 'List agents', tags: ['agents'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create agent', tags: ['agents'], responses: { '201': { description: 'Created' } } } },
    '/agents/{id}/heartbeat': { post: { summary: 'Agent heartbeat', tags: ['agents'], responses: { '200': { description: 'OK' } } } },
    '/agents/{id}/heartbeats': { get: { summary: 'Heartbeat history', tags: ['agents'], responses: { '200': { description: 'OK' } } } },
    '/logs/ingest': { post: { summary: 'Ingest logs', tags: ['logs'], responses: { '201': { description: 'Created' } } } },
    '/logs/search': { get: { summary: 'Search logs', tags: ['logs'], responses: { '200': { description: 'OK' } } } },
    '/user/api-keys': { get: { summary: 'List API keys', tags: ['user'], responses: { '200': { description: 'OK' } } }, post: { summary: 'Create API key', tags: ['user'], responses: { '201': { description: 'Created' } } } },
    '/system/public': { get: { summary: 'Public system stats', tags: ['system'], responses: { '200': { description: 'OK' } } } },
    '/health': { get: { summary: 'Health', tags: ['system'], responses: { '200': { description: 'OK' } } } },
    '/openapi.json': { get: { summary: 'OpenAPI spec', tags: ['system'], responses: { '200': { description: 'OK' } } } },
    '/docs': { get: { summary: 'API docs', tags: ['system'], responses: { '200': { description: 'OK' } } } }
  }
}
