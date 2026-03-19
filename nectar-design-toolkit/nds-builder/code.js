"use strict";
// NDS BUILDER - Page Structure & Styles Builder
// Variables are imported via Variables Pro plugin from export.json
figma.showUI(__html__, { width: 400, height: 600 });
// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    fonts: {
        display: 'Merriweather',
        heading: 'Plus Jakarta Sans',
        body: 'Plus Jakarta Sans',
        code: 'Roboto Mono',
    },
    neoBrutalism: {
        strokeWidth: 2,
        shadowOffset: 4,
        borderRadius: 5,
    },
};
// ============================================================================
// PAGE STRUCTURE - Following Ant Design System with Separators
// ============================================================================
const PAGES = [
    // Overview
    { name: '🎉 Welcome', category: 'overview' },
    { name: '💠 Components Overview', category: 'overview' },
    { name: '🧩 Variables & Tokens', category: 'overview' },
    { name: '🎨 Colors', category: 'overview' },
    // Separator: General
    { name: '─────── General ───────', category: 'separator' },
    { name: '↪ Button', category: 'general' },
    { name: '↪ Float Button', category: 'general' },
    { name: '↪ Icon', category: 'general' },
    { name: '↪ Typography', category: 'general' },
    // Separator: Layout
    { name: '─────── Layout ───────', category: 'separator' },
    { name: '↪ Divider', category: 'layout' },
    { name: '↪ Grid', category: 'layout' },
    { name: '↪ Layout', category: 'layout' },
    { name: '↪ Space', category: 'layout' },
    // Separator: Navigation
    { name: '─────── Navigation ───────', category: 'separator' },
    { name: '↪ Breadcrumb', category: 'navigation' },
    { name: '↪ Dropdown', category: 'navigation' },
    { name: '↪ Menu', category: 'navigation' },
    { name: '↪ Pagination', category: 'navigation' },
    { name: '↪ Steps', category: 'navigation' },
    { name: '↪ Tabs', category: 'navigation' },
    // Separator: Data Entry
    { name: '─────── Data Entry ───────', category: 'separator' },
    { name: '↪ Checkbox', category: 'data-entry' },
    { name: '↪ DatePicker', category: 'data-entry' },
    { name: '↪ Form', category: 'data-entry' },
    { name: '↪ Input', category: 'data-entry' },
    { name: '↪ InputNumber', category: 'data-entry' },
    { name: '↪ Radio', category: 'data-entry' },
    { name: '↪ Select', category: 'data-entry' },
    { name: '↪ Slider', category: 'data-entry' },
    { name: '↪ Switch', category: 'data-entry' },
    { name: '↪ TimePicker', category: 'data-entry' },
    { name: '↪ Transfer', category: 'data-entry' },
    { name: '↪ TreeSelect', category: 'data-entry' },
    { name: '↪ Upload', category: 'data-entry' },
    // Separator: Data Display
    { name: '─────── Data Display ───────', category: 'separator' },
    { name: '↪ Avatar', category: 'data-display' },
    { name: '↪ Badge', category: 'data-display' },
    { name: '↪ Calendar', category: 'data-display' },
    { name: '↪ Card', category: 'data-display' },
    { name: '↪ Carousel', category: 'data-display' },
    { name: '↪ Collapse', category: 'data-display' },
    { name: '↪ Descriptions', category: 'data-display' },
    { name: '↪ Empty', category: 'data-display' },
    { name: '↪ Image', category: 'data-display' },
    { name: '↪ List', category: 'data-display' },
    { name: '↪ Popover', category: 'data-display' },
    { name: '↪ Segmented', category: 'data-display' },
    { name: '↪ Statistic', category: 'data-display' },
    { name: '↪ Table', category: 'data-display' },
    { name: '↪ Tag', category: 'data-display' },
    { name: '↪ Timeline', category: 'data-display' },
    { name: '↪ Tooltip', category: 'data-display' },
    { name: '↪ Tree', category: 'data-display' },
    // Separator: Feedback
    { name: '─────── Feedback ───────', category: 'separator' },
    { name: '↪ Alert', category: 'feedback' },
    { name: '↪ Drawer', category: 'feedback' },
    { name: '↪ Message', category: 'feedback' },
    { name: '↪ Modal', category: 'feedback' },
    { name: '↪ Notification', category: 'feedback' },
    { name: '↪ Popconfirm', category: 'feedback' },
    { name: '↪ Progress', category: 'feedback' },
    { name: '↪ Result', category: 'feedback' },
    { name: '↪ Skeleton', category: 'feedback' },
    { name: '↪ Spin', category: 'feedback' },
    // Separator: Other
    { name: '─────── Other ───────', category: 'separator' },
    { name: '↪ Anchor', category: 'other' },
    { name: '↪ BackTop', category: 'other' },
    { name: '↪ ConfigProvider', category: 'other' },
];
// ============================================================================
// TEXT STYLES - Ant Design naming convention (Size/Weight)
// ============================================================================
const TEXT_STYLES = [
    // Display
    { name: 'Display/Regular', family: CONFIG.fonts.display, size: 48, weight: 400, lineHeight: 1.2 },
    { name: 'Display/Medium', family: CONFIG.fonts.display, size: 48, weight: 500, lineHeight: 1.2 },
    { name: 'Display/Bold', family: CONFIG.fonts.display, size: 48, weight: 700, lineHeight: 1.2 },
    // Heading 1
    { name: 'H1/Regular', family: CONFIG.fonts.heading, size: 38, weight: 400, lineHeight: 1.211 },
    { name: 'H1/Medium', family: CONFIG.fonts.heading, size: 38, weight: 500, lineHeight: 1.211 },
    { name: 'H1/Semibold', family: CONFIG.fonts.heading, size: 38, weight: 600, lineHeight: 1.211 },
    { name: 'H1/Bold', family: CONFIG.fonts.heading, size: 38, weight: 700, lineHeight: 1.211 },
    // Heading 2
    { name: 'H2/Regular', family: CONFIG.fonts.heading, size: 30, weight: 400, lineHeight: 1.267 },
    { name: 'H2/Medium', family: CONFIG.fonts.heading, size: 30, weight: 500, lineHeight: 1.267 },
    { name: 'H2/Semibold', family: CONFIG.fonts.heading, size: 30, weight: 600, lineHeight: 1.267 },
    { name: 'H2/Bold', family: CONFIG.fonts.heading, size: 30, weight: 700, lineHeight: 1.267 },
    // Heading 3
    { name: 'H3/Regular', family: CONFIG.fonts.heading, size: 24, weight: 400, lineHeight: 1.333 },
    { name: 'H3/Medium', family: CONFIG.fonts.heading, size: 24, weight: 500, lineHeight: 1.333 },
    { name: 'H3/Semibold', family: CONFIG.fonts.heading, size: 24, weight: 600, lineHeight: 1.333 },
    { name: 'H3/Bold', family: CONFIG.fonts.heading, size: 24, weight: 700, lineHeight: 1.333 },
    // Heading 4
    { name: 'H4/Regular', family: CONFIG.fonts.heading, size: 20, weight: 400, lineHeight: 1.4 },
    { name: 'H4/Medium', family: CONFIG.fonts.heading, size: 20, weight: 500, lineHeight: 1.4 },
    { name: 'H4/Semibold', family: CONFIG.fonts.heading, size: 20, weight: 600, lineHeight: 1.4 },
    { name: 'H4/Bold', family: CONFIG.fonts.heading, size: 20, weight: 700, lineHeight: 1.4 },
    // Heading 5
    { name: 'H5/Regular', family: CONFIG.fonts.heading, size: 16, weight: 400, lineHeight: 1.5 },
    { name: 'H5/Medium', family: CONFIG.fonts.heading, size: 16, weight: 500, lineHeight: 1.5 },
    { name: 'H5/Semibold', family: CONFIG.fonts.heading, size: 16, weight: 600, lineHeight: 1.5 },
    { name: 'H5/Bold', family: CONFIG.fonts.heading, size: 16, weight: 700, lineHeight: 1.5 },
    // Body Large
    { name: 'Body LG/Regular', family: CONFIG.fonts.body, size: 16, weight: 400, lineHeight: 1.5 },
    { name: 'Body LG/Medium', family: CONFIG.fonts.body, size: 16, weight: 500, lineHeight: 1.5 },
    { name: 'Body LG/Semibold', family: CONFIG.fonts.body, size: 16, weight: 600, lineHeight: 1.5 },
    // Body Base
    { name: 'Body/Regular', family: CONFIG.fonts.body, size: 14, weight: 400, lineHeight: 1.571 },
    { name: 'Body/Medium', family: CONFIG.fonts.body, size: 14, weight: 500, lineHeight: 1.571 },
    { name: 'Body/Semibold', family: CONFIG.fonts.body, size: 14, weight: 600, lineHeight: 1.571 },
    // Body Small
    { name: 'Body SM/Regular', family: CONFIG.fonts.body, size: 12, weight: 400, lineHeight: 1.667 },
    { name: 'Body SM/Medium', family: CONFIG.fonts.body, size: 12, weight: 500, lineHeight: 1.667 },
    { name: 'Body SM/Semibold', family: CONFIG.fonts.body, size: 12, weight: 600, lineHeight: 1.667 },
    // Caption
    { name: 'Caption/Regular', family: CONFIG.fonts.body, size: 11, weight: 400, lineHeight: 1.5 },
    { name: 'Caption/Medium', family: CONFIG.fonts.body, size: 11, weight: 500, lineHeight: 1.5 },
    // Code
    { name: 'Code/Regular', family: CONFIG.fonts.code, size: 14, weight: 400, lineHeight: 1.571 },
    { name: 'Code/Medium', family: CONFIG.fonts.code, size: 14, weight: 500, lineHeight: 1.571 },
    { name: 'Code SM/Regular', family: CONFIG.fonts.code, size: 12, weight: 400, lineHeight: 1.667 },
];
// ============================================================================
// EFFECT STYLES - Neo-Brutalism + Layout Guides
// ============================================================================
const EFFECT_STYLES = [
    // Neo-Brutalism Shadows
    {
        name: 'Shadow/SM',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 2, y: 2 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/MD',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 4, y: 4 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/LG',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 6, y: 6 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/XL',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 8, y: 8 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/Hover',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 6, y: 6 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/Active',
        effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 2, y: 2 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
    {
        name: 'Shadow/Primary',
        effects: [{ type: 'DROP_SHADOW', color: { r: 1, g: 0.565, b: 0.91, a: 0.5 }, offset: { x: 4, y: 4 }, radius: 0, spread: 0, visible: true, blendMode: 'NORMAL' }],
    },
];
const BRAND_COLORS = [
    // Pink (Primary)
    { name: 'pink/100', hex: '#FFF0FB', r: 1.0000, g: 0.9412, b: 0.9843 },
    { name: 'pink/200', hex: '#FFE1F7', r: 1.0000, g: 0.8824, b: 0.9686 },
    { name: 'pink/300', hex: '#FFC3EF', r: 1.0000, g: 0.7647, b: 0.9373 },
    { name: 'pink/400', hex: '#FFA8E7', r: 1.0000, g: 0.6588, b: 0.9059 },
    { name: 'pink/500', hex: '#FF90E8', r: 1.0000, g: 0.5647, b: 0.9098 },
    { name: 'pink/600', hex: '#FF6EDE', r: 1.0000, g: 0.4314, b: 0.8706 },
    { name: 'pink/700', hex: '#E54CC4', r: 0.8980, g: 0.2980, b: 0.7686 },
    { name: 'pink/800', hex: '#B33A99', r: 0.7020, g: 0.2275, b: 0.6000 },
    { name: 'pink/900', hex: '#7A2868', r: 0.4784, g: 0.1569, b: 0.4078 },
    // Purple (Secondary/Info)
    { name: 'purple/100', hex: '#F0F3FD', r: 0.9412, g: 0.9529, b: 0.9922 },
    { name: 'purple/200', hex: '#E1E7FB', r: 0.8824, g: 0.9059, b: 0.9843 },
    { name: 'purple/300', hex: '#C3CFF7', r: 0.7647, g: 0.8118, b: 0.9686 },
    { name: 'purple/400', hex: '#A8BBF3', r: 0.6588, g: 0.7333, b: 0.9529 },
    { name: 'purple/500', hex: '#90A8ED', r: 0.5647, g: 0.6588, b: 0.9294 },
    { name: 'purple/600', hex: '#6E8BE5', r: 0.4314, g: 0.5451, b: 0.8980 },
    { name: 'purple/700', hex: '#4C6BD4', r: 0.2980, g: 0.4196, b: 0.8314 },
    { name: 'purple/800', hex: '#3A52A3', r: 0.2275, g: 0.3216, b: 0.6392 },
    { name: 'purple/900', hex: '#283968', r: 0.1569, g: 0.2235, b: 0.4078 },
    // Green (Success/Tertiary)
    { name: 'green/100', hex: '#E6F7F5', r: 0.9020, g: 0.9686, b: 0.9608 },
    { name: 'green/200', hex: '#C2EBE7', r: 0.7608, g: 0.9216, b: 0.9059 },
    { name: 'green/300', hex: '#85D7CF', r: 0.5216, g: 0.8431, b: 0.8118 },
    { name: 'green/400', hex: '#4BC3B7', r: 0.2941, g: 0.7647, b: 0.7176 },
    { name: 'green/500', hex: '#23A094', r: 0.1373, g: 0.6275, b: 0.5804 },
    { name: 'green/600', hex: '#1D8278', r: 0.1137, g: 0.5098, b: 0.4706 },
    { name: 'green/700', hex: '#17655E', r: 0.0902, g: 0.3961, b: 0.3686 },
    { name: 'green/800', hex: '#114A45', r: 0.0667, g: 0.2902, b: 0.2706 },
    { name: 'green/900', hex: '#0B302D', r: 0.0431, g: 0.1882, b: 0.1765 },
    // Orange (Warning/Quaternary)
    { name: 'orange/100', hex: '#FFFAE5', r: 1.0000, g: 0.9804, b: 0.8980 },
    { name: 'orange/200', hex: '#FFF3C2', r: 1.0000, g: 0.9529, b: 0.7608 },
    { name: 'orange/300', hex: '#FFE885', r: 1.0000, g: 0.9098, b: 0.5216 },
    { name: 'orange/400', hex: '#FFDE4B', r: 1.0000, g: 0.8706, b: 0.2941 },
    { name: 'orange/500', hex: '#FFC900', r: 1.0000, g: 0.7882, b: 0.0000 },
    { name: 'orange/600', hex: '#CCA000', r: 0.8000, g: 0.6275, b: 0.0000 },
    { name: 'orange/700', hex: '#997800', r: 0.6000, g: 0.4706, b: 0.0000 },
    { name: 'orange/800', hex: '#665000', r: 0.4000, g: 0.3137, b: 0.0000 },
    { name: 'orange/900', hex: '#332800', r: 0.2000, g: 0.1569, b: 0.0000 },
    // Red (Error/Danger)
    { name: 'red/100', hex: '#FDE8E5', r: 0.9922, g: 0.9098, b: 0.8980 },
    { name: 'red/200', hex: '#FBCCC5', r: 0.9843, g: 0.8000, b: 0.7725 },
    { name: 'red/300', hex: '#F59588', r: 0.9608, g: 0.5843, b: 0.5333 },
    { name: 'red/400', hex: '#EF5F4D', r: 0.9373, g: 0.3725, b: 0.3020 },
    { name: 'red/500', hex: '#DC341E', r: 0.8627, g: 0.2039, b: 0.1176 },
    { name: 'red/600', hex: '#B02A18', r: 0.6902, g: 0.1647, b: 0.0941 },
    { name: 'red/700', hex: '#842013', r: 0.5176, g: 0.1255, b: 0.0745 },
    { name: 'red/800', hex: '#58150D', r: 0.3451, g: 0.0824, b: 0.0510 },
    { name: 'red/900', hex: '#2C0B06', r: 0.1725, g: 0.0431, b: 0.0235 },
    // Yellow (Warning alt)
    { name: 'yellow/100', hex: '#FEFCE8', r: 0.9961, g: 0.9882, b: 0.9098 },
    { name: 'yellow/200', hex: '#FEF9C3', r: 0.9961, g: 0.9765, b: 0.7647 },
    { name: 'yellow/300', hex: '#FEF08A', r: 0.9961, g: 0.9412, b: 0.5412 },
    { name: 'yellow/400', hex: '#FDE047', r: 0.9922, g: 0.8784, b: 0.2784 },
    { name: 'yellow/500', hex: '#F1F333', r: 0.9451, g: 0.9529, b: 0.2000 },
    { name: 'yellow/600', hex: '#C1C226', r: 0.7569, g: 0.7608, b: 0.1490 },
    { name: 'yellow/700', hex: '#91911C', r: 0.5686, g: 0.5686, b: 0.1098 },
    { name: 'yellow/800', hex: '#616113', r: 0.3804, g: 0.3804, b: 0.0745 },
    { name: 'yellow/900', hex: '#303009', r: 0.1882, g: 0.1882, b: 0.0353 },
    // Neutral
    { name: 'neutral/0', hex: '#FFFFFF', r: 1.0000, g: 1.0000, b: 1.0000 },
    { name: 'neutral/50', hex: '#FAFAFA', r: 0.9804, g: 0.9804, b: 0.9804 },
    { name: 'neutral/100', hex: '#F4F4F5', r: 0.9569, g: 0.9569, b: 0.9608 },
    { name: 'neutral/200', hex: '#E4E4E7', r: 0.8941, g: 0.8941, b: 0.9059 },
    { name: 'neutral/300', hex: '#D4D4D8', r: 0.8314, g: 0.8314, b: 0.8471 },
    { name: 'neutral/400', hex: '#A1A1AA', r: 0.6314, g: 0.6314, b: 0.6667 },
    { name: 'neutral/500', hex: '#71717A', r: 0.4431, g: 0.4431, b: 0.4784 },
    { name: 'neutral/600', hex: '#52525B', r: 0.3216, g: 0.3216, b: 0.3569 },
    { name: 'neutral/700', hex: '#3F3F46', r: 0.2471, g: 0.2471, b: 0.2745 },
    { name: 'neutral/800', hex: '#27272A', r: 0.1529, g: 0.1529, b: 0.1647 },
    { name: 'neutral/900', hex: '#18181B', r: 0.0941, g: 0.0941, b: 0.1059 },
    { name: 'neutral/1000', hex: '#09090B', r: 0.0353, g: 0.0353, b: 0.0431 },
];
// Colors to UPDATE (existing Ant palettes → NDS values)
const ANT_TO_NDS_MAPPING = [
    {
        antName: 'gold',
        ndsPrefix: 'orange',
        scales: [
            { ant: 1, nds: '100' }, { ant: 2, nds: '200' }, { ant: 3, nds: '300' },
            { ant: 4, nds: '400' }, { ant: 5, nds: '500' }, { ant: 6, nds: '600' },
            { ant: 7, nds: '700' }, { ant: 8, nds: '800' }, { ant: 9, nds: '900' },
            { ant: 10, nds: '900' }
        ]
    },
    {
        antName: 'red',
        ndsPrefix: 'red',
        scales: [
            { ant: 1, nds: '100' }, { ant: 2, nds: '200' }, { ant: 3, nds: '300' },
            { ant: 4, nds: '400' }, { ant: 5, nds: '500' }, { ant: 6, nds: '600' },
            { ant: 7, nds: '700' }, { ant: 8, nds: '800' }, { ant: 9, nds: '900' },
            { ant: 10, nds: '900' }
        ]
    },
    {
        antName: 'yellow',
        ndsPrefix: 'yellow',
        scales: [
            { ant: 1, nds: '100' }, { ant: 2, nds: '200' }, { ant: 3, nds: '300' },
            { ant: 4, nds: '400' }, { ant: 5, nds: '500' }, { ant: 6, nds: '600' },
            { ant: 7, nds: '700' }, { ant: 8, nds: '800' }, { ant: 9, nds: '900' },
            { ant: 10, nds: '900' }
        ]
    },
    {
        antName: 'gray',
        ndsPrefix: 'neutral',
        scales: [
            { ant: 1, nds: '50' }, { ant: 2, nds: '100' }, { ant: 3, nds: '200' },
            { ant: 4, nds: '300' }, { ant: 5, nds: '400' }, { ant: 6, nds: '500' },
            { ant: 7, nds: '600' }, { ant: 8, nds: '700' }, { ant: 9, nds: '800' },
            { ant: 10, nds: '900' }
        ]
    },
    {
        antName: 'blue',
        ndsPrefix: 'purple',
        scales: [
            { ant: 1, nds: '100' }, { ant: 2, nds: '200' }, { ant: 3, nds: '300' },
            { ant: 4, nds: '400' }, { ant: 5, nds: '500' }, { ant: 6, nds: '600' },
            { ant: 7, nds: '700' }, { ant: 8, nds: '800' }, { ant: 9, nds: '900' },
            { ant: 10, nds: '900' }
        ]
    }
];
// NEW color scales to CREATE in the colors collection
const NEW_COLOR_SCALES = ['pink'];
// ============================================================================
// GRID/LAYOUT GUIDE STYLES - Matching Ant Design System structure from Figma file
// Using simple arrays without spread operator (not supported in Figma sandbox)
// ============================================================================
const GRID_STYLES = [
    // Icon grid (square)
    { name: 'Icon Grid', pattern: 'GRID', sectionSize: 20 },
    // Stretch grids (no margin, full-width)
    { name: 'Stretch/24', pattern: 'COLUMNS', alignment: 'STRETCH', count: 24, gutterSize: 8, offset: 0 },
    { name: 'Stretch/12', pattern: 'COLUMNS', alignment: 'STRETCH', count: 12, gutterSize: 8, offset: 0 },
    { name: 'Stretch/6', pattern: 'COLUMNS', alignment: 'STRETCH', count: 6, gutterSize: 8, offset: 0 },
    // Page grids (with 16px margin)
    { name: 'Page/24', pattern: 'COLUMNS', alignment: 'STRETCH', count: 24, gutterSize: 8, offset: 16 },
    { name: 'Page/12', pattern: 'COLUMNS', alignment: 'STRETCH', count: 12, gutterSize: 8, offset: 16 },
    { name: 'Page/6', pattern: 'COLUMNS', alignment: 'STRETCH', count: 6, gutterSize: 8, offset: 16 },
];
// ============================================================================
// UTILITIES
// ============================================================================
function log(m, d) {
    console.log(`[NDS Builder] ${m}`, d || '');
    figma.ui.postMessage({ type: 'log', data: { message: m, data: d } });
}
function sendToUI(t, d) {
    figma.ui.postMessage({ type: t, data: d });
}
// ============================================================================
// INSPECT FUNCTIONS - Read existing styles from Figma file
// ============================================================================
async function inspectGridStyles() {
    log('🔍 Inspecting grid styles in Figma file...');
    try {
        let gridStyles = [];
        if (typeof figma.getLocalGridStylesAsync === 'function') {
            gridStyles = await figma.getLocalGridStylesAsync();
        }
        log('Found ' + gridStyles.length + ' grid styles');
        log('');
        if (gridStyles.length === 0) {
            sendToUI('build_complete', { success: true, message: 'No grid styles found in file' });
            return;
        }
        // Detailed output for each grid style
        var output = [];
        output.push('// Copy this to GRID_STYLES array:');
        output.push('const GRID_STYLES = [');
        for (var i = 0; i < gridStyles.length; i++) {
            var style = gridStyles[i];
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('📐 ' + style.name);
            log('   ID: ' + style.id);
            var grids = style.layoutGrids;
            log('   Layout Grids: ' + grids.length);
            for (var j = 0; j < grids.length; j++) {
                var grid = grids[j];
                log('   Grid ' + (j + 1) + ':');
                log('     pattern: ' + grid.pattern);
                if (grid.pattern === 'GRID') {
                    var gridGrid = grid;
                    log('     sectionSize: ' + gridGrid.sectionSize);
                    output.push('  { name: \'' + style.name + '\', pattern: \'GRID\', sectionSize: ' + gridGrid.sectionSize + ' },');
                }
                else {
                    var rowColGrid = grid;
                    log('     alignment: ' + rowColGrid.alignment);
                    log('     count: ' + rowColGrid.count);
                    log('     gutterSize: ' + rowColGrid.gutterSize);
                    log('     offset: ' + rowColGrid.offset);
                    if (rowColGrid.sectionSize) {
                        log('     sectionSize: ' + rowColGrid.sectionSize);
                    }
                    output.push('  { name: \'' + style.name + '\', pattern: \'' + grid.pattern + '\', alignment: \'' + rowColGrid.alignment + '\', count: ' + rowColGrid.count + ', gutterSize: ' + rowColGrid.gutterSize + ', offset: ' + rowColGrid.offset + ' },');
                }
            }
        }
        output.push('];');
        log('');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('📋 GENERATED CODE:');
        for (var k = 0; k < output.length; k++) {
            log(output[k]);
        }
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sendToUI('build_complete', { success: true, message: 'Inspected ' + gridStyles.length + ' grid styles - check console for details' });
    }
    catch (e) {
        log('Error: ' + String(e));
        sendToUI('build_complete', { success: false, message: 'Error: ' + String(e) });
    }
}
async function buildGridStyles() {
    log('📐 Building grid styles...');
    try {
        var created = 0;
        for (var i = 0; i < GRID_STYLES.length; i++) {
            var gridDef = GRID_STYLES[i];
            var style = figma.createGridStyle();
            style.name = gridDef.name;
            // Create layout grid based on pattern type
            if (gridDef.pattern === 'GRID') {
                // Square baseline grid
                style.layoutGrids = [{
                        pattern: 'GRID',
                        sectionSize: gridDef.sectionSize || 8,
                        visible: true,
                        color: { r: 1, g: 0, b: 0, a: 0.1 }
                    }];
            }
            else {
                // Column-based layout grid
                style.layoutGrids = [{
                        pattern: 'COLUMNS',
                        alignment: (gridDef.alignment || 'STRETCH'),
                        gutterSize: gridDef.gutterSize || 8,
                        count: gridDef.count || 12,
                        offset: gridDef.offset || 0,
                        visible: true,
                        color: { r: 1, g: 0, b: 0, a: 0.1 }
                    }];
            }
            created++;
            log('Created: ' + gridDef.name);
        }
        log('✅ Created ' + created + ' grid styles');
        sendToUI('build_complete', { success: true, message: 'Created ' + created + ' grid styles' });
    }
    catch (e) {
        log('Error: ' + String(e));
        sendToUI('build_complete', { success: false, message: 'Error: ' + String(e) });
    }
}
// ============================================================================
// BUILD FUNCTIONS
// ============================================================================
async function buildPages() {
    log('📄 Building page structure...');
    // Rename first page if it exists
    const firstPage = figma.root.children[0];
    if (firstPage) {
        firstPage.name = PAGES[0].name;
        log(`Renamed first page to: ${PAGES[0].name}`);
    }
    // Create remaining pages
    for (let i = 1; i < PAGES.length; i++) {
        const page = figma.createPage();
        page.name = PAGES[i].name;
        log(`Created page: ${PAGES[i].name}`);
    }
    log(`✅ Created ${PAGES.length} pages`);
    sendToUI('build_complete', { success: true, message: `Created ${PAGES.length} pages` });
}
async function buildTextStyles() {
    log('🔤 Building text styles...');
    let created = 0;
    for (const style of TEXT_STYLES) {
        try {
            // Load font first
            await figma.loadFontAsync({ family: style.family, style: getFontStyle(style.weight) });
            const textStyle = figma.createTextStyle();
            textStyle.name = style.name;
            textStyle.fontName = { family: style.family, style: getFontStyle(style.weight) };
            textStyle.fontSize = style.size;
            textStyle.lineHeight = { unit: 'PERCENT', value: style.lineHeight * 100 };
            created++;
            log(`Created: ${style.name}`);
        }
        catch (e) {
            log(`⚠️ Could not create ${style.name}: ${e}`);
        }
    }
    log(`✅ Created ${created} text styles`);
    sendToUI('build_complete', { success: true, message: `Created ${created} text styles` });
}
function getFontStyle(weight) {
    const weightMap = {
        300: 'Light',
        400: 'Regular',
        500: 'Medium',
        600: 'SemiBold',
        700: 'Bold',
        800: 'ExtraBold',
    };
    return weightMap[weight] || 'Regular';
}
async function buildEffectStyles() {
    log('✨ Building effect styles...');
    let created = 0;
    for (const style of EFFECT_STYLES) {
        const effectStyle = figma.createEffectStyle();
        effectStyle.name = style.name;
        effectStyle.effects = style.effects;
        created++;
        log(`Created: ${style.name}`);
    }
    log(`✅ Created ${created} effect styles`);
    sendToUI('build_complete', { success: true, message: `Created ${created} effect styles` });
}
async function buildBrandColors() {
    log('🎨 Building NDS brand color primitives...');
    try {
        // Create a new variable collection for brand primitives
        const collection = figma.variables.createVariableCollection('NDS Brand Primitives');
        log('Created collection: NDS Brand Primitives');
        // Get the default mode ID
        const defaultModeId = collection.modes[0].modeId;
        // Rename the default mode to "Default"
        collection.renameMode(defaultModeId, 'Default');
        log('Renamed mode to: Default');
        let created = 0;
        // Create each color variable
        for (const color of BRAND_COLORS) {
            try {
                const variable = figma.variables.createVariable(color.name, collection, 'COLOR');
                // Set the color value
                variable.setValueForMode(defaultModeId, {
                    r: color.r,
                    g: color.g,
                    b: color.b
                });
                // Set description with hex value
                variable.description = color.hex;
                created++;
                log(`Created: ${color.name} (${color.hex})`);
            }
            catch (e) {
                log(`⚠️ Could not create ${color.name}: ${e}`);
            }
        }
        log(`✅ Created ${created} brand color variables`);
        sendToUI('build_complete', {
            success: true,
            message: `Created collection "NDS Brand Primitives" with ${created} colors`
        });
    }
    catch (e) {
        log('❌ Error creating brand colors: ' + String(e));
        sendToUI('build_complete', {
            success: false,
            message: 'Error creating brand colors: ' + String(e)
        });
    }
}
async function inspectVariableCollections() {
    log('🔍 Inspecting variable collections...');
    try {
        const collections = figma.variables.getLocalVariableCollections();
        log('Found ' + collections.length + ' variable collections');
        log('');
        for (const collection of collections) {
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('📦 ' + collection.name);
            log('   ID: ' + collection.id);
            log('   Modes: ' + collection.modes.map(m => m.name).join(', '));
            // Get variables in this collection
            const variableIds = collection.variableIds;
            log('   Variables: ' + variableIds.length);
            // Show first 10 variable names
            const first10 = variableIds.slice(0, 10);
            for (const varId of first10) {
                const variable = figma.variables.getVariableById(varId);
                if (variable) {
                    log('     - ' + variable.name + ' (' + variable.resolvedType + ')');
                }
            }
            if (variableIds.length > 10) {
                log('     ... and ' + (variableIds.length - 10) + ' more');
            }
        }
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        sendToUI('build_complete', {
            success: true,
            message: 'Inspected ' + collections.length + ' collections - check console'
        });
    }
    catch (e) {
        log('Error: ' + String(e));
        sendToUI('build_complete', { success: false, message: 'Error: ' + String(e) });
    }
}
// ============================================================================
// UPDATE COLORS COLLECTION - Maps NDS brand colors to existing Ant Design colors
// Also creates NEW color scales (pink) that don't exist in Ant Design
// ============================================================================
async function updateColorsCollection() {
    log('🎨 Updating colors collection with NDS brand colors...');
    try {
        // Find the "colors" collection
        const collections = figma.variables.getLocalVariableCollections();
        let colorsCollection = null;
        for (const collection of collections) {
            if (collection.name.toLowerCase() === 'colors') {
                colorsCollection = collection;
                break;
            }
        }
        if (!colorsCollection) {
            log('❌ Could not find "colors" collection');
            sendToUI('build_complete', {
                success: false,
                message: 'Could not find "colors" collection. Make sure variables are imported.'
            });
            return;
        }
        log('Found colors collection: ' + colorsCollection.name);
        log('Modes: ' + colorsCollection.modes.map(m => m.name).join(', '));
        // Get mode IDs for Light and Dark
        let lightModeId = '';
        let darkModeId = '';
        for (const mode of colorsCollection.modes) {
            if (mode.name.toLowerCase() === 'light') {
                lightModeId = mode.modeId;
            }
            else if (mode.name.toLowerCase() === 'dark') {
                darkModeId = mode.modeId;
            }
        }
        if (!lightModeId) {
            log('⚠️ Light mode not found, using first mode');
            lightModeId = colorsCollection.modes[0].modeId;
        }
        // Build a map of variable names to variables in this collection
        const variableMap = new Map();
        for (const varId of colorsCollection.variableIds) {
            const variable = figma.variables.getVariableById(varId);
            if (variable && variable.resolvedType === 'COLOR') {
                variableMap.set(variable.name, variable);
            }
        }
        log('Found ' + variableMap.size + ' color variables in collection');
        let updated = 0;
        let created = 0;
        let notFound = 0;
        // ========== STEP 1: Update existing colors ==========
        log('');
        log('━━━ UPDATING EXISTING COLORS ━━━');
        for (const mapping of ANT_TO_NDS_MAPPING) {
            log('');
            log('Updating: ' + mapping.antName + ' → NDS ' + mapping.ndsPrefix);
            for (const scale of mapping.scales) {
                // Construct the Ant Design variable name (e.g., "gold/1")
                const antVarName = mapping.antName + '/' + scale.ant;
                // Find the NDS color
                const ndsVarName = mapping.ndsPrefix + '/' + scale.nds;
                const ndsColor = BRAND_COLORS.find(c => c.name === ndsVarName);
                if (!ndsColor) {
                    log('  ⚠️ NDS color not found: ' + ndsVarName);
                    continue;
                }
                // Find the Ant variable
                const antVariable = variableMap.get(antVarName);
                if (antVariable) {
                    // Update Light mode
                    antVariable.setValueForMode(lightModeId, { r: ndsColor.r, g: ndsColor.g, b: ndsColor.b });
                    // Update Dark mode if exists
                    if (darkModeId) {
                        antVariable.setValueForMode(darkModeId, { r: ndsColor.r, g: ndsColor.g, b: ndsColor.b });
                    }
                    log('  ✓ ' + antVarName + ' → ' + ndsColor.hex);
                    updated++;
                }
                else {
                    log('  ✗ Variable not found: ' + antVarName);
                    notFound++;
                }
            }
        }
        // ========== STEP 2: Create NEW color scales ==========
        log('');
        log('━━━ CREATING NEW COLOR SCALES ━━━');
        for (const scaleName of NEW_COLOR_SCALES) {
            log('');
            log('Creating: ' + scaleName + ' scale');
            // Get all colors for this scale from BRAND_COLORS
            const scaleColors = BRAND_COLORS.filter(c => c.name.startsWith(scaleName + '/'));
            if (scaleColors.length === 0) {
                log('  ⚠️ No colors found for scale: ' + scaleName);
                continue;
            }
            // Create variables for each step in the scale (1-10 to match Ant structure)
            // Map NDS 100-900 to Ant 1-10
            const ndsToAntScale = {
                '100': 1, '200': 2, '300': 3, '400': 4, '500': 5,
                '600': 6, '700': 7, '800': 8, '900': 9
            };
            for (const color of scaleColors) {
                // Extract the NDS scale number (e.g., "100" from "pink/100")
                const ndsScale = color.name.split('/')[1];
                const antScale = ndsToAntScale[ndsScale];
                if (!antScale)
                    continue;
                // Create variable name following Ant convention (e.g., "pink/1")
                const varName = scaleName + '/' + antScale;
                // Check if already exists
                if (variableMap.has(varName)) {
                    // Update existing
                    const existing = variableMap.get(varName);
                    existing.setValueForMode(lightModeId, { r: color.r, g: color.g, b: color.b });
                    if (darkModeId) {
                        existing.setValueForMode(darkModeId, { r: color.r, g: color.g, b: color.b });
                    }
                    log('  ✓ Updated existing: ' + varName + ' → ' + color.hex);
                    updated++;
                }
                else {
                    // Create new variable
                    try {
                        const variable = figma.variables.createVariable(varName, colorsCollection, 'COLOR');
                        variable.setValueForMode(lightModeId, { r: color.r, g: color.g, b: color.b });
                        if (darkModeId) {
                            variable.setValueForMode(darkModeId, { r: color.r, g: color.g, b: color.b });
                        }
                        variable.description = color.hex;
                        log('  ✓ Created: ' + varName + ' → ' + color.hex);
                        created++;
                    }
                    catch (e) {
                        log('  ✗ Failed to create: ' + varName + ' - ' + String(e));
                    }
                }
            }
            // Also create step 10 (copy of 900)
            const color900 = scaleColors.find(c => c.name.endsWith('/900'));
            if (color900) {
                const varName10 = scaleName + '/10';
                if (!variableMap.has(varName10)) {
                    try {
                        const variable = figma.variables.createVariable(varName10, colorsCollection, 'COLOR');
                        variable.setValueForMode(lightModeId, { r: color900.r, g: color900.g, b: color900.b });
                        if (darkModeId) {
                            variable.setValueForMode(darkModeId, { r: color900.r, g: color900.g, b: color900.b });
                        }
                        variable.description = color900.hex + ' (same as 900)';
                        log('  ✓ Created: ' + varName10 + ' → ' + color900.hex);
                        created++;
                    }
                    catch (e) {
                        log('  ✗ Failed to create: ' + varName10);
                    }
                }
            }
        }
        log('');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('✅ Updated ' + updated + ' color variables');
        log('✅ Created ' + created + ' new color variables');
        if (notFound > 0) {
            log('⚠️ ' + notFound + ' variables not found');
        }
        sendToUI('build_complete', {
            success: true,
            message: 'Updated ' + updated + ', created ' + created + ' colors' + (notFound > 0 ? ' (' + notFound + ' not found)' : '')
        });
    }
    catch (e) {
        log('❌ Error updating colors: ' + String(e));
        sendToUI('build_complete', {
            success: false,
            message: 'Error updating colors: ' + String(e)
        });
    }
}
async function buildAll() {
    log('🚀 Building NDS...');
    try {
        await buildPages();
        await buildTextStyles();
        await buildEffectStyles();
        log('🎉 Build Complete!');
        sendToUI('build_complete', { success: true, message: 'Build complete!' });
    }
    catch (e) {
        log('❌ Error:', e);
        sendToUI('build_error', { error: String(e) });
    }
}
// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================
async function cleanAll() {
    log('🧹 Starting full cleanup...');
    // Clean text styles
    log('🧹 Cleaning text styles...');
    const textStyles = await figma.getLocalTextStylesAsync();
    let textCount = 0;
    for (const s of textStyles) {
        try {
            s.remove();
            textCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${textCount} text styles`);
    // Clean effect styles
    log('🧹 Cleaning effect styles...');
    const effectStyles = await figma.getLocalEffectStylesAsync();
    let effectCount = 0;
    for (const s of effectStyles) {
        try {
            s.remove();
            effectCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${effectCount} effect styles`);
    // Clean grid styles
    log('🧹 Cleaning grid styles...');
    const gridStyles = await figma.getLocalGridStylesAsync();
    let gridCount = 0;
    for (const s of gridStyles) {
        try {
            s.remove();
            gridCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${gridCount} grid styles`);
    // Clean pages (keep first page, rename it)
    log('🧹 Cleaning pages...');
    const pages = figma.root.children;
    let pageCount = 0;
    if (pages.length > 1) {
        const firstPage = pages[0];
        firstPage.name = 'Page 1';
        for (let i = pages.length - 1; i >= 1; i--) {
            try {
                pages[i].remove();
                pageCount++;
            }
            catch (e) { /* ignore */ }
        }
    }
    log(`✅ Deleted ${pageCount} pages`);
    log('✅ Full cleanup complete!');
    sendToUI('build_complete', { success: true, message: 'Full cleanup complete!' });
}
async function cleanTextStylesOnly() {
    log('🧹 Cleaning text styles...');
    const textStyles = await figma.getLocalTextStylesAsync();
    let textCount = 0;
    for (const s of textStyles) {
        try {
            s.remove();
            textCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${textCount} text styles`);
    sendToUI('build_complete', { success: true, message: `Deleted ${textCount} text styles` });
}
async function cleanEffectStylesOnly() {
    log('🧹 Cleaning effect styles...');
    const effectStyles = await figma.getLocalEffectStylesAsync();
    let effectCount = 0;
    for (const s of effectStyles) {
        try {
            s.remove();
            effectCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${effectCount} effect styles`);
    sendToUI('build_complete', { success: true, message: `Deleted ${effectCount} effect styles` });
}
async function cleanPagesOnly() {
    log('🧹 Cleaning pages...');
    const pages = figma.root.children;
    let pageCount = 0;
    if (pages.length > 1) {
        const firstPage = pages[0];
        firstPage.name = 'Page 1';
        for (let i = pages.length - 1; i >= 1; i--) {
            try {
                pages[i].remove();
                pageCount++;
            }
            catch (e) { /* ignore */ }
        }
    }
    log(`✅ Deleted ${pageCount} pages`);
    sendToUI('build_complete', { success: true, message: `Deleted ${pageCount} pages` });
}
async function cleanGridStylesOnly() {
    log('🧹 Cleaning grid styles...');
    const gridStyles = await figma.getLocalGridStylesAsync();
    let gridCount = 0;
    for (const s of gridStyles) {
        try {
            s.remove();
            gridCount++;
        }
        catch (e) { /* ignore */ }
    }
    log(`✅ Deleted ${gridCount} grid styles`);
    sendToUI('build_complete', { success: true, message: `Deleted ${gridCount} grid styles` });
}
// ============================================================================
// NODE EXTRACTION FUNCTIONS
// Functions to extract Figma document structure for analysis
// ============================================================================
/**
 * Convert fill/stroke paint to readable string
 */
function paintToString(paints) {
    if (paints === figma.mixed)
        return 'mixed';
    if (!paints || paints.length === 0)
        return 'none';
    return paints.map(paint => {
        if (paint.type === 'SOLID') {
            const { r, g, b } = paint.color;
            const hex = '#' + [r, g, b].map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
            return `${hex}${paint.opacity !== 1 ? ` (${Math.round(paint.opacity * 100)}%)` : ''}`;
        }
        return paint.type;
    }).join(', ');
}
/**
 * Convert effect to readable string
 */
function effectsToString(effects) {
    if (!effects || effects.length === 0)
        return 'none';
    return effects.map(e => `${e.type}${e.visible ? '' : ' (hidden)'}`).join(', ');
}
/**
 * Extract node properties into a structured object
 */
function extractNodeProperties(node, depth = 0, maxDepth = 10) {
    const extracted = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible,
        locked: node.locked,
    };
    // Position and size (if available)
    if ('x' in node)
        extracted.x = Math.round(node.x);
    if ('y' in node)
        extracted.y = Math.round(node.y);
    if ('width' in node)
        extracted.width = Math.round(node.width);
    if ('height' in node)
        extracted.height = Math.round(node.height);
    // Visual properties
    if ('fills' in node)
        extracted.fills = paintToString(node.fills);
    if ('strokes' in node)
        extracted.strokes = paintToString(node.strokes);
    if ('effects' in node)
        extracted.effects = effectsToString(node.effects);
    if ('cornerRadius' in node) {
        extracted.cornerRadius = node.cornerRadius === figma.mixed ? 'mixed' : node.cornerRadius;
    }
    // Auto Layout properties
    if ('layoutMode' in node && node.layoutMode !== 'NONE') {
        extracted.layoutMode = node.layoutMode;
        extracted.primaryAxisAlignItems = node.primaryAxisAlignItems;
        extracted.counterAxisAlignItems = node.counterAxisAlignItems;
        extracted.paddingTop = node.paddingTop;
        extracted.paddingBottom = node.paddingBottom;
        extracted.paddingLeft = node.paddingLeft;
        extracted.paddingRight = node.paddingRight;
        extracted.itemSpacing = node.itemSpacing;
    }
    // Text properties
    if (node.type === 'TEXT') {
        const textNode = node;
        extracted.characters = textNode.characters.substring(0, 100) + (textNode.characters.length > 100 ? '...' : '');
        if (textNode.fontSize !== figma.mixed)
            extracted.fontSize = textNode.fontSize;
        if (textNode.fontName !== figma.mixed)
            extracted.fontName = `${textNode.fontName.family} ${textNode.fontName.style}`;
        extracted.textAlignHorizontal = textNode.textAlignHorizontal;
        extracted.textAlignVertical = textNode.textAlignVertical;
    }
    // Children (if container and within depth limit)
    if ('children' in node) {
        extracted.childCount = node.children.length;
        if (depth < maxDepth && node.children.length > 0) {
            extracted.children = node.children.map(child => extractNodeProperties(child, depth + 1, maxDepth));
        }
    }
    return extracted;
}
/**
 * Extract page structure - list all pages and their top-level frames
 */
async function extractPageStructure() {
    log('📄 Extracting page structure...');
    const pages = [];
    for (const page of figma.root.children) {
        const frames = [];
        for (const child of page.children) {
            if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
                frames.push({
                    id: child.id,
                    name: child.name,
                    type: child.type,
                    width: Math.round(child.width),
                    height: Math.round(child.height),
                });
            }
        }
        pages.push({
            id: page.id,
            name: page.name,
            childCount: page.children.length,
            frames,
        });
    }
    const result = {
        timestamp: new Date().toISOString(),
        pages,
    };
    log(`✅ Found ${pages.length} pages with ${pages.reduce((acc, p) => acc + p.frames.length, 0)} frames`);
    // Log summary to console
    for (const page of pages) {
        log(`📄 Page: "${page.name}" (${page.childCount} children)`);
        for (const frame of page.frames) {
            log(`   └─ ${frame.type}: "${frame.name}" (${frame.width}×${frame.height}) [${frame.id}]`);
        }
    }
    sendToUI('extraction_result', { type: 'page_structure', result });
}
/**
 * Extract current selection - get details of selected nodes
 */
async function extractSelection() {
    log('🎯 Extracting selection...');
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        log('⚠️ No nodes selected');
        sendToUI('extraction_result', { type: 'selection', result: { timestamp: new Date().toISOString(), selection: [] }, warning: 'No nodes selected' });
        return;
    }
    const extractedNodes = selection.map(node => extractNodeProperties(node, 0, 3));
    const result = {
        timestamp: new Date().toISOString(),
        selection: extractedNodes,
    };
    log(`✅ Extracted ${selection.length} selected node(s)`);
    // Log summary
    for (const node of extractedNodes) {
        log(`🎯 ${node.type}: "${node.name}" (${node.width}×${node.height}) [${node.id}]`);
        if (node.childCount)
            log(`   └─ ${node.childCount} children`);
    }
    sendToUI('extraction_result', { type: 'selection', result });
}
/**
 * Extract deep node tree - get full hierarchy of selected node
 */
async function extractNodeTree(depth = 5) {
    log(`🌲 Extracting node tree (depth: ${depth})...`);
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        log('⚠️ No nodes selected. Please select a frame or component.');
        sendToUI('extraction_result', { type: 'node_tree', result: null, warning: 'No nodes selected' });
        return;
    }
    // Extract first selected node with full depth
    const node = selection[0];
    const extracted = extractNodeProperties(node, 0, depth);
    const result = {
        timestamp: new Date().toISOString(),
        nodeTree: extracted,
    };
    // Count total nodes
    function countNodes(n) {
        let count = 1;
        if (n.children) {
            for (const child of n.children) {
                count += countNodes(child);
            }
        }
        return count;
    }
    const totalNodes = countNodes(extracted);
    log(`✅ Extracted tree with ${totalNodes} nodes`);
    log(`🌲 Root: ${extracted.type} "${extracted.name}" (${extracted.width}×${extracted.height})`);
    sendToUI('extraction_result', { type: 'node_tree', result });
}
/**
 * Export extraction result to JSON file
 */
async function exportToJson(data, filename) {
    log(`💾 Preparing JSON export: ${filename}`);
    const jsonString = JSON.stringify(data, null, 2);
    // Send to UI to trigger download
    sendToUI('download_json', { filename, content: jsonString });
    log(`✅ JSON ready for download (${(jsonString.length / 1024).toFixed(1)} KB)`);
}
// ============================================================================
// MESSAGE HANDLER
// ============================================================================
figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
        // Build commands
        case 'build_all':
            await buildAll();
            break;
        case 'build_pages':
            await buildPages();
            break;
        case 'build_text_styles':
            await buildTextStyles();
            break;
        case 'build_effect_styles':
            await buildEffectStyles();
            break;
        case 'build_grid_styles':
            await buildGridStyles();
            break;
        case 'build_brand_colors':
            await buildBrandColors();
            break;
        case 'update_colors_collection':
            await updateColorsCollection();
            break;
        // Inspect commands
        case 'inspect_grid_styles':
            await inspectGridStyles();
            break;
        case 'inspect_variable_collections':
            await inspectVariableCollections();
            break;
        // Extraction commands
        case 'extract_page_structure':
            await extractPageStructure();
            break;
        case 'extract_selection':
            await extractSelection();
            break;
        case 'extract_node_tree':
            await extractNodeTree(msg.depth || 5);
            break;
        case 'export_json':
            await exportToJson(msg.data, msg.filename || 'figma-export.json');
            break;
        // Clean commands
        case 'clean_all':
            await cleanAll();
            break;
        case 'clean_text_styles':
            await cleanTextStylesOnly();
            break;
        case 'clean_effect_styles':
            await cleanEffectStylesOnly();
            break;
        case 'clean_pages':
            await cleanPagesOnly();
            break;
        case 'clean_grid_styles':
            await cleanGridStylesOnly();
            break;
        // Close plugin
        case 'close':
            figma.closePlugin();
            break;
    }
};
