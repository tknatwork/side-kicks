/**
 * @module figma-rest
 * Figma REST API client for the Design System Builder MCP server.
 * Handles comment operations that require the Figma REST API rather than the Plugin API.
 * Uses the native Node.js 18+ fetch implementation — no extra dependencies required.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FigmaComment {
  readonly id: string;
  readonly message: string;
  readonly created_at: string;
  readonly resolved_at?: string;
  readonly user: {
    readonly handle: string;
    readonly img_url: string;
  };
  readonly client_meta?: {
    readonly x: number;
    readonly y: number;
  };
}

export interface FigmaCommentsResponse {
  readonly comments: FigmaComment[];
}

export interface FigmaPostCommentResponse {
  readonly id: string;
  readonly message: string;
  readonly created_at: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class FigmaRestClient {
  private readonly token: string;
  private readonly baseUrl = "https://api.figma.com";

  constructor(token: string) {
    this.token = token;
  }

  get isConfigured(): boolean {
    return this.token.length > 0;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.isConfigured) {
      throw new Error(
        "Figma REST client is not configured — provide a personal access token via FIGMA_API_TOKEN."
      );
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "X-Figma-Token": this.token,
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json() as { err?: string };
        if (body.err) detail = body.err;
      } catch {
        // ignore parse failure — keep the HTTP status message
      }
      throw new Error(`Figma REST API error on ${path}: ${detail}`);
    }

    // 204 No Content — nothing to parse
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Retrieve all comments on a Figma file.
   * @param fileKey - The Figma file key (from the file URL).
   */
  async getComments(fileKey: string): Promise<FigmaCommentsResponse> {
    return this.request<FigmaCommentsResponse>(`/v1/files/${fileKey}/comments`);
  }

  /**
   * Post a new comment on a Figma file, optionally anchored to canvas coordinates.
   * @param fileKey  - The Figma file key.
   * @param message  - Comment text.
   * @param x        - Optional canvas X coordinate for a pin comment.
   * @param y        - Optional canvas Y coordinate for a pin comment.
   */
  async postComment(
    fileKey: string,
    message: string,
    x?: number,
    y?: number
  ): Promise<FigmaPostCommentResponse> {
    const body: Record<string, unknown> = { message };

    if (x !== undefined && y !== undefined) {
      body.client_meta = { node_offset: { x, y } };
    }

    return this.request<FigmaPostCommentResponse>(
      `/v1/files/${fileKey}/comments`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Delete a comment from a Figma file.
   * @param fileKey   - The Figma file key.
   * @param commentId - The ID of the comment to delete.
   */
  async deleteComment(fileKey: string, commentId: string): Promise<void> {
    await this.request<void>(
      `/v1/files/${fileKey}/comments/${commentId}`,
      { method: "DELETE" }
    );
  }
}
