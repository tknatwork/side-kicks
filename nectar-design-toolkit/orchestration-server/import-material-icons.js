/**
 * Material Design Icons Import Script for Nectar Design System
 * 
 * This script imports curated Material Design Icons from @material-design-icons/svg
 * and creates them in the Figma file via the plugin.
 * 
 * Usage:
 *   node import-material-icons.js create      # Create icons in Figma
 *   node import-material-icons.js list        # List available icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const PLUGIN_SERVER_URL = 'http://localhost:9877';
const MDI_PATH = path.join(__dirname, 'node_modules/@material-design-icons/svg');

// Curated icon list organized by category
const ICON_CATEGORIES = {
  // Navigation
  navigation: [
    'home', 'menu', 'close', 'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward',
    'chevron_left', 'chevron_right', 'expand_more', 'expand_less',
    'arrow_back_ios', 'arrow_forward_ios', 'first_page', 'last_page',
    'navigate_before', 'navigate_next', 'more_horiz', 'more_vert', 'apps'
  ],
  
  // Actions
  actions: [
    'add', 'remove', 'check', 'check_circle', 'cancel', 'delete', 'edit', 'save',
    'search', 'refresh', 'settings', 'done', 'clear', 'add_circle', 'remove_circle',
    'delete_outline', 'add_circle_outline', 'check_circle_outline', 'open_in_new', 'launch'
  ],
  
  // Communication
  communication: [
    'mail', 'mail_outline', 'chat', 'chat_bubble', 'chat_bubble_outline', 'message',
    'phone', 'call', 'contact_mail', 'contact_phone', 'contacts', 'send', 'reply',
    'notifications', 'notifications_active', 'notifications_off', 'notifications_none'
  ],
  
  // Content
  content: [
    'add_box', 'content_copy', 'content_cut', 'content_paste', 'link', 'link_off',
    'flag', 'report', 'archive', 'unarchive', 'filter_list', 'sort', 'undo', 'redo'
  ],
  
  // Social
  social: [
    'share', 'person', 'person_outline', 'people', 'people_outline', 'group',
    'public', 'thumb_up', 'thumb_down', 'star', 'star_border', 'star_half',
    'favorite', 'favorite_border', 'bookmark', 'bookmark_border'
  ],
  
  // Files & Media
  files: [
    'folder', 'folder_open', 'file_copy', 'file_download', 'file_upload',
    'attach_file', 'attachment', 'cloud', 'cloud_upload', 'cloud_download',
    'cloud_done', 'cloud_off', 'description', 'insert_drive_file'
  ],
  
  // Media
  media: [
    'image', 'photo', 'photo_library', 'camera_alt', 'videocam', 'play_arrow',
    'pause', 'stop', 'skip_next', 'skip_previous', 'volume_up', 'volume_down',
    'volume_mute', 'volume_off', 'mic', 'mic_off'
  ],
  
  // Status
  status: [
    'info', 'warning', 'error', 'error_outline', 'help', 'help_outline',
    'report_problem', 'check_circle', 'cancel', 'block', 'verified',
    'verified_user', 'new_releases', 'priority_high'
  ],
  
  // Toggle & Forms
  forms: [
    'visibility', 'visibility_off', 'lock', 'lock_open', 'lock_clock',
    'toggle_off', 'toggle_on', 'check_box', 'check_box_outline_blank',
    'radio_button_checked', 'radio_button_unchecked', 'indeterminate_check_box'
  ],
  
  // Development
  development: [
    'code', 'terminal', 'bug_report', 'build', 'memory', 'storage',
    'dns', 'data_object', 'data_array', 'analytics', 'query_stats',
    'speed', 'api', 'integration_instructions', 'developer_mode'
  ],
  
  // Time & Date
  time: [
    'schedule', 'access_time', 'alarm', 'alarm_on', 'alarm_off', 'timer',
    'timelapse', 'today', 'event', 'calendar_today', 'calendar_month', 'date_range'
  ],
  
  // Location
  location: [
    'location_on', 'location_off', 'my_location', 'near_me', 'place',
    'map', 'explore', 'public', 'language', 'travel_explore'
  ],
  
  // Commerce
  commerce: [
    'shopping_cart', 'shopping_bag', 'store', 'storefront', 'local_mall',
    'credit_card', 'payment', 'payments', 'account_balance_wallet', 'receipt'
  ],
  
  // Account
  account: [
    'account_circle', 'person_add', 'person_remove', 'manage_accounts',
    'login', 'logout', 'key', 'password', 'badge', 'admin_panel_settings'
  ],
  
  // Misc
  misc: [
    'lightbulb', 'light_mode', 'dark_mode', 'brightness_4', 'brightness_7',
    'emoji_objects', 'extension', 'widgets', 'dashboard', 'view_module',
    'grid_view', 'view_list', 'view_agenda', 'workspace_premium', 'star_rate'
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function sendPluginCommand(command, payload = {}) {
  const response = await fetch(`${PLUGIN_SERVER_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Plugin command failed');
  }
  return data.data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadSvg(iconName, variant = 'outlined') {
  const svgPath = path.join(MDI_PATH, variant, `${iconName}.svg`);
  if (fs.existsSync(svgPath)) {
    return fs.readFileSync(svgPath, 'utf-8');
  }
  return null;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function createCoverSection(startY) {
  console.log('\n📘 Creating Cover Section...');
  
  // Create cover frame
  const cover = await sendPluginCommand('create_frame', {
    name: '📘 Cover',
    x: 0,
    y: startY,
    width: 1200,
    height: 400,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0.565, b: 0.91 } }]  // Pink
  });
  
  // Add title
  await sendPluginCommand('create_text', {
    text: '🎯 Material Icons',
    x: 60,
    y: startY + 60,
    fontSize: 64,
    fontFamily: 'Inter',
    fontStyle: 'Bold',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  });
  
  // Add subtitle
  await sendPluginCommand('create_text', {
    text: 'Google Material Design Icons for Nectar DS',
    x: 60,
    y: startY + 140,
    fontSize: 24,
    fontFamily: 'Inter',
    fontStyle: 'Regular',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  });
  
  // Count icons
  const totalIcons = Object.values(ICON_CATEGORIES).flat().length;
  const categoryCount = Object.keys(ICON_CATEGORIES).length;
  
  // Add stats
  await sendPluginCommand('create_text', {
    text: `${totalIcons} Icons • ${categoryCount} Categories • Outlined & Filled Variants`,
    x: 60,
    y: startY + 200,
    fontSize: 18,
    fontFamily: 'Inter',
    fontStyle: 'Medium',
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]
  });
  
  // Add source attribution
  await sendPluginCommand('create_text', {
    text: 'Source: google/material-design-icons (Apache 2.0 License)',
    x: 60,
    y: startY + 260,
    fontSize: 14,
    fontFamily: 'Inter',
    fontStyle: 'Regular',
    fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }]
  });
  
  return cover.id;
}

async function createCategorySection(category, icons, startY, variant = 'outlined') {
  console.log(`\n📂 Creating ${category} section (${icons.length} icons)...`);
  
  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
  const emoji = {
    navigation: '🧭',
    actions: '⚡',
    communication: '💬',
    content: '📝',
    social: '👥',
    files: '📁',
    media: '🎬',
    status: '🚦',
    forms: '📋',
    development: '💻',
    time: '⏰',
    location: '📍',
    commerce: '🛒',
    account: '👤',
    misc: '✨'
  }[category] || '📦';
  
  // Create section frame
  const sectionFrame = await sendPluginCommand('create_frame', {
    name: `${emoji} ${categoryTitle}`,
    x: 0,
    y: startY,
    width: 1200,
    height: 60 + Math.ceil(icons.length / 10) * 80 + 40,
    fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }]
  });
  
  // Add section title
  await sendPluginCommand('create_text', {
    text: `${emoji} ${categoryTitle}`,
    x: 24,
    y: startY + 20,
    fontSize: 24,
    fontFamily: 'Inter',
    fontStyle: 'Bold',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  });
  
  // Load and create icons
  const iconsPerRow = 10;
  const iconSize = 24;
  const spacing = 80;
  const startX = 40;
  const iconStartY = startY + 70;
  
  let createdCount = 0;
  let failedIcons = [];
  
  for (let i = 0; i < icons.length; i++) {
    const iconName = icons[i];
    const svg = loadSvg(iconName, variant);
    
    if (!svg) {
      failedIcons.push(iconName);
      continue;
    }
    
    const row = Math.floor(i / iconsPerRow);
    const col = i % iconsPerRow;
    const x = startX + col * spacing;
    const y = iconStartY + row * spacing;
    
    try {
      // Create icon from SVG
      await sendPluginCommand('create_from_svg', {
        svg: svg,
        name: iconName,
        x: x,
        y: y
      });
      
      // Add label below icon
      await sendPluginCommand('create_text', {
        text: iconName.replace(/_/g, ' '),
        x: x - 20,
        y: y + 30,
        fontSize: 8,
        fontFamily: 'Inter',
        fontStyle: 'Regular',
        fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }]
      });
      
      createdCount++;
      
      // Small delay to avoid overwhelming the plugin
      if (i % 5 === 0) {
        await sleep(100);
      }
    } catch (error) {
      failedIcons.push(`${iconName}: ${error.message}`);
    }
  }
  
  console.log(`  ✅ Created ${createdCount}/${icons.length} icons`);
  if (failedIcons.length > 0) {
    console.log(`  ⚠️  Failed: ${failedIcons.slice(0, 5).join(', ')}${failedIcons.length > 5 ? '...' : ''}`);
  }
  
  return {
    frameId: sectionFrame.id,
    height: 60 + Math.ceil(icons.length / iconsPerRow) * spacing + 40,
    created: createdCount,
    failed: failedIcons
  };
}

async function createUsageSection(startY) {
  console.log('\n📖 Creating Usage Guidelines Section...');
  
  // Create usage frame
  const usageFrame = await sendPluginCommand('create_frame', {
    name: '📖 Usage Guidelines',
    x: 0,
    y: startY,
    width: 1200,
    height: 500,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  });
  
  // Title
  await sendPluginCommand('create_text', {
    text: '📖 Usage Guidelines',
    x: 40,
    y: startY + 30,
    fontSize: 32,
    fontFamily: 'Inter',
    fontStyle: 'Bold',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  });
  
  // Guidelines text
  const guidelines = `Icon Sizing
Use size/icon/* tokens from the Breakpoints collection:
• xs: 12px - Inline text, badges
• sm: 16px - Small UI elements
• md: 20px - Default for most UI
• lg: 24px - Buttons, navigation
• xl: 32px - Headers, cards
• 2xl: 48px - Hero sections

Icon Colors
Use fg/* tokens from the Mapped collection:
• fg/default - Standard icon color
• fg/muted - Secondary/disabled icons
• fg/inverse - Icons on dark backgrounds

Accessibility
• Always provide aria-label for interactive icons
• Ensure 4.5:1 minimum contrast ratio
• Don't rely solely on color to convey meaning
• Use aria-hidden="true" for decorative icons`;

  await sendPluginCommand('create_text', {
    text: guidelines,
    x: 40,
    y: startY + 90,
    fontSize: 14,
    fontFamily: 'Inter',
    fontStyle: 'Regular',
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }]
  });
  
  return usageFrame.id;
}

async function listIcons() {
  console.log('\n📋 Available Material Design Icons by Category:\n');
  
  let totalAvailable = 0;
  let totalMissing = 0;
  
  for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
    console.log(`\n${category.toUpperCase()} (${icons.length} icons):`);
    
    const available = [];
    const missing = [];
    
    for (const icon of icons) {
      const svg = loadSvg(icon, 'outlined');
      if (svg) {
        available.push(icon);
        totalAvailable++;
      } else {
        missing.push(icon);
        totalMissing++;
      }
    }
    
    console.log(`  ✅ Available: ${available.join(', ')}`);
    if (missing.length > 0) {
      console.log(`  ❌ Missing: ${missing.join(', ')}`);
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`  Total icons in manifest: ${totalAvailable + totalMissing}`);
  console.log(`  Available: ${totalAvailable}`);
  console.log(`  Missing: ${totalMissing}`);
}

async function createIconsInFigma() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🎯 MATERIAL DESIGN ICONS IMPORT');
  console.log('═'.repeat(60));
  
  // Check plugin connection
  try {
    const statusRes = await fetch(`${PLUGIN_SERVER_URL}/status`);
    const status = await statusRes.json();
    
    if (!status.connected) {
      console.log('❌ Plugin not connected.');
      console.log('   1. Open your NDS file in Figma');
      console.log('   2. Run the Portfolio DS Builder plugin');
      return;
    }
    
    console.log(`✅ Connected to: ${status.fileInfo?.name || 'unknown'}`);
    console.log(`📄 Current page: ${status.fileInfo?.currentPage || 'unknown'}`);
  } catch (error) {
    console.log('❌ Cannot connect to plugin server.');
    console.log('   Run: pm2 start orchestration-server/index.js --name nectar-server');
    return;
  }
  
  // Navigate to Icons page
  try {
    await sendPluginCommand('set_current_page', { pageId: '110:2' });
    console.log('✅ Navigated to Icons page\n');
  } catch (error) {
    console.log(`⚠️  Could not navigate to Icons page: ${error.message}`);
  }
  
  let currentY = 0;
  const totalIcons = Object.values(ICON_CATEGORIES).flat().length;
  
  console.log(`\n🚀 Creating ${totalIcons} icons across ${Object.keys(ICON_CATEGORIES).length} categories...\n`);
  
  // Create cover section
  await createCoverSection(currentY);
  currentY += 450;  // Cover height + gap
  
  // Create each category section
  const stats = {
    total: 0,
    created: 0,
    failed: []
  };
  
  for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
    const result = await createCategorySection(category, icons, currentY);
    currentY += result.height + 40;  // Add gap between sections
    stats.total += icons.length;
    stats.created += result.created;
    stats.failed.push(...result.failed);
  }
  
  // Create usage guidelines section
  await createUsageSection(currentY);
  
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('✨ IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Total icons: ${stats.total}`);
  console.log(`  Created: ${stats.created}`);
  console.log(`  Failed: ${stats.failed.length}`);
  if (stats.failed.length > 0) {
    console.log(`  Failed icons: ${stats.failed.slice(0, 10).join(', ')}...`);
  }
  console.log('');
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'list':
      await listIcons();
      break;
      
    case 'create':
      await createIconsInFigma();
      break;
      
    default:
      console.log('');
      console.log('Usage: node import-material-icons.js [command]');
      console.log('');
      console.log('Commands:');
      console.log('  list     List available icons by category');
      console.log('  create   Create icons in Figma (requires plugin running)');
      console.log('');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
