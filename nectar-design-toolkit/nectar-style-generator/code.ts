/**
 * Nectar Style Generator - Figma Plugin
 * 
 * Generates Figma Styles from Variable Modes (Theme + Breakpoint combinations)
 * 
 * Architecture:
 * - MAPPED Collection (Light/Dark): COLOR tokens for theming
 * - BREAKPOINTS Collection (Desktop/Tablet/Mobile): FLOAT tokens for sizing
 * 
 * Generated Styles:
 * - Color Styles: From Mapped collection (bg/*, fg/*, border/*, primary/*, etc.)
 * - Text Styles: From Breakpoints (typescale/*, combining size/weight/lineHeight/letterSpacing)
 * - Effect Styles: From Breakpoints (elevation/*, combining blur/offsetY/spread/opacity)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Collection IDs (update these if your file has different IDs)
const MAPPED_COLLECTION_ID = 'VariableCollectionId:94:3';
const BREAKPOINTS_COLLECTION_ID = 'VariableCollectionId:101:233';

// Mode IDs
const MAPPED_MODES: Record<string, string> = {
  Light: '94:6',
  Dark: '94:7'
};

const BREAKPOINT_MODES: Record<string, string> = {
  Desktop: '101:0',
  Tablet: '101:1',
  Mobile: '101:2'
};

// Default font family for text styles
// Maps to Alias collection: typography/fontFamily/*
const DEFAULT_FONT_FAMILY = 'Switzer';       // fontFamily/sans
const SERIF_FONT_FAMILY = 'Merriweather';    // fontFamily/serif (for quote)
const MONO_FONT_FAMILY = 'JetBrains Mono';   // fontFamily/mono (for code)

// Style prefix for identification
const STYLE_PREFIX = '🍯 ';
const GENERATED_MARKER = '[Nectar]';

// ============================================================================
// TYPES
// ============================================================================

interface GenerateMessage {
  type: 'generate-styles';
  theme: 'Light' | 'Dark';
  breakpoint: 'Desktop' | 'Tablet' | 'Mobile';
}

interface ClearMessage {
  type: 'clear-styles';
}

interface CheckFontsMessage {
  type: 'check-fonts';
  breakpoint: 'Desktop' | 'Tablet' | 'Mobile';
}

type PluginMessage = GenerateMessage | ClearMessage | CheckFontsMessage;

interface FontCheckResult {
  family: string;
  styles: { name: string; available: boolean }[];
}

interface StyleStats {
  colors: number;
  text: number;
  effects: number;
  grids: number;
}

interface TypographyStyle {
  name: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontFamily: string;
  isEmphasized: boolean;
}

interface ElevationStyle {
  name: string;
  blur?: number;
  offsetY?: number;
  spread?: number;
  opacity?: number;
}

interface GridLayoutStyle {
  name: string;
  columns?: number;
  gap?: number;
  gutter?: number;
  margin?: number;
}

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

figma.showUI(__html__, {
  width: 320,
  height: 720,
  title: 'Nectar Style Generator',
  themeColors: true
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

figma.ui.onmessage = async (msg: PluginMessage) => {
  console.log('🍯 Received message:', JSON.stringify(msg));
  try {
    if (msg.type === 'generate-styles') {
      console.log('🍯 Starting style generation...');
      await generateStyles(msg.theme, msg.breakpoint);
    } else if (msg.type === 'clear-styles') {
      console.log('🍯 Clearing styles...');
      await clearGeneratedStyles();
    } else if (msg.type === 'check-fonts') {
      console.log('🍯 Checking required fonts...');
      await checkRequiredFonts(msg.breakpoint);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Plugin error:', errorMessage);
    console.error('Stack:', errorStack);
    figma.ui.postMessage({
      type: 'error',
      message: 'Error: ' + errorMessage
    });
  }
};

// ============================================================================
// FONT CHECK LOGIC
// ============================================================================

async function checkRequiredFonts(
  breakpoint: 'Desktop' | 'Tablet' | 'Mobile'
): Promise<void> {
  console.log('🔍 Checking required fonts for ' + breakpoint + ' breakpoint');
  
  const breakpointModeId = BREAKPOINT_MODES[breakpoint];
  const variables = await figma.variables.getLocalVariablesAsync();
  const breakpointVars = variables.filter(v => v.variableCollectionId === BREAKPOINTS_COLLECTION_ID);
  
  // Collect all required font families and their weights
  const fontRequirements = new Map<string, Set<number>>();
  
  // Find typography variables and extract weights
  const typoVars = breakpointVars.filter(v => 
    v.name.startsWith('typescale/') && v.resolvedType === 'FLOAT'
  );
  
  for (const variable of typoVars) {
    const { styleName, property, isEmphasized } = parseTypographyVariableName(variable.name);
    if (!styleName || property !== 'weight') continue;
    
    const value = await resolveFloatValue(variable, breakpointModeId);
    if (value === null) continue;
    
    // Determine font family for this style
    let fontFamily = DEFAULT_FONT_FAMILY;
    if (styleName.includes('quote')) {
      fontFamily = SERIF_FONT_FAMILY;
    } else if (styleName.includes('code')) {
      fontFamily = MONO_FONT_FAMILY;
    }
    
    if (!fontRequirements.has(fontFamily)) {
      fontRequirements.set(fontFamily, new Set());
    }
    fontRequirements.get(fontFamily)!.add(value);
  }
  
  // Also add default weight (400) for base styles
  if (!fontRequirements.has(DEFAULT_FONT_FAMILY)) {
    fontRequirements.set(DEFAULT_FONT_FAMILY, new Set());
  }
  fontRequirements.get(DEFAULT_FONT_FAMILY)!.add(400);
  
  // Check font availability
  const fontResults: FontCheckResult[] = [];
  
  for (const [family, weights] of fontRequirements) {
    const styleChecks: { name: string; available: boolean }[] = [];
    
    for (const weight of weights) {
      const styleName = getFontStyleFromWeight(weight);
      let available = false;
      
      try {
        await figma.loadFontAsync({ family, style: styleName });
        available = true;
      } catch (e) {
        available = false;
      }
      
      styleChecks.push({ name: styleName + ' (' + weight + ')', available });
    }
    
    fontResults.push({ family, styles: styleChecks });
  }
  
  // Sort: missing fonts first
  fontResults.sort((a, b) => {
    const aMissing = a.styles.filter(s => !s.available).length;
    const bMissing = b.styles.filter(s => !s.available).length;
    return bMissing - aMissing;
  });
  
  console.log('Font check results:', fontResults);
  
  figma.ui.postMessage({
    type: 'font-check-result',
    fonts: fontResults
  });
}

// ============================================================================
// MAIN GENERATION LOGIC
// ============================================================================

async function generateStyles(
  theme: 'Light' | 'Dark', 
  breakpoint: 'Desktop' | 'Tablet' | 'Mobile'
): Promise<void> {
  console.log('🍯 Generating styles for ' + theme + ' theme + ' + breakpoint + ' breakpoint');
  
  // Step 1: Clear existing generated styles
  await clearGeneratedStyles();
  
  // Step 2: Get mode IDs
  const themeModeId = MAPPED_MODES[theme];
  const breakpointModeId = BREAKPOINT_MODES[breakpoint];
  
  console.log('Theme mode: ' + themeModeId + ', Breakpoint mode: ' + breakpointModeId);
  
  // Step 3: Get all variables
  const variables = await figma.variables.getLocalVariablesAsync();
  console.log('Total variables: ' + variables.length);
  
  // Debug: show some variable collection IDs
  if (variables.length > 0) {
    const uniqueCollections = [...new Set(variables.map(v => v.variableCollectionId))];
    console.log('Unique collections found:', uniqueCollections);
  }
  
  // Filter by collection
  const mappedVars = variables.filter(v => v.variableCollectionId === MAPPED_COLLECTION_ID);
  const breakpointVars = variables.filter(v => v.variableCollectionId === BREAKPOINTS_COLLECTION_ID);
  
  console.log('Mapped vars: ' + mappedVars.length + ', Breakpoint vars: ' + breakpointVars.length);
  
  // Check if we found any variables
  if (mappedVars.length === 0 && breakpointVars.length === 0) {
    throw new Error('No variables found! Check if collection IDs are correct. Expected Mapped: ' + MAPPED_COLLECTION_ID + ', Breakpoints: ' + BREAKPOINTS_COLLECTION_ID);
  }
  
  // Step 4: Generate styles
  const stats: StyleStats = { colors: 0, text: 0, effects: 0, grids: 0 };
  
  // Generate color styles from Mapped collection (COLOR variables)
  stats.colors = await generateColorStyles(mappedVars, themeModeId);
  
  // Generate text styles from Breakpoints collection (typography variables)
  stats.text = await generateTextStyles(breakpointVars, breakpointModeId);
  
  // Generate effect styles from Breakpoints collection (elevation variables)
  stats.effects = await generateEffectStyles(breakpointVars, breakpointModeId);
  
  // Generate grid styles from Breakpoints collection (grid variables)
  stats.grids = await generateGridStyles(breakpointVars, breakpointModeId);
  
  // Report success
  const totalStyles = stats.colors + stats.text + stats.effects + stats.grids;
  figma.ui.postMessage({
    type: 'success',
    message: '✅ Generated ' + totalStyles + ' styles for ' + theme + ' + ' + breakpoint,
    stats
  });
  
  figma.notify('🍯 Generated ' + totalStyles + ' styles!', { timeout: 3000 });
}

// ============================================================================
// COLOR STYLE GENERATION (from Mapped Collection)
// ============================================================================

async function generateColorStyles(
  variables: Variable[],
  themeModeId: string
): Promise<number> {
  const colorVars = variables.filter(v => v.resolvedType === 'COLOR');
  console.log('🎨 Generating ' + colorVars.length + ' color styles...');
  
  let count = 0;
  
  for (const variable of colorVars) {
    try {
      const color = await resolveColorValue(variable, themeModeId);
      if (!color) {
        console.warn('Could not resolve color for ' + variable.name);
        continue;
      }
      
      // Create paint style
      const styleName = formatColorStyleName(variable.name);
      const style = figma.createPaintStyle();
      style.name = styleName;
      style.description = GENERATED_MARKER + ' From: ' + variable.name;
      style.paints = [{
        type: 'SOLID',
        color: { r: color.r, g: color.g, b: color.b },
        opacity: color.a !== undefined ? color.a : 1
      }];
      
      count++;
    } catch (err) {
      console.warn('Error creating color style for ' + variable.name + ':', err);
    }
  }
  
  console.log('✅ Created ' + count + ' color styles');
  return count;
}

async function resolveColorValue(
  variable: Variable,
  modeId: string,
  depth: number = 0
): Promise<RGBA | null> {
  if (depth > 10) {
    console.warn('Max alias depth reached for ' + variable.name);
    return null;
  }
  
  const value = variable.valuesByMode[modeId];
  
  // Handle direct color value
  if (value && typeof value === 'object' && 'r' in value) {
    return value as RGBA;
  }
  
  // Handle variable alias
  if (value && typeof value === 'object' && 'type' in value && (value as any).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as VariableAlias).id;
    const aliasVar = await figma.variables.getVariableByIdAsync(aliasId);
    if (aliasVar) {
      // Get the appropriate mode for the aliased variable
      const aliasCollection = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
      if (aliasCollection && aliasCollection.modes.length > 0) {
        // Use first mode for aliased variables (Brand/Alias collections have single mode)
        const aliasModeId = aliasCollection.modes[0].modeId;
        return resolveColorValue(aliasVar, aliasModeId, depth + 1);
      }
    }
  }
  
  return null;
}

function formatColorStyleName(variableName: string): string {
  // Organize color styles by category
  // bg/canvas → 🍯 color/bg/canvas
  return STYLE_PREFIX + 'color/' + variableName;
}

// ============================================================================
// TEXT STYLE GENERATION (from Breakpoints Collection)
// ============================================================================

async function generateTextStyles(
  variables: Variable[],
  breakpointModeId: string
): Promise<number> {
  console.log('✍️ Generating text styles...');
  
  // Group typography variables by style name
  // typescale/display/xl → fontSize
  // typescale/display/xl/weight → fontWeight
  // typescale/display/xl/lineHeight → lineHeight
  // typescale/display/xl/letterSpacing → letterSpacing
  // typescale/display/xl/weight-emphasized → emphasized variant
  
  const typographyMap = new Map<string, Partial<TypographyStyle>>();
  
  // Find all typography-related variables
  const typoVars = variables.filter(v => 
    v.name.startsWith('typescale/') && v.resolvedType === 'FLOAT'
  );
  
  console.log('Found ' + typoVars.length + ' typography variables');
  
  for (const variable of typoVars) {
    const { styleName, property, isEmphasized } = parseTypographyVariableName(variable.name);
    if (!styleName) continue;
    
    const value = await resolveFloatValue(variable, breakpointModeId);
    if (value === null) continue;
    
    // Create separate entries for regular and emphasized variants
    const key = isEmphasized ? styleName + '-emphasized' : styleName;
    
    if (!typographyMap.has(key)) {
      // Determine font family based on style type
      // quote → Merriweather (serif), code → JetBrains Mono (mono), others → Switzer (sans)
      let fontFamily = DEFAULT_FONT_FAMILY;
      if (styleName.includes('quote')) {
        fontFamily = SERIF_FONT_FAMILY;
      } else if (styleName.includes('code')) {
        fontFamily = MONO_FONT_FAMILY;
      }
      
      typographyMap.set(key, {
        name: key,
        isEmphasized,
        fontFamily
      });
    }
    
    const styleData = typographyMap.get(key)!;
    
    switch (property) {
      case 'size':
        styleData.fontSize = value;
        break;
      case 'weight':
        styleData.fontWeight = value;
        break;
      case 'lineHeight':
        styleData.lineHeight = value;
        break;
      case 'letterSpacing':
        styleData.letterSpacing = value;
        break;
    }
  }
  
  // Debug: show what we collected for base styles
  console.log('=== BASE STYLES ===');
  for (const [key, data] of typographyMap) {
    if (!key.endsWith('-emphasized') && !data.isEmphasized) {
      console.log(key + ': fontSize=' + data.fontSize + ', lineHeight=' + data.lineHeight);
    }
  }
  
  console.log('=== EMPHASIZED STYLES (before inheritance) ===');
  for (const [key, data] of typographyMap) {
    if (key.endsWith('-emphasized') || data.isEmphasized) {
      console.log(key + ': fontSize=' + data.fontSize + ', lineHeight=' + data.lineHeight + ', weight=' + data.fontWeight);
    }
  }
  
  // For emphasized styles, copy ALL properties from base style
  // Emphasized styles only have weight-emphasized defined, they need to inherit everything else
  const emphasizedKeys = Array.from(typographyMap.keys()).filter(k => k.endsWith('-emphasized'));
  console.log('Emphasized keys to process:', emphasizedKeys);
  
  for (const key of emphasizedKeys) {
    const data = typographyMap.get(key)!;
    // Find the base style name by removing -emphasized suffix
    const baseKey = key.replace('-emphasized', '');
    const baseData = typographyMap.get(baseKey);
    
    console.log('Processing: ' + key + ' -> base: ' + baseKey + ' exists: ' + (baseData !== undefined));
    
    if (baseData) {
      // Copy ALL missing properties from base
      if (data.fontSize === undefined) {
        data.fontSize = baseData.fontSize;
        console.log('  -> Copied fontSize: ' + data.fontSize);
      }
      if (data.lineHeight === undefined) {
        data.lineHeight = baseData.lineHeight;
        console.log('  -> Copied lineHeight: ' + data.lineHeight);
      }
      if (data.letterSpacing === undefined) {
        data.letterSpacing = baseData.letterSpacing;
        console.log('  -> Copied letterSpacing: ' + data.letterSpacing);
      }
      if (!data.fontFamily) {
        data.fontFamily = baseData.fontFamily;
      }
      data.isEmphasized = true;
    } else {
      console.warn('⚠️ NO BASE FOUND for: ' + key);
    }
  }
  
  console.log('=== EMPHASIZED STYLES (after inheritance) ===');
  for (const key of emphasizedKeys) {
    const data = typographyMap.get(key)!;
    console.log(key + ': fontSize=' + data.fontSize + ', lineHeight=' + data.lineHeight + ', weight=' + data.fontWeight);
  }
  
  // Create text styles
  let count = 0;
  
  for (const [styleName, data] of typographyMap) {
    // Skip if we don't have a font size (required)
    if (!data.fontSize) {
      console.log('Skipping ' + styleName + ' - no fontSize');
      continue;
    }
    
    // Debug: log what we're about to create
    console.log('Creating style: ' + styleName + 
      ' | fontSize=' + data.fontSize + 
      ' | lineHeight=' + data.lineHeight + 
      ' | weight=' + data.fontWeight +
      ' | isEmphasized=' + data.isEmphasized);
    
    try {
      const preferredFontStyle = getFontStyleFromWeight(data.fontWeight || 400);
      const fontFamily = data.fontFamily || DEFAULT_FONT_FAMILY;
      
      // Generate smart fallback order based on weight and emphasized status
      // For emphasized/heavier styles: try heavier weights first, then lighter
      // For regular styles: try lighter weights first
      const fallbackStyles = getSmartFallbackStyles(preferredFontStyle, data.isEmphasized || false, data.fontWeight || 400);
      let loadedFontStyle = preferredFontStyle;
      let fontLoaded = false;
      
      // First try the preferred style
      try {
        await figma.loadFontAsync({ family: fontFamily, style: preferredFontStyle });
        fontLoaded = true;
      } catch (fontError) {
        console.warn('Could not load font ' + fontFamily + ' ' + preferredFontStyle + ', trying fallbacks...');
        
        // Try each fallback style in smart order
        for (const fallbackStyle of fallbackStyles) {
          if (fallbackStyle === preferredFontStyle) continue; // Skip already tried
          try {
            await figma.loadFontAsync({ family: fontFamily, style: fallbackStyle });
            loadedFontStyle = fallbackStyle;
            fontLoaded = true;
            console.log('  -> Fallback succeeded with: ' + fontFamily + ' ' + loadedFontStyle);
            break;
          } catch (e) {
            console.log('  -> Fallback failed: ' + fallbackStyle);
          }
        }
        
        if (!fontLoaded) {
          console.warn('Could not load any font style for ' + fontFamily + ', skipping ' + styleName);
          continue;
        }
      }
      
      const style = figma.createTextStyle();
      style.name = formatTextStyleName(styleName, data.isEmphasized || false);
      style.description = GENERATED_MARKER + ' Typography: ' + styleName;
      
      style.fontName = { family: fontFamily, style: loadedFontStyle };
      style.fontSize = data.fontSize;
      
      // Line height - debug and apply
      console.log('Setting lineHeight for ' + styleName + ': value=' + data.lineHeight + ', type=' + typeof data.lineHeight);
      if (data.lineHeight !== undefined && data.lineHeight !== null && data.lineHeight > 0) {
        let lineHeightValue: number;
        if (data.lineHeight <= 3) {
          // It's a multiplier like 1.5, convert to percentage
          lineHeightValue = data.lineHeight * 100;
        } else {
          // It's a percentage value like 150
          lineHeightValue = data.lineHeight;
        }
        console.log('  -> Applying lineHeight: ' + lineHeightValue + '%');
        style.lineHeight = { value: lineHeightValue, unit: 'PERCENT' };
      } else {
        console.log('  -> lineHeight is undefined/null/0, skipping');
      }
      
      // Letter spacing (typically percentage values like 0, -0.5, -1)
      if (data.letterSpacing !== undefined) {
        style.letterSpacing = { value: data.letterSpacing, unit: 'PERCENT' };
      }
      
      count++;
    } catch (err) {
      console.warn('Could not create text style for ' + styleName + ':', err);
    }
  }
  
  console.log('✅ Created ' + count + ' text styles');
  return count;
}

interface ParsedTypographyName {
  styleName: string | null;
  property: 'size' | 'weight' | 'lineHeight' | 'letterSpacing';
  isEmphasized: boolean;
}

function parseTypographyVariableName(name: string): ParsedTypographyName {
  // Parse variable names like:
  // typescale/display/xl → { styleName: 'display/xl', property: 'size' }
  // typescale/display/xl/weight → { styleName: 'display/xl', property: 'weight' }
  // typescale/display/xl/weight-emphasized → { styleName: 'display/xl', property: 'weight', isEmphasized: true }
  
  const parts = name.replace('typescale/', '').split('/');
  const lastPart = parts[parts.length - 1];
  const isEmphasized = lastPart.includes('-emphasized') || lastPart.includes(' -emphasized');
  
  // Determine the property type
  let property: 'size' | 'weight' | 'lineHeight' | 'letterSpacing' = 'size';
  let styleParts = [...parts];
  
  const cleanLastPart = lastPart.replace('-emphasized', '').replace(' -emphasized', '').trim();
  
  if (cleanLastPart === 'weight') {
    property = 'weight';
    styleParts = parts.slice(0, -1);
  } else if (cleanLastPart === 'lineHeight') {
    property = 'lineHeight';
    styleParts = parts.slice(0, -1);
  } else if (cleanLastPart === 'letterSpacing') {
    property = 'letterSpacing';
    styleParts = parts.slice(0, -1);
  } else if (cleanLastPart === 'family') {
    // Skip family variables for now
    return { styleName: null, property: 'size', isEmphasized: false };
  }
  
  const styleName = styleParts.join('/');
  
  return { styleName, property, isEmphasized };
}

function getFontStyleFromWeight(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'ExtraLight';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semibold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extrabold';
  return 'Black';
}

// Smart fallback order based on weight and emphasized status
// For emphasized styles: prefer heavier weights over lighter (Bold over Regular)
// For regular styles: prefer lighter weights
function getSmartFallbackStyles(preferredStyle: string, isEmphasized: boolean, weight: number): string[] {
  // All available font weight styles from heavy to light
  const allStyles = ['Black', 'Extrabold', 'Bold', 'Semibold', 'Medium', 'Regular', 'Light', 'ExtraLight', 'Thin'];
  
  const preferredIndex = allStyles.indexOf(preferredStyle);
  if (preferredIndex === -1) {
    // Unknown style, return default order
    return isEmphasized 
      ? ['Bold', 'Semibold', 'Medium', 'Regular'] // Emphasized: heavier first
      : ['Regular', 'Medium', 'Semibold', 'Bold']; // Regular: lighter first
  }
  
  const result: string[] = [];
  
  if (isEmphasized || weight >= 500) {
    // For emphasized/heavier styles: try heavier weights first, then lighter
    // e.g., Medium (500) emphasized → try Bold, Semibold, then Regular
    for (let i = preferredIndex - 1; i >= 0; i--) {
      result.push(allStyles[i]); // Heavier weights
    }
    for (let i = preferredIndex + 1; i < allStyles.length; i++) {
      result.push(allStyles[i]); // Lighter weights as last resort
    }
  } else {
    // For regular/lighter styles: try lighter weights first, then heavier
    for (let i = preferredIndex + 1; i < allStyles.length; i++) {
      result.push(allStyles[i]); // Lighter weights
    }
    for (let i = preferredIndex - 1; i >= 0; i--) {
      result.push(allStyles[i]); // Heavier weights as last resort
    }
  }
  
  return result;
}

function formatTextStyleName(styleName: string, isEmphasized: boolean): string {
  // Organize text styles hierarchically
  // display/xl → 🍯 text/display/xl
  // display/xl-emphasized → 🍯 text/display/xl-emphasized
  const cleanName = styleName.replace('-emphasized', '');
  const suffix = isEmphasized ? '-emphasized' : '';
  return STYLE_PREFIX + 'text/' + cleanName + suffix;
}

async function resolveFloatValue(
  variable: Variable,
  modeId: string,
  depth: number = 0
): Promise<number | null> {
  if (depth > 10) {
    console.warn('Max alias depth reached for ' + variable.name);
    return null;
  }
  
  const value = variable.valuesByMode[modeId];
  
  // Handle direct float value
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle variable alias
  if (value && typeof value === 'object' && 'type' in value && (value as any).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as VariableAlias).id;
    const aliasVar = await figma.variables.getVariableByIdAsync(aliasId);
    if (aliasVar) {
      // Get the appropriate mode for the aliased variable
      const aliasCollection = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
      if (aliasCollection && aliasCollection.modes.length > 0) {
        // For Mobile mode that aliases to Alias collection, use the single mode
        const aliasModeId = aliasCollection.modes[0].modeId;
        return resolveFloatValue(aliasVar, aliasModeId, depth + 1);
      }
    }
  }
  
  return null;
}

// ============================================================================
// EFFECT STYLE GENERATION (from Breakpoints Collection)
// ============================================================================

async function generateEffectStyles(
  variables: Variable[],
  breakpointModeId: string
): Promise<number> {
  console.log('✨ Generating effect styles...');
  
  // Group elevation variables by level
  // elevation/sm/blur → blur
  // elevation/sm/offsetY → offsetY
  // elevation/sm/spread → spread
  // elevation/sm/opacity → opacity (for shadow color alpha)
  
  const elevationMap = new Map<string, Partial<ElevationStyle>>();
  
  // Find elevation-related variables
  const elevationVars = variables.filter(v => 
    v.name.startsWith('elevation/') && v.resolvedType === 'FLOAT'
  );
  
  console.log('Found ' + elevationVars.length + ' elevation variables');
  
  for (const variable of elevationVars) {
    const { levelName, property } = parseElevationVariableName(variable.name);
    if (!levelName || !property) continue;
    
    const value = await resolveFloatValue(variable, breakpointModeId);
    if (value === null) continue;
    
    if (!elevationMap.has(levelName)) {
      elevationMap.set(levelName, { name: levelName });
    }
    
    const data = elevationMap.get(levelName)!;
    
    switch (property) {
      case 'blur':
        data.blur = value;
        break;
      case 'offsetY':
        data.offsetY = value;
        break;
      case 'spread':
        data.spread = value;
        break;
      case 'opacity':
        data.opacity = value;
        break;
    }
  }
  
  // Create effect styles
  let count = 0;
  
  for (const [levelName, data] of elevationMap) {
    // Need at least blur to create a shadow
    if (data.blur === undefined) {
      console.log('Skipping ' + levelName + ' - no blur');
      continue;
    }
    
    try {
      const style = figma.createEffectStyle();
      style.name = formatEffectStyleName(levelName);
      style.description = GENERATED_MARKER + ' Elevation: ' + levelName;
      
      // Create shadow with opacity controlling alpha
      const alpha = data.opacity !== undefined ? data.opacity : 0.15;
      
      const shadow: DropShadowEffect = {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: alpha },
        offset: { 
          x: 0, 
          y: data.offsetY || 4 
        },
        radius: data.blur,
        spread: data.spread || 0,
        visible: true,
        blendMode: 'NORMAL'
      };
      
      style.effects = [shadow];
      count++;
    } catch (err) {
      console.warn('Could not create effect style for ' + levelName + ':', err);
    }
  }
  
  console.log('✅ Created ' + count + ' effect styles');
  return count;
}

interface ParsedElevationName {
  levelName: string | null;
  property: 'blur' | 'offsetY' | 'spread' | 'opacity' | null;
}

function parseElevationVariableName(name: string): ParsedElevationName {
  // Parse names like:
  // elevation/sm/blur → { levelName: 'sm', property: 'blur' }
  // elevation/md/offsetY → { levelName: 'md', property: 'offsetY' }
  
  const parts = name.replace('elevation/', '').split('/');
  if (parts.length < 2) return { levelName: null, property: null };
  
  const levelName = parts[0]; // sm, md, lg, xl
  const property = parts[1] as 'blur' | 'offsetY' | 'spread' | 'opacity';
  
  if (['blur', 'offsetY', 'spread', 'opacity'].indexOf(property) === -1) {
    return { levelName: null, property: null };
  }
  
  return { levelName, property };
}

function formatEffectStyleName(levelName: string): string {
  return STYLE_PREFIX + 'effect/elevation-' + levelName;
}

// ============================================================================
// GRID STYLE GENERATION (from Breakpoints Collection)
// ============================================================================

async function generateGridStyles(
  variables: Variable[],
  breakpointModeId: string
): Promise<number> {
  console.log('📐 Generating grid styles...');
  
  // Group grid variables by style name
  // grid/columns → columns count
  // grid/gap → gap between columns
  // grid/gutter → gutter width (same as gap for our purposes)
  // grid/margin → margin on sides
  // grid/default/columns, grid/default/gap → default grid
  // grid/compact/gap → compact grid
  // grid/loose/gap → loose grid
  
  const gridMap = new Map<string, Partial<GridLayoutStyle>>();
  
  // Find all grid-related variables
  const gridVars = variables.filter(v => 
    v.name.startsWith('grid/') && v.resolvedType === 'FLOAT'
  );
  
  console.log('Found ' + gridVars.length + ' grid variables');
  
  for (const variable of gridVars) {
    const { styleName, property } = parseGridVariableName(variable.name);
    if (!styleName || !property) continue;
    
    const value = await resolveFloatValue(variable, breakpointModeId);
    if (value === null) continue;
    
    if (!gridMap.has(styleName)) {
      gridMap.set(styleName, { name: styleName });
    }
    
    const styleData = gridMap.get(styleName)!;
    
    switch (property) {
      case 'columns':
        styleData.columns = value;
        break;
      case 'gap':
        styleData.gap = value;
        break;
      case 'gutter':
        styleData.gutter = value;
        break;
      case 'margin':
        styleData.margin = value;
        break;
    }
  }
  
  // Also create predefined grid configurations
  // Main grid (uses grid/columns, grid/gap, grid/margin)
  const mainColumns = await getGridValue(variables, 'grid/columns', breakpointModeId);
  const mainGap = await getGridValue(variables, 'grid/gap', breakpointModeId);
  const mainMargin = await getGridValue(variables, 'grid/margin', breakpointModeId);
  
  if (mainColumns !== null) {
    gridMap.set('main', {
      name: 'main',
      columns: mainColumns,
      gap: mainGap || 24,
      margin: mainMargin || 64
    });
  }
  
  // Get base values for inheritance
  const baseColumns = gridMap.get('base')?.columns || mainColumns || 12;
  const baseGap = gridMap.get('base')?.gap || mainGap || 16;
  const baseMargin = gridMap.get('base')?.margin || mainMargin || 64;
  
  // Ensure compact and loose inherit columns from base if not defined
  // compact = same columns as base, but tighter gap (8px)
  if (gridMap.has('compact')) {
    const compact = gridMap.get('compact')!;
    if (compact.columns === undefined) {
      compact.columns = baseColumns;
    }
    if (compact.margin === undefined) {
      compact.margin = baseMargin;
    }
  }
  
  // loose = same columns as base, but wider gap (32px)
  if (gridMap.has('loose')) {
    const loose = gridMap.get('loose')!;
    if (loose.columns === undefined) {
      loose.columns = baseColumns;
    }
    if (loose.margin === undefined) {
      loose.margin = baseMargin;
    }
  }
  
  // sm/md/lg variants inherit gap and margin from base
  for (const size of ['sm', 'md', 'lg']) {
    if (gridMap.has(size)) {
      const sizeGrid = gridMap.get(size)!;
      if (sizeGrid.gap === undefined) {
        sizeGrid.gap = baseGap;
      }
      if (sizeGrid.margin === undefined) {
        sizeGrid.margin = baseMargin;
      }
    }
  }
  
  // Debug what we found
  console.log('Grid configurations found:');
  for (const [name, data] of gridMap) {
    console.log('  ' + name + ': columns=' + data.columns + ', gap=' + data.gap + ', margin=' + data.margin);
  }
  
  // Create grid styles
  let count = 0;
  
  for (const [styleName, data] of gridMap) {
    // Need at least columns to create a grid
    if (data.columns === undefined || data.columns <= 0) {
      console.log('Skipping ' + styleName + ' - no valid columns');
      continue;
    }
    
    try {
      const style = figma.createGridStyle();
      style.name = formatGridStyleName(styleName);
      style.description = GENERATED_MARKER + ' Grid Layout: ' + styleName;
      
      // Create column grid layout
      const columnGrid: LayoutGrid = {
        pattern: 'COLUMNS',
        alignment: 'STRETCH',
        gutterSize: data.gap || data.gutter || 16,
        count: Math.round(data.columns),
        offset: data.margin || 0,
        visible: true,
        color: { r: 1, g: 0, b: 0.5, a: 0.1 } // Pink tint for Nectar
      };
      
      style.layoutGrids = [columnGrid];
      count++;
      console.log('✅ Created grid style: ' + style.name);
    } catch (err) {
      console.warn('Could not create grid style for ' + styleName + ':', err);
    }
  }
  
  console.log('✅ Created ' + count + ' grid styles');
  return count;
}

async function getGridValue(
  variables: Variable[],
  variableName: string,
  modeId: string
): Promise<number | null> {
  const variable = variables.find(v => v.name === variableName);
  if (!variable) return null;
  return resolveFloatValue(variable, modeId);
}

interface ParsedGridName {
  styleName: string | null;
  property: 'columns' | 'gap' | 'gutter' | 'margin' | null;
}

function parseGridVariableName(name: string): ParsedGridName {
  // Parse variable names like:
  // grid/columns → { styleName: 'base', property: 'columns' }
  // grid/gap → { styleName: 'base', property: 'gap' }
  // grid/gutter → { styleName: 'base', property: 'gutter' }
  // grid/margin → { styleName: 'base', property: 'margin' }
  // grid/default/columns → { styleName: 'default', property: 'columns' }
  // grid/default/gap → { styleName: 'default', property: 'gap' }
  // grid/compact/gap → { styleName: 'compact', property: 'gap' }
  // grid/loose/gap → { styleName: 'loose', property: 'gap' }
  // grid/columns/sm → { styleName: 'sm', property: 'columns' }
  // grid/columns/md → { styleName: 'md', property: 'columns' }
  // grid/columns/lg → { styleName: 'lg', property: 'columns' }
  
  const parts = name.replace('grid/', '').split('/');
  
  if (parts.length === 1) {
    // grid/columns, grid/gap, grid/gutter, grid/margin
    const prop = parts[0] as 'columns' | 'gap' | 'gutter' | 'margin';
    if (['columns', 'gap', 'gutter', 'margin'].includes(prop)) {
      return { styleName: 'base', property: prop };
    }
    return { styleName: null, property: null };
  }
  
  if (parts.length === 2) {
    const [first, second] = parts;
    
    // grid/columns/sm, grid/columns/md, grid/columns/lg
    if (first === 'columns' && ['sm', 'md', 'lg'].includes(second)) {
      return { styleName: second, property: 'columns' };
    }
    
    // grid/default/columns, grid/default/gap, grid/compact/gap, grid/loose/gap
    if (['default', 'compact', 'loose'].includes(first)) {
      const prop = second as 'columns' | 'gap' | 'gutter' | 'margin';
      if (['columns', 'gap', 'gutter', 'margin'].includes(prop)) {
        return { styleName: first, property: prop };
      }
    }
  }
  
  return { styleName: null, property: null };
}

function formatGridStyleName(styleName: string): string {
  return STYLE_PREFIX + 'grid/' + styleName;
}

// ============================================================================
// CLEANUP
// ============================================================================

async function clearGeneratedStyles(): Promise<void> {
  let cleared = 0;
  
  // Clear paint styles
  const paintStyles = await figma.getLocalPaintStylesAsync();
  for (const style of paintStyles) {
    if (style.name.startsWith(STYLE_PREFIX) || style.description.includes(GENERATED_MARKER)) {
      style.remove();
      cleared++;
    }
  }
  
  // Clear text styles
  const textStyles = await figma.getLocalTextStylesAsync();
  for (const style of textStyles) {
    if (style.name.startsWith(STYLE_PREFIX) || style.description.includes(GENERATED_MARKER)) {
      style.remove();
      cleared++;
    }
  }
  
  // Clear effect styles
  const effectStyles = await figma.getLocalEffectStylesAsync();
  for (const style of effectStyles) {
    if (style.name.startsWith(STYLE_PREFIX) || style.description.includes(GENERATED_MARKER)) {
      style.remove();
      cleared++;
    }
  }
  
  // Clear grid styles
  const gridStyles = await figma.getLocalGridStylesAsync();
  for (const style of gridStyles) {
    if (style.name.startsWith(STYLE_PREFIX) || style.description.includes(GENERATED_MARKER)) {
      style.remove();
      cleared++;
    }
  }
  
  if (cleared > 0) {
    console.log('🗑️ Cleared ' + cleared + ' generated styles');
    figma.ui.postMessage({
      type: 'cleared',
      message: '🗑️ Cleared ' + cleared + ' generated styles'
    });
  }
}
