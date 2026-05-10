// sold-earn MCP server — Streamable HTTP transport.
//
// Speaks Model Context Protocol JSON-RPC 2.0 over POST. Implements:
//   initialize, tools/list, tools/call, resources/list, resources/read
//
// Auth model:
//   Reads (tools/list, resources/list, read-tools, all resources) are open
//     so any agent can discover the marketplace.
//   Writes (tools/call where the tool is marked requiresAuth=true) need
//     header X-MCP-Key: <MCP_API_KEY>. If MCP_API_KEY is unset, writes are
//     blocked entirely (fail closed).
//
// Pointing Claude Desktop at this:
//   Run `npx @modelcontextprotocol/inspector` against /api/mcp to verify,
//   then add an entry to claude_desktop_config.json (see MCP.md).

import { NextResponse } from 'next/server';
import { TOOLS, TOOLS_BY_NAME } from '@/lib/mcp/tools';
import { RESOURCE_TEMPLATES, readResource } from '@/lib/mcp/resources';

export const runtime = 'nodejs';

const SERVER_INFO = {
  name: 'sold-earn',
  version: '0.1.0',
};

// MCP protocol version we implement. Clients negotiate via initialize;
// they may request a different one and we will return the version we use.
const PROTOCOL_VERSION = '2024-11-05';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcOk = {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  // App-defined
  Unauthorized: -32001,
  ToolError: -32002,
} as const;

function ok(id: JsonRpcRequest['id'], result: unknown): JsonRpcOk {
  return { jsonrpc: '2.0', id: id ?? null, result };
}
function err(
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
}

export async function GET() {
  // Some MCP clients GET first to probe; return server info so they can
  // see the endpoint is alive without sending JSON-RPC.
  return NextResponse.json({
    server: SERVER_INFO,
    protocolVersion: PROTOCOL_VERSION,
    transport: 'streamable-http',
    endpoints: { rpc: 'POST /api/mcp' },
  });
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-mcp-key') ?? '';
  const expectedKey = process.env.MCP_API_KEY ?? '';
  const authorized = expectedKey.length > 0 && apiKey === expectedKey;

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return NextResponse.json(err(null, ErrorCodes.ParseError, 'invalid JSON'));
  }

  const handle = async (msg: JsonRpcRequest): Promise<JsonRpcOk | JsonRpcError | null> => {
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return err(msg?.id ?? null, ErrorCodes.InvalidRequest, 'bad jsonrpc envelope');
    }

    // Notifications (no id) get no response. We swallow them.
    const isNotification = msg.id === undefined || msg.id === null;

    try {
      switch (msg.method) {
        case 'initialize':
          return ok(msg.id ?? null, {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: SERVER_INFO,
            capabilities: {
              tools: {},
              resources: {},
            },
          });

        case 'notifications/initialized':
        case 'initialized':
          return isNotification ? null : ok(msg.id ?? null, {});

        case 'ping':
          return ok(msg.id ?? null, {});

        case 'tools/list':
          return ok(msg.id ?? null, {
            tools: TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          });

        case 'tools/call': {
          const params = msg.params ?? {};
          const name = typeof params.name === 'string' ? params.name : '';
          const args =
            params.arguments && typeof params.arguments === 'object'
              ? (params.arguments as Record<string, unknown>)
              : {};
          const tool = TOOLS_BY_NAME[name];
          if (!tool) {
            return err(msg.id ?? null, ErrorCodes.MethodNotFound, `unknown tool: ${name}`);
          }
          if (tool.requiresAuth && !authorized) {
            return err(
              msg.id ?? null,
              ErrorCodes.Unauthorized,
              expectedKey
                ? 'invalid X-MCP-Key'
                : 'writes disabled — MCP_API_KEY not set on server',
            );
          }
          try {
            const result = await tool.handler(args);
            return ok(msg.id ?? null, {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              isError: false,
              structuredContent: result,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'tool_failed';
            return ok(msg.id ?? null, {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true,
            });
          }
        }

        case 'resources/list':
          return ok(msg.id ?? null, {
            resources: [],
            resourceTemplates: RESOURCE_TEMPLATES,
          });

        case 'resources/read': {
          const params = msg.params ?? {};
          const uri = typeof params.uri === 'string' ? params.uri : '';
          if (!uri) {
            return err(msg.id ?? null, ErrorCodes.InvalidParams, 'uri required');
          }
          try {
            const r = await readResource(uri);
            return ok(msg.id ?? null, {
              contents: [{ uri, mimeType: r.mimeType, text: r.text }],
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'read_failed';
            return err(msg.id ?? null, ErrorCodes.ToolError, message);
          }
        }

        default:
          return err(msg.id ?? null, ErrorCodes.MethodNotFound, `unknown method: ${msg.method}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'internal_error';
      return err(msg.id ?? null, ErrorCodes.InternalError, message);
    }
  };

  // MCP supports batch requests too.
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return NextResponse.json(out);
  }
  const single = await handle(body);
  if (!single) return new Response(null, { status: 204 });
  return NextResponse.json(single);
}
