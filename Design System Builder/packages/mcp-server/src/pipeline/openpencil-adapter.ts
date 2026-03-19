/**
 * OpenPencil MCP adapter — wraps OpenPencil's 90 MCP tools
 * into DSB-friendly data structures for the pipeline.
 *
 * Communicates via HTTP to the OpenPencil MCP server
 * (default: localhost:3100).
 *
 * @module pipeline/openpencil-adapter
 */

import type {
  SourceAnalysis,
  SourceTree,
  VariableMap,
  ComponentRegistry,
  ReactionRecord,
  FontManifest,
  ExtractionScope,
} from './types';

/** Raw JSON-RPC response from the OpenPencil MCP server. */
interface McpResponse {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: { readonly content?: readonly { type: string; text: string }[] };
  readonly error?: { readonly code: number; readonly message: string };
}

export class OpenPencilAdapter {
  private readonly baseUrl: string;
  private requestId = 0;

  constructor(port = 3100) {
    this.baseUrl = `http://localhost:${port}/mcp`;
  }

  /** Send a JSON-RPC tool call to the OpenPencil MCP server. */
  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    });

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      throw new Error(`OpenPencil MCP error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as McpResponse;
    if (json.error) {
      throw new Error(`OpenPencil tool ${name} failed: ${json.error.message}`);
    }

    const text = json.result?.content?.[0]?.text;
    return text ? JSON.parse(text) : null;
  }

  /** Read the full page/node hierarchy from a .fig file. */
  async readSourceTree(filePath: string, scope?: ExtractionScope): Promise<SourceTree> {
    const args: Record<string, unknown> = { file: filePath };
    if (scope?.pageIds?.length) {
      args.filter = { pageIds: scope.pageIds };
    }
    const raw = await this.callTool('tree', args);
    return raw as SourceTree;
  }

  /** Read all variable collections with modes and alias chains. */
  async readSourceVariables(filePath: string): Promise<VariableMap> {
    const raw = await this.callTool('analyze_variables', { file: filePath });
    return raw as VariableMap;
  }

  /** Read prototype connections (reactions) from the .fig file. */
  async readSourceReactions(filePath: string): Promise<readonly ReactionRecord[]> {
    const raw = await this.callTool('query', {
      file: filePath,
      expression: '//node[reactions]',
      fields: ['id', 'reactions'],
    });
    return Array.isArray(raw) ? (raw as ReactionRecord[]) : [];
  }

  /** Map master → variant → instance relationships. */
  async readSourceComponents(filePath: string): Promise<ComponentRegistry> {
    const raw = await this.callTool('analyze_components', { file: filePath });
    return raw as ComponentRegistry;
  }

  /** Extract all font families and weights used in the file. */
  async readSourceFonts(filePath: string): Promise<FontManifest> {
    const raw = await this.callTool('analyze_fonts', { file: filePath });
    return raw as FontManifest;
  }

  /** Export node images to a local directory. */
  async exportSourceImages(
    filePath: string,
    nodeIds: readonly string[],
    outputDir: string,
  ): Promise<Record<string, string>> {
    const raw = await this.callTool('export', {
      file: filePath,
      nodeIds: [...nodeIds],
      outputDir,
      format: 'png',
    });
    return (raw as Record<string, string>) ?? {};
  }

  /** Read all source data in parallel for full analysis. */
  async readAll(filePath: string, scope?: ExtractionScope): Promise<SourceAnalysis> {
    const [tree, variables, components, reactions, fonts] = await Promise.all([
      this.readSourceTree(filePath, scope),
      this.readSourceVariables(filePath),
      this.readSourceComponents(filePath),
      this.readSourceReactions(filePath),
      this.readSourceFonts(filePath),
    ]);
    return { tree, variables, components, reactions, fonts };
  }

  /** Check if the OpenPencil MCP server is reachable. */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'tools/list', params: {} }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
