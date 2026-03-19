/**
 * Gumroad Component Builder
 * 
 * Creates raw Gumroad-style components in Figma Page 18
 * using the Nectar Design System styles
 * 
 * Components are organized into sections:
 * 1. ATOMS - Buttons, Inputs, Badges, Icons
 * 2. MOLECULES - Form Fields, Alerts, Tabs
 * 3. ORGANISMS - Cards, Navigation, Footers
 */

const BRIDGE_URL = 'http://localhost:9877';

// Gumroad Design Specs
const GUMROAD = {
  // Colors (using our variables)
  colors: {
    pink: '#FF90E8',
    pinkLight: '#FFD4F0',
    black: '#000000',
    white: '#FEFEFE',
    yellow: '#FFC900',
    cyan: '#23A094',
    blue: '#36B3FF',
    gray: '#666666',
  },
  // Typography
  fonts: {
    primary: 'Switzer',
    mono: 'JetBrains Mono',
    serif: 'Merriweather',
  },
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  // Border
  border: {
    width: 3,
    radius: 8,
    radiusFull: 9999,
  },
  // Shadows (hard, no blur)
  shadow: {
    sm: { x: 2, y: 2 },
    md: { x: 4, y: 4 },
    lg: { x: 6, y: 6 },
    xl: { x: 8, y: 8 },
  }
};

// Page 18 layout configuration
const PAGE_CONFIG = {
  pageId: null, // Will be set dynamically
  startX: 100,
  startY: 100,
  sectionGap: 200,
  componentGap: 80,
  columnWidth: 400,
};

// Component definitions
const COMPONENTS = {
  atoms: {
    title: '🔷 ATOMS',
    items: [
      // BUTTONS
      {
        name: 'Button/Primary',
        type: 'button',
        specs: {
          width: 160,
          height: 48,
          fill: '#FF90E8',
          text: 'Start selling',
          textColor: '#000000',
          fontSize: 16,
          fontWeight: 500,
          border: { color: '#000000', width: 3 },
          shadow: { x: 4, y: 4 },
          radius: 8,
        }
      },
      {
        name: 'Button/Secondary',
        type: 'button',
        specs: {
          width: 160,
          height: 48,
          fill: '#FEFEFE',
          text: 'Learn more',
          textColor: '#000000',
          fontSize: 16,
          fontWeight: 500,
          border: { color: '#000000', width: 3 },
          shadow: { x: 4, y: 4 },
          radius: 8,
        }
      },
      {
        name: 'Button/Ghost',
        type: 'button',
        specs: {
          width: 140,
          height: 44,
          fill: 'transparent',
          text: 'Cancel',
          textColor: '#000000',
          fontSize: 16,
          fontWeight: 500,
          border: null,
          shadow: null,
          radius: 8,
        }
      },
      {
        name: 'Button/Danger',
        type: 'button',
        specs: {
          width: 140,
          height: 48,
          fill: '#FF4444',
          text: 'Delete',
          textColor: '#FFFFFF',
          fontSize: 16,
          fontWeight: 500,
          border: { color: '#000000', width: 3 },
          shadow: { x: 4, y: 4 },
          radius: 8,
        }
      },
      {
        name: 'Button/Icon',
        type: 'button',
        specs: {
          width: 48,
          height: 48,
          fill: '#FEFEFE',
          text: '→',
          textColor: '#000000',
          fontSize: 20,
          fontWeight: 500,
          border: { color: '#000000', width: 3 },
          shadow: { x: 4, y: 4 },
          radius: 8,
        }
      },
      // INPUTS
      {
        name: 'Input/Default',
        type: 'input',
        specs: {
          width: 280,
          height: 48,
          fill: '#FEFEFE',
          placeholder: 'Enter your email...',
          placeholderColor: '#666666',
          border: { color: '#000000', width: 3 },
          radius: 8,
        }
      },
      {
        name: 'Input/Focused',
        type: 'input',
        specs: {
          width: 280,
          height: 48,
          fill: '#FEFEFE',
          placeholder: 'Focused state',
          placeholderColor: '#000000',
          border: { color: '#FF90E8', width: 3 },
          radius: 8,
        }
      },
      {
        name: 'Input/Error',
        type: 'input',
        specs: {
          width: 280,
          height: 48,
          fill: '#FEFEFE',
          placeholder: 'Invalid input',
          placeholderColor: '#FF4444',
          border: { color: '#FF4444', width: 3 },
          radius: 8,
        }
      },
      // BADGES
      {
        name: 'Badge/Pink',
        type: 'badge',
        specs: {
          height: 28,
          fill: '#FF90E8',
          text: 'Featured',
          textColor: '#000000',
          fontSize: 12,
          fontWeight: 600,
          paddingX: 12,
        }
      },
      {
        name: 'Badge/Black',
        type: 'badge',
        specs: {
          height: 28,
          fill: '#000000',
          text: 'Pro',
          textColor: '#FFFFFF',
          fontSize: 12,
          fontWeight: 600,
          paddingX: 12,
        }
      },
      {
        name: 'Badge/Outline',
        type: 'badge',
        specs: {
          height: 28,
          fill: 'transparent',
          text: 'New',
          textColor: '#000000',
          fontSize: 12,
          fontWeight: 600,
          paddingX: 12,
          border: { color: '#000000', width: 2 },
        }
      },
      // TOGGLE
      {
        name: 'Toggle/Off',
        type: 'toggle',
        specs: {
          width: 52,
          height: 28,
          fill: '#E0E0E0',
          knobPosition: 'left',
        }
      },
      {
        name: 'Toggle/On',
        type: 'toggle',
        specs: {
          width: 52,
          height: 28,
          fill: '#FF90E8',
          knobPosition: 'right',
        }
      },
      // CHECKBOX
      {
        name: 'Checkbox/Unchecked',
        type: 'checkbox',
        specs: {
          size: 24,
          fill: '#FEFEFE',
          border: { color: '#000000', width: 3 },
          checked: false,
        }
      },
      {
        name: 'Checkbox/Checked',
        type: 'checkbox',
        specs: {
          size: 24,
          fill: '#FF90E8',
          border: { color: '#000000', width: 3 },
          checked: true,
        }
      },
      // LINK
      {
        name: 'Link/Default',
        type: 'link',
        specs: {
          text: 'Learn more →',
          color: '#FF90E8',
          fontSize: 16,
          fontWeight: 500,
          underline: false,
        }
      },
      {
        name: 'Link/Underline',
        type: 'link',
        specs: {
          text: 'Terms of Service',
          color: '#000000',
          fontSize: 14,
          fontWeight: 400,
          underline: true,
        }
      },
    ]
  },
  molecules: {
    title: '🔶 MOLECULES',
    items: [
      // FORM FIELD
      {
        name: 'FormField/Default',
        type: 'formField',
        specs: {
          width: 320,
          label: 'Email address',
          placeholder: 'you@example.com',
          helper: "We'll never share your email.",
        }
      },
      {
        name: 'FormField/Error',
        type: 'formField',
        specs: {
          width: 320,
          label: 'Password',
          placeholder: '••••••••',
          helper: 'Password must be at least 8 characters.',
          error: true,
        }
      },
      // ALERTS
      {
        name: 'Alert/Success',
        type: 'alert',
        specs: {
          width: 360,
          variant: 'success',
          title: 'Payment successful!',
          message: 'Your order has been confirmed.',
          icon: '✓',
        }
      },
      {
        name: 'Alert/Warning',
        type: 'alert',
        specs: {
          width: 360,
          variant: 'warning',
          title: 'Attention needed',
          message: 'Please verify your email address.',
          icon: '⚠',
        }
      },
      {
        name: 'Alert/Error',
        type: 'alert',
        specs: {
          width: 360,
          variant: 'error',
          title: 'Error occurred',
          message: 'Something went wrong. Please try again.',
          icon: '✕',
        }
      },
      {
        name: 'Alert/Info',
        type: 'alert',
        specs: {
          width: 360,
          variant: 'info',
          title: 'Did you know?',
          message: 'You can sell anything on Gumroad.',
          icon: 'ℹ',
        }
      },
      // TABS
      {
        name: 'Tab/Active',
        type: 'tab',
        specs: {
          text: 'Products',
          active: true,
        }
      },
      {
        name: 'Tab/Inactive',
        type: 'tab',
        specs: {
          text: 'Analytics',
          active: false,
        }
      },
      // SEARCH
      {
        name: 'SearchField',
        type: 'search',
        specs: {
          width: 320,
          placeholder: 'Search marketplace...',
        }
      },
      // DROPDOWN
      {
        name: 'Dropdown/Closed',
        type: 'dropdown',
        specs: {
          width: 200,
          value: 'Select category',
          open: false,
        }
      },
      // TOAST
      {
        name: 'Toast/Success',
        type: 'toast',
        specs: {
          width: 320,
          message: 'Product published!',
          variant: 'success',
        }
      },
      // STAT
      {
        name: 'Stat/Revenue',
        type: 'stat',
        specs: {
          label: 'Revenue',
          value: '$2,708,192',
          subtext: 'Last 7 days',
        }
      },
    ]
  },
  organisms: {
    title: '🔷 ORGANISMS',
    items: [
      // PRODUCT CARD
      {
        name: 'Card/Product',
        type: 'productCard',
        specs: {
          width: 280,
          imageHeight: 180,
          title: 'Digital Product Name',
          description: 'Short description of the product goes here.',
          price: '$49',
          rating: '4.9',
        }
      },
      // PRICING CARD
      {
        name: 'Card/Pricing/Basic',
        type: 'pricingCard',
        specs: {
          width: 300,
          tier: 'Basic',
          price: '10%',
          priceSubtext: '+ $0.50 per sale',
          features: [
            'Unlimited products',
            'Email delivery',
            'Basic analytics',
          ],
          featured: false,
        }
      },
      {
        name: 'Card/Pricing/Pro',
        type: 'pricingCard',
        specs: {
          width: 300,
          tier: 'Discover',
          price: '30%',
          priceSubtext: 'when discovered',
          features: [
            'Featured in marketplace',
            'Higher visibility',
            'New customer reach',
          ],
          featured: true,
        }
      },
      // TESTIMONIAL CARD
      {
        name: 'Card/Testimonial',
        type: 'testimonialCard',
        specs: {
          width: 360,
          quote: '"I love Gumroad because it can\'t be any simpler."',
          author: 'Daniel Vassallo',
          role: 'Sells business insights',
          revenue: '$2,708,192',
        }
      },
      // CREATOR CARD
      {
        name: 'Card/Creator',
        type: 'creatorCard',
        specs: {
          width: 280,
          name: 'Max Ulichney',
          handle: '@maxpacks',
          products: 'Procreate brush packs',
        }
      },
      // FEATURE CARD
      {
        name: 'Card/Feature',
        type: 'featureCard',
        specs: {
          width: 320,
          icon: '🏪',
          title: 'Your store, your way',
          description: 'Build a storefront and customize your site\'s colors.',
        }
      },
      // FAQ ITEM
      {
        name: 'FAQ/Item',
        type: 'faqItem',
        specs: {
          width: 600,
          question: 'What can I sell on Gumroad?',
          answer: 'Digital products, e-books, courses, tutorials, and memberships.',
          expanded: true,
        }
      },
      // NAVIGATION
      {
        name: 'Nav/Desktop',
        type: 'navbar',
        specs: {
          width: 1200,
          links: ['Discover', 'Features', 'Pricing', 'Blog'],
          cta: 'Start selling',
        }
      },
      // FOOTER
      {
        name: 'Footer/Simple',
        type: 'footer',
        specs: {
          width: 1200,
          columns: [
            { title: 'Product', links: ['Discover', 'Features', 'Pricing'] },
            { title: 'Company', links: ['About', 'Blog', 'Help'] },
            { title: 'Legal', links: ['Terms', 'Privacy'] },
          ],
        }
      },
      // CTA SECTION
      {
        name: 'CTA/Newsletter',
        type: 'ctaSection',
        specs: {
          width: 800,
          title: 'Share your work.',
          subtitle: 'Someone out there needs it.',
          buttonText: 'Start selling',
          inputPlaceholder: 'Enter your email',
        }
      },
      // HERO
      {
        name: 'Hero/Home',
        type: 'hero',
        specs: {
          width: 800,
          headline: 'Go from 0 to $1',
          subheadline: 'Anyone can earn their first dollar online.',
          primaryCta: 'Start selling',
          secondaryCta: 'Search marketplace',
        }
      },
    ]
  }
};

// ============================================================================
// HTTP Helper
// ============================================================================

async function sendCommand(command, payload = {}) {
  try {
    const response = await fetch(`${BRIDGE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload })
    });
    const data = await response.json();
    if (!data.success) {
      console.error(`❌ Command failed: ${command}`, data.error);
    }
    return data;
  } catch (error) {
    console.error(`❌ Network error: ${command}`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Component Builders
// ============================================================================

async function createButton(name, specs, x, y) {
  // Use create_component which supports strokes
  const rgb = hexToRgb(specs.fill === 'transparent' ? '#FFFFFF' : specs.fill);
  const borderRgb = specs.border ? hexToRgb(specs.border.color) : null;
  
  const componentResult = await sendCommand('create_component', {
    name,
    x,
    y,
    width: specs.width,
    height: specs.height,
    cornerRadius: specs.radius || 0,
    fills: specs.fill === 'transparent' ? [] : [{ type: 'SOLID', color: rgb }],
    strokes: borderRgb ? [{ type: 'SOLID', color: borderRgb }] : [],
    strokeWeight: specs.border?.width || 0,
    layoutMode: 'HORIZONTAL',
    padding: { top: 12, right: 24, bottom: 12, left: 24 },
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  
  if (!componentResult.success) {
    console.error(`   ❌ Failed to create ${name}`);
    return null;
  }
  const componentId = componentResult.data?.id;
  
  // Add shadow if specified
  if (specs.shadow) {
    await sendCommand('apply_effect', {
      nodeId: componentId,
      effects: [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: specs.shadow.x, y: specs.shadow.y },
        radius: 0,
        spread: 0,
        visible: true,
      }]
    });
  }
  
  // Add text
  await sendCommand('create_text', {
    text: specs.text,
    x: x + 24,
    y: y + (specs.height / 2) - 8,
    fontFamily: GUMROAD.fonts.primary,
    fontStyle: specs.fontWeight === 500 ? 'Medium' : 'Bold',
    fontSize: specs.fontSize,
    fills: [{ type: 'SOLID', color: hexToRgb(specs.textColor) }],
  });
  
  return componentId;
}

async function createInput(name, specs, x, y) {
  const rgb = hexToRgb(specs.fill);
  const borderRgb = specs.border ? hexToRgb(specs.border.color) : null;
  
  const componentResult = await sendCommand('create_component', {
    name,
    x,
    y,
    width: specs.width,
    height: specs.height,
    cornerRadius: specs.radius || 0,
    fills: [{ type: 'SOLID', color: rgb }],
    strokes: borderRgb ? [{ type: 'SOLID', color: borderRgb }] : [],
    strokeWeight: specs.border?.width || 0,
    layoutMode: 'HORIZONTAL',
    padding: { top: 12, right: 16, bottom: 12, left: 16 },
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
  });
  
  if (!componentResult.success) {
    console.error(`   ❌ Failed to create ${name}`);
    return null;
  }
  const componentId = componentResult.data?.id;
  
  // Add placeholder text
  await sendCommand('create_text', {
    text: specs.placeholder,
    x: x + 16,
    y: y + (specs.height / 2) - 8,
    fontFamily: GUMROAD.fonts.primary,
    fontStyle: 'Regular',
    fontSize: 16,
    fills: [{ type: 'SOLID', color: hexToRgb(specs.placeholderColor) }],
  });
  
  return componentId;
}

async function createBadge(name, specs, x, y) {
  // Calculate width based on text
  const width = specs.text.length * 8 + specs.paddingX * 2;
  const rgb = hexToRgb(specs.fill === 'transparent' ? '#FFFFFF' : specs.fill);
  const borderRgb = specs.border ? hexToRgb(specs.border.color) : null;
  
  const componentResult = await sendCommand('create_component', {
    name,
    x,
    y,
    width,
    height: specs.height,
    cornerRadius: GUMROAD.border.radiusFull,
    fills: specs.fill === 'transparent' ? [] : [{ type: 'SOLID', color: rgb }],
    strokes: borderRgb ? [{ type: 'SOLID', color: borderRgb }] : [],
    strokeWeight: specs.border?.width || 0,
    layoutMode: 'HORIZONTAL',
    padding: { top: 4, right: specs.paddingX, bottom: 4, left: specs.paddingX },
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  
  if (!componentResult.success) {
    console.error(`   ❌ Failed to create ${name}`);
    return null;
  }
  const componentId = componentResult.data?.id;
  
  // Add text
  await sendCommand('create_text', {
    text: specs.text,
    x: x + specs.paddingX,
    y: y + 4,
    fontFamily: GUMROAD.fonts.primary,
    fontStyle: 'SemiBold',
    fontSize: specs.fontSize,
    fills: [{ type: 'SOLID', color: hexToRgb(specs.textColor) }],
  });
  
  return componentId;
}

async function createSectionHeader(title, x, y) {
  await sendCommand('create_text', {
    text: title,
    x,
    y,
    fontFamily: GUMROAD.fonts.primary,
    fontStyle: 'Bold',
    fontSize: 32,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
  });
}

// Helper to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  } : { r: 0, g: 0, b: 0 };
}

// ============================================================================
// Main Build Function
// ============================================================================

async function buildGumroadComponents() {
  console.log('🎨 Starting Gumroad Component Build...\n');
  
  // Check bridge connection by fetching status
  try {
    const statusResponse = await fetch(`${BRIDGE_URL}/status`);
    const status = await statusResponse.json();
    if (!status.connected) {
      console.error('❌ Bridge not connected. Please start the orchestration server and connect the Figma plugin.');
      return;
    }
    console.log('✅ Bridge connected');
    console.log(`📄 File: ${status.fileInfo?.name || 'Unknown'}`);
    console.log(`📍 Current page: ${status.fileInfo?.currentPage || 'Unknown'}\n`);
  } catch (error) {
    console.error('❌ Cannot connect to orchestration server. Is it running on port 9877?');
    return;
  }
  
  // Use get_pages command (correct name)
  const pagesResult = await sendCommand('get_pages', {});
  if (pagesResult.success && pagesResult.data) {
    const pages = pagesResult.data;
    console.log(`📄 Found ${pages.length} pages`);
    
    // Find page 18
    if (pages.length >= 18) {
      PAGE_CONFIG.pageId = pages[17].id; // 0-indexed
      console.log(`📍 Using Page 18: ${pages[17].name}\n`);
    } else {
      console.log('⚠️  Page 18 not found. Please create it first.');
      return;
    }
  }
  
  // Navigate to page 18
  await sendCommand('set_current_page', { pageId: PAGE_CONFIG.pageId });
  
  let currentX = PAGE_CONFIG.startX;
  let currentY = PAGE_CONFIG.startY;
  let maxHeightInRow = 0;
  
  // Build each section
  for (const [sectionKey, section] of Object.entries(COMPONENTS)) {
    console.log(`\n📦 Building ${section.title}...`);
    
    // Add section header
    await createSectionHeader(section.title, currentX, currentY);
    currentY += 60;
    
    let columnX = currentX;
    let rowY = currentY;
    let itemsInRow = 0;
    const maxItemsPerRow = 4;
    
    for (const component of section.items) {
      console.log(`   → ${component.name}`);
      
      // Build component based on type
      let componentId = null;
      switch (component.type) {
        case 'button':
          componentId = await createButton(component.name, component.specs, columnX, rowY);
          break;
        case 'input':
          componentId = await createInput(component.name, component.specs, columnX, rowY);
          break;
        case 'badge':
          componentId = await createBadge(component.name, component.specs, columnX, rowY);
          break;
        // Add more component builders as needed
        default:
          // For complex components, create a placeholder component
          const result = await sendCommand('create_component', {
            name: component.name,
            x: columnX,
            y: rowY,
            width: component.specs?.width || 300,
            height: component.specs?.height || 200,
            cornerRadius: 8,
            fills: [{ type: 'SOLID', color: { r: 0.996, g: 0.996, b: 0.996 } }],
            strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
            strokeWeight: 3,
          });
          if (result.success) {
            componentId = result.data?.id;
          }
      }
      
      // Update position
      const componentWidth = component.specs?.width || 300;
      const componentHeight = component.specs?.height || 60;
      
      columnX += componentWidth + PAGE_CONFIG.componentGap;
      maxHeightInRow = Math.max(maxHeightInRow, componentHeight);
      itemsInRow++;
      
      // Wrap to next row if needed
      if (itemsInRow >= maxItemsPerRow) {
        columnX = currentX;
        rowY += maxHeightInRow + PAGE_CONFIG.componentGap;
        maxHeightInRow = 0;
        itemsInRow = 0;
      }
      
      // Small delay to avoid overwhelming Figma
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Move to next section
    currentY = rowY + maxHeightInRow + PAGE_CONFIG.sectionGap;
    maxHeightInRow = 0;
  }
  
  console.log('\n✅ Gumroad Component Build Complete!');
  console.log(`📍 Components created on Page 18`);
}

// Run if called directly
buildGumroadComponents().catch(console.error);

export { buildGumroadComponents, COMPONENTS, GUMROAD };
