#!/usr/bin/env node
/**
 * Figma MCP Server for Portfolio Project
 *
 * This server provides tools for AI agents to interact with the Figma design system:
 * - Fetch design tokens from Figma (READ - via API)
 * - Sync tokens to the project
 * - Get component information
 * - Read design system structure
 * - Create/modify design system in Figma (WRITE - via Bridge Server + Plugin)
 *
 * Architecture:
 * - READ operations: Direct Figma API calls
 * - WRITE operations: MCP → Bridge Server (HTTP) → Plugin (WebSocket) → Figma
 *
 * Created by: Claude Opus 4.5 (Preview)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import dotenv from "dotenv";
// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}
else {
    dotenv.config();
}
const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FILE_ID = process.env.FIGMA_FILE_ID;
// Paths relative to the project root
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..");
const TOKENS_PATH = path.join(PROJECT_ROOT, "src/tokens/tokens.json");
const VARIABLES_CSS_PATH = path.join(PROJECT_ROOT, "src/variables.css");
// Bridge Server configuration
const BRIDGE_HOST = process.env.BRIDGE_HOST || "localhost";
const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || "9877", 10);
// Create server instance
const server = new McpServer({
    name: "figma-mcp-server",
    version: "1.0.0",
});
// Helper function to make Figma API requests
function figmaRequest(endpoint) {
    return new Promise((resolve, reject) => {
        if (!FIGMA_TOKEN) {
            reject(new Error("FIGMA_ACCESS_TOKEN not set in environment"));
            return;
        }
        const options = {
            hostname: "api.figma.com",
            path: endpoint,
            method: "GET",
            headers: {
                "X-Figma-Token": FIGMA_TOKEN,
            },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                }
                else {
                    reject(new Error(`Figma API error: ${res.statusCode} ${res.statusMessage}`));
                }
            });
        });
        req.on("error", reject);
        req.end();
    });
}
// Helper function to convert RGBA to Hex
function rgbaToHex(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a;
    const toHex = (n) => n.toString(16).padStart(2, "0");
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return a < 1 ? `${hex}${toHex(Math.round(a * 255))}` : hex;
}
// Helper function to convert Hex to RGBA (0-1 range for Figma)
function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
    if (!result) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
        a: result[4] ? parseInt(result[4], 16) / 255 : 1,
    };
}
// Helper function to send commands to Bridge Server
function bridgeCommand(command, payload = {}) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ command, payload });
        const options = {
            hostname: BRIDGE_HOST,
            port: BRIDGE_PORT,
            path: "/command",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const result = JSON.parse(data);
                    if (result.success) {
                        resolve(result.data);
                    }
                    else {
                        reject(new Error(result.error || "Bridge command failed"));
                    }
                }
                catch {
                    reject(new Error("Invalid response from bridge server"));
                }
            });
        });
        req.on("error", (err) => {
            reject(new Error(`Bridge server not available: ${err.message}. Start the bridge server first.`));
        });
        req.write(postData);
        req.end();
    });
}
// Helper function to check bridge server status
function checkBridgeStatus() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BRIDGE_HOST,
            port: BRIDGE_PORT,
            path: "/status",
            method: "GET",
        };
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error("Invalid response from bridge server"));
                }
            });
        });
        req.on("error", (err) => {
            reject(new Error(`Bridge server not available: ${err.message}`));
        });
        req.end();
    });
}
// Helper to convert tokens to CSS variables
function tokensToCss(tokens) {
    let css = "/* Auto-generated from Figma design tokens - DO NOT EDIT MANUALLY */\n";
    css += "/* Run 'npm run fetch-figma' or use MCP server to update */\n\n";
    css += ":root {\n";
    function processToken(obj, prefix = "") {
        for (const [key, value] of Object.entries(obj)) {
            const varName = prefix ? `${prefix}-${key}` : key;
            if (typeof value === "object" && value !== null && "value" in value) {
                const tokenValue = value.value;
                css += `  --${varName.toLowerCase().replace(/\//g, "-")}: ${tokenValue};\n`;
            }
            else if (typeof value === "object" && value !== null) {
                processToken(value, varName);
            }
        }
    }
    processToken(tokens);
    css += "}\n";
    return css;
}
// Tool: Fetch design tokens from Figma
server.tool("fetch_figma_tokens", "Fetch design tokens (colors, typography, spacing) from the connected Figma file. Returns raw token data without saving.", {}, async () => {
    if (!FILE_ID) {
        return {
            content: [{ type: "text", text: "Error: FIGMA_FILE_ID not set in environment" }],
        };
    }
    try {
        const data = await figmaRequest(`/v1/files/${FILE_ID}/variables/local`);
        if (!data.meta?.variables) {
            return {
                content: [{ type: "text", text: "No variables found in Figma file." }],
            };
        }
        const variables = data.meta.variables;
        const variableCollections = data.meta.variableCollections;
        const tokens = {};
        Object.values(variables).forEach((variable) => {
            const collection = variableCollections[variable.variableCollectionId];
            const collectionName = collection?.name || "default";
            const modeId = Object.keys(variable.valuesByMode)[0];
            let value = variable.valuesByMode[modeId];
            // Skip aliases for now
            if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
                return;
            }
            if (!tokens[collectionName]) {
                tokens[collectionName] = {};
            }
            const nameParts = variable.name.split("/");
            let current = tokens[collectionName];
            for (let i = 0; i < nameParts.length - 1; i++) {
                const part = nameParts[i];
                if (!current[part])
                    current[part] = {};
                current = current[part];
            }
            const leafName = nameParts[nameParts.length - 1];
            // Convert RGBA to Hex if it's a color
            if (variable.resolvedType === "COLOR" && typeof value === "object" && "r" in value) {
                value = rgbaToHex(value);
            }
            current[leafName] = {
                value: value,
                type: variable.resolvedType.toLowerCase(),
            };
        });
        return {
            content: [
                {
                    type: "text",
                    text: `Successfully fetched ${Object.values(variables).length} tokens from Figma.\n\nTokens:\n${JSON.stringify(tokens, null, 2)}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error fetching tokens: ${error}` }],
        };
    }
});
// Tool: Sync tokens to project
server.tool("sync_figma_tokens", "Fetch tokens from Figma and sync them to the project. Updates both tokens.json and variables.css files.", {}, async () => {
    if (!FILE_ID) {
        return {
            content: [{ type: "text", text: "Error: FIGMA_FILE_ID not set in environment" }],
        };
    }
    try {
        const data = await figmaRequest(`/v1/files/${FILE_ID}/variables/local`);
        if (!data.meta?.variables) {
            return {
                content: [{ type: "text", text: "No variables found in Figma file." }],
            };
        }
        const variables = data.meta.variables;
        const variableCollections = data.meta.variableCollections;
        const tokens = {};
        Object.values(variables).forEach((variable) => {
            const collection = variableCollections[variable.variableCollectionId];
            const collectionName = collection?.name || "default";
            const modeId = Object.keys(variable.valuesByMode)[0];
            let value = variable.valuesByMode[modeId];
            if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
                return;
            }
            if (!tokens[collectionName]) {
                tokens[collectionName] = {};
            }
            const nameParts = variable.name.split("/");
            let current = tokens[collectionName];
            for (let i = 0; i < nameParts.length - 1; i++) {
                const part = nameParts[i];
                if (!current[part])
                    current[part] = {};
                current = current[part];
            }
            const leafName = nameParts[nameParts.length - 1];
            if (variable.resolvedType === "COLOR" && typeof value === "object" && "r" in value) {
                value = rgbaToHex(value);
            }
            current[leafName] = {
                value: value,
                type: variable.resolvedType.toLowerCase(),
            };
        });
        // Save tokens.json
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
        // Generate and save CSS variables
        const cssContent = tokensToCss(tokens);
        fs.writeFileSync(VARIABLES_CSS_PATH, cssContent);
        return {
            content: [
                {
                    type: "text",
                    text: `✅ Successfully synced ${Object.values(variables).length} tokens from Figma!\n\nUpdated files:\n- ${TOKENS_PATH}\n- ${VARIABLES_CSS_PATH}\n\n⚠️ IMPORTANT: Remember to update AI_CONTEXT.md and CHANGELOG.md with these changes.`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error syncing tokens: ${error}` }],
        };
    }
});
// Tool: Get Figma file info
server.tool("get_figma_file_info", "Get basic information about the connected Figma file including name, last modified date, and page structure.", {}, async () => {
    if (!FILE_ID) {
        return {
            content: [{ type: "text", text: "Error: FIGMA_FILE_ID not set in environment" }],
        };
    }
    try {
        const data = await figmaRequest(`/v1/files/${FILE_ID}?depth=1`);
        const pages = data.document.children.map((page) => page.name);
        return {
            content: [
                {
                    type: "text",
                    text: `Figma File Info:\n\nName: ${data.name}\nLast Modified: ${data.lastModified}\nVersion: ${data.version}\n\nPages:\n${pages.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting file info: ${error}` }],
        };
    }
});
// Tool: Get component list from Figma
server.tool("get_figma_components", "List all published components in the Figma file. Useful for understanding the design system structure.", {}, async () => {
    if (!FILE_ID) {
        return {
            content: [{ type: "text", text: "Error: FIGMA_FILE_ID not set in environment" }],
        };
    }
    try {
        const data = await figmaRequest(`/v1/files/${FILE_ID}/components`);
        if (!data.meta?.components || data.meta.components.length === 0) {
            return {
                content: [{ type: "text", text: "No published components found in Figma file." }],
            };
        }
        const componentList = data.meta.components.map((comp) => ({
            name: comp.name,
            description: comp.description || "No description",
            key: comp.key,
            frame: comp.containing_frame?.name || "Unknown",
        }));
        return {
            content: [
                {
                    type: "text",
                    text: `Found ${componentList.length} components:\n\n${componentList
                        .map((c) => `• ${c.name}\n  Frame: ${c.frame}\n  Key: ${c.key}\n  ${c.description}`)
                        .join("\n\n")}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting components: ${error}` }],
        };
    }
});
// Tool: Read current project tokens
server.tool("read_project_tokens", "Read the current design tokens stored in the project (tokens.json). Useful for comparing with Figma.", {}, async () => {
    try {
        if (!fs.existsSync(TOKENS_PATH)) {
            return {
                content: [{ type: "text", text: `No tokens file found at ${TOKENS_PATH}` }],
            };
        }
        const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
        return {
            content: [
                {
                    type: "text",
                    text: `Current project tokens:\n\n${JSON.stringify(tokens, null, 2)}`,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error reading tokens: ${error}` }],
        };
    }
});
// Tool: Get Figma styles
server.tool("get_figma_styles", "Get all styles (colors, text, effects, grids) defined in the Figma file.", {}, async () => {
    if (!FILE_ID) {
        return {
            content: [{ type: "text", text: "Error: FIGMA_FILE_ID not set in environment" }],
        };
    }
    try {
        const data = await figmaRequest(`/v1/files/${FILE_ID}/styles`);
        if (!data.meta?.styles || data.meta.styles.length === 0) {
            return {
                content: [{ type: "text", text: "No styles found in Figma file." }],
            };
        }
        const stylesByType = {};
        data.meta.styles.forEach((style) => {
            const type = style.style_type;
            if (!stylesByType[type])
                stylesByType[type] = [];
            stylesByType[type].push({
                name: style.name,
                description: style.description || "No description",
            });
        });
        let output = `Found ${data.meta.styles.length} styles:\n\n`;
        for (const [type, styles] of Object.entries(stylesByType)) {
            output += `## ${type} (${styles.length})\n`;
            styles.forEach((s) => {
                output += `  • ${s.name}: ${s.description}\n`;
            });
            output += "\n";
        }
        return {
            content: [{ type: "text", text: output }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting styles: ${error}` }],
        };
    }
});
// Resource: Project design context
server.resource("design-context", "Current design system context including tokens and configuration", async () => {
    const context = {
        figmaFileId: FILE_ID || "Not configured",
        tokensPath: TOKENS_PATH,
        variablesCssPath: VARIABLES_CSS_PATH,
    };
    try {
        if (fs.existsSync(TOKENS_PATH)) {
            const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
            context.currentTokens = tokens;
        }
    }
    catch {
        context.currentTokens = "Unable to read tokens";
    }
    return {
        contents: [
            {
                uri: "design://context",
                mimeType: "application/json",
                text: JSON.stringify(context, null, 2),
            },
        ],
    };
});
// ============================================================================
// BRIDGE/PLUGIN TOOLS (WRITE OPERATIONS)
// These tools require the Bridge Server and Figma Plugin to be running
// ============================================================================
// Tool: Check bridge connection status
server.tool("check_bridge_status", "Check if the Bridge Server is running and if the Figma Plugin is connected. Required before using any write operations.", {}, async () => {
    try {
        const status = await checkBridgeStatus();
        if (!status.connected) {
            return {
                content: [{
                        type: "text",
                        text: `⚠️ Bridge Server is running but Figma Plugin is NOT connected.\n\nTo connect:\n1. Open your Figma file\n2. Go to Plugins → Development → Portfolio DS Builder\n3. Click "Connect" in the plugin UI`,
                    }],
            };
        }
        return {
            content: [{
                    type: "text",
                    text: `✅ Bridge Server connected!\n\nFigma File: ${status.fileInfo?.name || "Unknown"}\nCurrent Page: ${status.fileInfo?.currentPage || "Unknown"}\n\nReady for write operations.`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Bridge Server not available.\n\nTo start:\n1. cd bridge-server\n2. npm install\n3. npm start\n\nError: ${error}`,
                }],
        };
    }
});
// Tool: Create variable collection
server.tool("create_variable_collection", "Create a new variable collection in Figma with optional modes (e.g., Light/Dark). Requires Bridge Server and Plugin.", {
    name: z.string().describe("Name of the variable collection (e.g., 'Brand', 'Alias', 'Mapped')"),
    modes: z.array(z.string()).optional().describe("Array of mode names (e.g., ['Light', 'Dark']). First mode becomes default."),
}, async ({ name, modes }) => {
    try {
        const result = await bridgeCommand("create_variable_collection", { name, modes });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created collection "${result.name}"\nID: ${result.id}\nModes: ${Object.entries(result.modeIds).map(([name, id]) => `${name} (${id})`).join(", ")}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating collection: ${error}` }],
        };
    }
});
// Tool: Create variable
server.tool("create_variable", "Create a new variable in a Figma collection. Requires Bridge Server and Plugin.", {
    collectionId: z.string().describe("ID of the variable collection"),
    name: z.string().describe("Variable name (use / for grouping, e.g., 'pink/500')"),
    type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type"),
}, async ({ collectionId, name, type }) => {
    try {
        const result = await bridgeCommand("create_variable", {
            collectionId,
            name,
            type,
        });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created variable "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating variable: ${error}` }],
        };
    }
});
// Tool: Set variable value
server.tool("set_variable_value", "Set the value of a variable for a specific mode. Requires Bridge Server and Plugin.", {
    variableId: z.string().describe("ID of the variable"),
    modeId: z.string().describe("ID of the mode to set value for"),
    value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.object({
            hex: z.string().describe("Hex color value (e.g., '#FF90E8')"),
        }),
        z.object({
            aliasId: z.string().describe("ID of another variable to alias"),
        }),
    ]).describe("Value to set - string, number, boolean, hex color object, or alias object"),
}, async ({ variableId, modeId, value }) => {
    try {
        let finalValue = value;
        // Convert hex to RGBA
        if (typeof value === "object" && value !== null && "hex" in value) {
            finalValue = hexToRgba(value.hex);
        }
        // Convert alias
        if (typeof value === "object" && value !== null && "aliasId" in value) {
            finalValue = { type: "VARIABLE_ALIAS", id: value.aliasId };
        }
        await bridgeCommand("set_variable_value", { variableId, modeId, value: finalValue });
        return {
            content: [{
                    type: "text",
                    text: `✅ Set variable value successfully`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error setting variable value: ${error}` }],
        };
    }
});
// Tool: Create color style
server.tool("create_color_style", "Create a new color style in Figma. Requires Bridge Server and Plugin.", {
    name: z.string().describe("Style name (use / for grouping, e.g., 'Brand/Primary')"),
    hex: z.string().describe("Hex color value (e.g., '#FF90E8')"),
    opacity: z.number().optional().describe("Opacity 0-1 (default 1)"),
    description: z.string().optional().describe("Style description"),
}, async ({ name, hex, opacity, description }) => {
    try {
        const rgba = hexToRgba(hex);
        const result = await bridgeCommand("create_color_style", {
            name,
            color: { r: rgba.r, g: rgba.g, b: rgba.b },
            opacity: opacity ?? rgba.a,
            description,
        });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created color style "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating color style: ${error}` }],
        };
    }
});
// Tool: Create text style
server.tool("create_text_style", "Create a new text style in Figma. Requires Bridge Server and Plugin.", {
    name: z.string().describe("Style name (use / for grouping, e.g., 'Heading/H1')"),
    fontFamily: z.string().describe("Font family name (e.g., 'Switzer', 'Merriweather', 'JetBrains Mono')"),
    fontStyle: z.string().optional().describe("Font style (e.g., 'Regular', 'Bold', 'Medium')"),
    fontSize: z.number().describe("Font size in pixels"),
    lineHeight: z.object({
        value: z.number(),
        unit: z.enum(["PIXELS", "PERCENT", "AUTO"]),
    }).optional().describe("Line height"),
    letterSpacing: z.object({
        value: z.number(),
        unit: z.enum(["PIXELS", "PERCENT"]),
    }).optional().describe("Letter spacing"),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional().describe("Text case transform"),
    description: z.string().optional().describe("Style description"),
}, async ({ name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textCase, description }) => {
    try {
        const result = await bridgeCommand("create_text_style", {
            name,
            fontFamily,
            fontStyle,
            fontSize,
            lineHeight,
            letterSpacing,
            textCase,
            description,
        });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created text style "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating text style: ${error}` }],
        };
    }
});
// Tool: Create effect style
server.tool("create_effect_style", "Create a new effect style (shadow, blur) in Figma. Requires Bridge Server and Plugin.", {
    name: z.string().describe("Style name (use / for grouping, e.g., 'Shadow/Hard')"),
    effects: z.array(z.object({
        type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
        color: z.object({
            hex: z.string(),
            alpha: z.number().optional(),
        }).optional().describe("Color for shadow effects"),
        offset: z.object({
            x: z.number(),
            y: z.number(),
        }).optional().describe("Offset for shadow effects"),
        radius: z.number().optional().describe("Blur radius"),
        spread: z.number().optional().describe("Spread for shadow effects"),
    })).describe("Array of effects"),
    description: z.string().optional().describe("Style description"),
}, async ({ name, effects, description }) => {
    try {
        const processedEffects = effects.map(effect => {
            const processed = { type: effect.type };
            if (effect.color) {
                const rgba = hexToRgba(effect.color.hex);
                processed.color = { r: rgba.r, g: rgba.g, b: rgba.b, a: effect.color.alpha ?? rgba.a };
            }
            if (effect.offset)
                processed.offset = effect.offset;
            if (effect.radius !== undefined)
                processed.radius = effect.radius;
            if (effect.spread !== undefined)
                processed.spread = effect.spread;
            return processed;
        });
        const result = await bridgeCommand("create_effect_style", {
            name,
            effects: processedEffects,
            description,
        });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created effect style "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating effect style: ${error}` }],
        };
    }
});
// Tool: Create page
server.tool("create_figma_page", "Create a new page in the Figma file. Requires Bridge Server and Plugin.", {
    name: z.string().describe("Page name"),
}, async ({ name }) => {
    try {
        const result = await bridgeCommand("create_page", { name });
        return {
            content: [{
                    type: "text",
                    text: `✅ Created page "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating page: ${error}` }],
        };
    }
});
// Tool: Get pages via bridge
server.tool("get_figma_pages_live", "Get current pages from the open Figma file via Plugin. Requires Bridge Server and Plugin.", {}, async () => {
    try {
        const result = await bridgeCommand("get_pages", {});
        return {
            content: [{
                    type: "text",
                    text: `Pages in Figma file:\n${result.map((p, i) => `${i + 1}. ${p.name} (${p.id})`).join("\n")}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting pages: ${error}` }],
        };
    }
});
// Tool: Get variable collections via bridge
server.tool("get_variable_collections_live", "Get current variable collections from the open Figma file via Plugin. Requires Bridge Server and Plugin.", {}, async () => {
    try {
        const result = await bridgeCommand("get_variable_collections", {});
        if (result.length === 0) {
            return {
                content: [{ type: "text", text: "No variable collections found in the file." }],
            };
        }
        let output = "Variable Collections:\n\n";
        result.forEach((collection, i) => {
            output += `${i + 1}. ${collection.name}\n`;
            output += `   ID: ${collection.id}\n`;
            output += `   Modes: ${collection.modes.map(m => `${m.name} (${m.modeId})`).join(", ")}\n\n`;
        });
        return {
            content: [{ type: "text", text: output }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting collections: ${error}` }],
        };
    }
});
// Tool: Get variables via bridge
server.tool("get_variables_live", "Get current variables from the open Figma file via Plugin. Requires Bridge Server and Plugin.", {
    collectionId: z.string().optional().describe("Filter by collection ID"),
}, async ({ collectionId }) => {
    try {
        const result = await bridgeCommand("get_variables", { collectionId });
        if (result.length === 0) {
            return {
                content: [{ type: "text", text: "No variables found." }],
            };
        }
        let output = `Found ${result.length} variables:\n\n`;
        result.forEach((v) => {
            output += `• ${v.name} (${v.resolvedType})\n  ID: ${v.id}\n`;
        });
        return {
            content: [{ type: "text", text: output }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting variables: ${error}` }],
        };
    }
});
// Tool: Create frame
server.tool("create_frame", "Create a new frame in the current Figma page. Requires Bridge Server and Plugin.", {
    name: z.string().describe("Frame name"),
    width: z.number().optional().describe("Frame width in pixels"),
    height: z.number().optional().describe("Frame height in pixels"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    fillHex: z.string().optional().describe("Background fill color as hex"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto layout mode"),
    itemSpacing: z.number().optional().describe("Spacing between items (for auto layout)"),
    padding: z.object({
        top: z.number().optional(),
        right: z.number().optional(),
        bottom: z.number().optional(),
        left: z.number().optional(),
    }).optional().describe("Padding (for auto layout)"),
}, async ({ name, width, height, x, y, fillHex, layoutMode, itemSpacing, padding }) => {
    try {
        const payload = { name };
        if (width)
            payload.width = width;
        if (height)
            payload.height = height;
        if (x !== undefined)
            payload.x = x;
        if (y !== undefined)
            payload.y = y;
        if (layoutMode)
            payload.layoutMode = layoutMode;
        if (itemSpacing !== undefined)
            payload.itemSpacing = itemSpacing;
        if (padding)
            payload.padding = padding;
        if (fillHex) {
            const rgba = hexToRgba(fillHex);
            payload.fills = [{ type: "SOLID", color: { r: rgba.r, g: rgba.g, b: rgba.b }, opacity: rgba.a }];
        }
        const result = await bridgeCommand("create_frame", payload);
        return {
            content: [{
                    type: "text",
                    text: `✅ Created frame "${result.name}"\nID: ${result.id}`,
                }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating frame: ${error}` }],
        };
    }
});
// Tool: Set current page
server.tool("set_current_page", "Navigate to a specific page in the Figma file. Requires Bridge Server and Plugin.", {
    pageId: z.string().describe("ID of the page to navigate to"),
}, async ({ pageId }) => {
    try {
        await bridgeCommand("set_current_page", { pageId });
        return {
            content: [{ type: "text", text: `✅ Navigated to page ${pageId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error navigating: ${error}` }],
        };
    }
});
// Tool: Create text node
server.tool("create_text", "Create a text node in the current Figma page. Requires Bridge Server and Plugin.", {
    text: z.string().describe("Text content"),
    x: z.number().optional().describe("X position"),
    y: z.number().optional().describe("Y position"),
    fontSize: z.number().optional().describe("Font size in pixels"),
    fontFamily: z.string().optional().describe("Font family name"),
    fontWeight: z.number().optional().describe("Font weight (100-900)"),
    fillHex: z.string().optional().describe("Text color as hex"),
    parentId: z.string().optional().describe("Parent node ID to append to"),
}, async ({ text, x, y, fontSize, fontFamily, fontWeight, fillHex, parentId }) => {
    try {
        const payload = { text };
        if (x !== undefined)
            payload.x = x;
        if (y !== undefined)
            payload.y = y;
        if (fontSize)
            payload.fontSize = fontSize;
        if (fontFamily)
            payload.fontFamily = fontFamily;
        if (fontWeight)
            payload.fontWeight = fontWeight;
        if (parentId)
            payload.parentId = parentId;
        if (fillHex) {
            const rgba = hexToRgba(fillHex);
            payload.fills = [{ type: "SOLID", color: { r: rgba.r, g: rgba.g, b: rgba.b }, opacity: rgba.a }];
        }
        const result = await bridgeCommand("create_text", payload);
        return {
            content: [{ type: "text", text: `✅ Created text node\nID: ${result.id}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error creating text: ${error}` }],
        };
    }
});
// Tool: Update text content
server.tool("update_text", "Update text content of an existing text node. Requires Bridge Server and Plugin.", {
    nodeId: z.string().describe("ID of the text node"),
    text: z.string().describe("New text content"),
}, async ({ nodeId, text }) => {
    try {
        await bridgeCommand("update_text", { nodeId, text });
        return {
            content: [{ type: "text", text: `✅ Updated text node ${nodeId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error updating text: ${error}` }],
        };
    }
});
// Tool: Delete a node
server.tool("delete_node", "Delete a node from the Figma file. Requires Bridge Server and Plugin.", {
    nodeId: z.string().describe("ID of the node to delete"),
}, async ({ nodeId }) => {
    try {
        await bridgeCommand("delete_node", { nodeId });
        return {
            content: [{ type: "text", text: `✅ Deleted node ${nodeId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error deleting node: ${error}` }],
        };
    }
});
// Tool: Delete a variable
server.tool("delete_variable", "Delete a variable from Figma. Requires Bridge Server and Plugin.", {
    variableId: z.string().describe("ID of the variable to delete"),
}, async ({ variableId }) => {
    try {
        await bridgeCommand("delete_variable", { variableId });
        return {
            content: [{ type: "text", text: `✅ Deleted variable ${variableId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error deleting variable: ${error}` }],
        };
    }
});
// Tool: Set variable scopes
server.tool("set_variable_scopes", "Set the scopes of a variable (which properties it can be applied to). Requires Bridge Server and Plugin.", {
    variableId: z.string().describe("ID of the variable"),
    scopes: z.array(z.string()).describe("Array of scopes (e.g., ['ALL_FILLS', 'STROKE_COLOR', 'FRAME_FILL'])"),
}, async ({ variableId, scopes }) => {
    try {
        await bridgeCommand("set_variable_scopes", { variableId, scopes });
        return {
            content: [{ type: "text", text: `✅ Set variable scopes for ${variableId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error setting scopes: ${error}` }],
        };
    }
});
// Tool: Bind variable to a node property
server.tool("bind_variable_to_node", "Bind a variable to a node property in Figma. Requires Bridge Server and Plugin.", {
    nodeId: z.string().describe("ID of the target node"),
    variableId: z.string().describe("ID of the variable to bind"),
    field: z.string().describe("Property field to bind (e.g., 'fills', 'strokes', 'width', 'height', 'itemSpacing')"),
}, async ({ nodeId, variableId, field }) => {
    try {
        await bridgeCommand("bind_variable_to_node", { nodeId, variableId, field });
        return {
            content: [{ type: "text", text: `✅ Bound variable ${variableId} to ${field} on node ${nodeId}` }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error binding variable: ${error}` }],
        };
    }
});
// Tool: Get local styles
server.tool("get_local_styles_live", "Get all local styles (paint, text, effect) from the open Figma file. Requires Bridge Server and Plugin.", {}, async () => {
    try {
        const result = await bridgeCommand("get_local_styles", {});
        if (result.length === 0) {
            return {
                content: [{ type: "text", text: "No local styles found." }],
            };
        }
        let output = `Found ${result.length} local styles:\n\n`;
        result.forEach((s) => {
            output += `• ${s.name} (${s.type})\n  ID: ${s.id}\n`;
        });
        return {
            content: [{ type: "text", text: output }],
        };
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error getting local styles: ${error}` }],
        };
    }
});
// Tool: Run the automated build script
server.tool("run_build_ds", "Run the automated Figma Design System builder (build-figma-ds.js). Creates all variables, styles, and pages from Portfolio token files. Requires Bridge Server and Plugin.", {
    step: z.enum(["all", "variables", "styles", "pages"]).optional().describe("Which step to run (default: all)"),
    dryRun: z.boolean().optional().describe("Print commands without executing (default: false)"),
}, async ({ step, dryRun }) => {
    try {
        const { execFile } = await import("child_process");
        const scriptPath = path.resolve(__dirname, "../../build-figma-ds.js");
        const args = [];
        if (step && step !== "all") {
            args.push("--step", step);
        }
        if (dryRun) {
            args.push("--dry-run");
        }
        return new Promise((resolve) => {
            execFile("node", [scriptPath, ...args], {
                timeout: 300000,
                cwd: path.dirname(scriptPath),
                maxBuffer: 1024 * 1024,
            }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        content: [{
                                type: "text",
                                text: `Build error:\n${stdout || ""}\n${stderr || ""}\n${error.message || ""}`,
                            }],
                    });
                }
                else {
                    resolve({
                        content: [{ type: "text", text: stdout }],
                    });
                }
            });
        });
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Error starting build: ${error}` }],
        };
    }
});
// Prompt: Design token update workflow
server.prompt("sync-design-tokens", "A guided workflow to sync design tokens from Figma to the project", async () => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Please help me sync the design tokens from Figma to my project.

Steps:
1. First, use get_figma_file_info to verify the Figma file connection
2. Use fetch_figma_tokens to preview the tokens
3. If the tokens look correct, use sync_figma_tokens to update the project
4. IMPORTANT: After syncing, you MUST update AI_CONTEXT.md and CHANGELOG.md with the changes

Remember: Never edit variables.css manually - always use this workflow!`,
                },
            },
        ],
    };
});
// Prompt: Build design system workflow
server.prompt("build-design-system", "A guided workflow to build the Nectar Core design system in Figma using the Plugin", async () => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Please help me build the Nectar Core design system in Figma.

Prerequisites:
1. Orchestration Server must be running (cd orchestration-server && node index.js)
2. Figma Plugin must be connected in the Figma file

FASTEST APPROACH — use the automated builder:
1. First, use check_bridge_status to verify connection
2. Then use run_build_ds to execute the full automated build
   - This reads seed.json, alias.json, mapped.json from the Portfolio repo
   - Creates 3 collections (Seed, Mapped, Alias)
   - Creates ~122 variables with proper light/dark mode values
   - Creates 14 text styles + 4 effect styles
   - Creates 5 pages (Cover, Foundations, Components, Layout, Templates)

MANUAL APPROACH — for individual operations:
1. Use check_bridge_status to verify connection
2. Create variable collections:
   - "Seed" collection (single mode: Default) — 37 pastels, 11 neutrals, spacing, borders, typography
   - "Mapped" collection (two modes: Light, Dark) — 32 semantic color pairs
   - "Alias" collection (single mode: Default) — semantic references
3. Create variables with proper naming: color/pastel/lavender, spacing/4, etc.
4. Create text styles (Libre Baskerville headings, Switzer body, Merriweather caption, Roboto Mono code)
5. Create effect styles (4 hard shadows: 2/4/6/8px offset, #D9D5D2 color)

Nectar Core Palette (key colors):
- Background: cream #FAF8F5 (light), nearBlack #1A1715 (dark)
- Primary: honey #E8A317 / honeyDeep #C98B0A
- Accent: navy #3D5A80 / skyLight #EAF4FB
- Surface: #FFFFFF (light), #252220 (dark)

IMPORTANT: After building, update AI_CONTEXT.md and CHANGELOG.md!`,
                },
            },
        ],
    };
});
// Main function to run the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Figma MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map