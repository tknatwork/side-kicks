#!/bin/bash
# ============================================================================
# Nectar Design System - Set Colors for New DS File
# Updates the Ant Design System seed variables with NDS colors
# ============================================================================

SERVER="http://localhost:9877"

# Mode IDs for seed collection
LIGHT="13:48"
DARK="13:49"

# Function to set color value (r, g, b are 0-1 floats)
set_color() {
    local var_id="$1"
    local mode_id="$2"
    local r="$3"
    local g="$4"
    local b="$5"
    local name="$6"
    echo "  Setting $name ($var_id) mode=$mode_id → rgb($r, $g, $b)"
    curl -s --max-time 30 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$var_id\",\"modeId\":\"$mode_id\",\"value\":{\"r\":$r,\"g\":$g,\"b\":$b}}}" > /dev/null
    sleep 0.3
}

# Function to convert hex to rgb floats
# Usage: hex_to_rgb "#FF90E8"
hex_to_rgb() {
    local hex="${1#\#}"
    printf "%.4f %.4f %.4f" \
        "$(echo "scale=4; $((16#${hex:0:2})) / 255" | bc)" \
        "$(echo "scale=4; $((16#${hex:2:2})) / 255" | bc)" \
        "$(echo "scale=4; $((16#${hex:4:2})) / 255" | bc)"
}

echo "============================================================================"
echo "🎨 NECTAR DESIGN SYSTEM - COLOR UPDATE"
echo "============================================================================"
echo ""
echo "Updating seed collection colors to NDS palette..."
echo ""

# ============================================================================
# SEED COLLECTION VARIABLES
# ============================================================================
# VariableID:13:2112 - colorPrimary
# VariableID:13:2113 - colorSuccess  
# VariableID:13:2114 - colorWarning
# VariableID:13:2115 - colorError
# VariableID:13:2116 - colorInfo
# VariableID:13:2117 - colorTextBase
# VariableID:13:2118 - colorBgBase

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 LIGHT MODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# colorPrimary - Nectar Pink #FF90E8 → rgb(1.0, 0.565, 0.91)
set_color "VariableID:13:2112" "$LIGHT" 1.0 0.565 0.91 "colorPrimary"

# colorSuccess - Green #23A094 → rgb(0.137, 0.627, 0.58)
set_color "VariableID:13:2113" "$LIGHT" 0.137 0.627 0.58 "colorSuccess"

# colorWarning - Orange #FFC900 → rgb(1.0, 0.788, 0.0)
set_color "VariableID:13:2114" "$LIGHT" 1.0 0.788 0.0 "colorWarning"

# colorError - Red #DC341E → rgb(0.863, 0.204, 0.118)
set_color "VariableID:13:2115" "$LIGHT" 0.863 0.204 0.118 "colorError"

# colorInfo - Purple #90A8ED → rgb(0.565, 0.659, 0.929)
set_color "VariableID:13:2116" "$LIGHT" 0.565 0.659 0.929 "colorInfo"

# colorTextBase - Near Black #18181B → rgb(0.094, 0.094, 0.106)
set_color "VariableID:13:2117" "$LIGHT" 0.094 0.094 0.106 "colorTextBase"

# colorBgBase - White #FFFFFF → rgb(1.0, 1.0, 1.0)
set_color "VariableID:13:2118" "$LIGHT" 1.0 1.0 1.0 "colorBgBase"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌙 DARK MODE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# colorPrimary - Slightly lighter pink for dark mode #FFA8E7 → rgb(1.0, 0.659, 0.906)
set_color "VariableID:13:2112" "$DARK" 1.0 0.659 0.906 "colorPrimary"

# colorSuccess - Lighter green for dark mode #4BC3B7 → rgb(0.294, 0.765, 0.718)
set_color "VariableID:13:2113" "$DARK" 0.294 0.765 0.718 "colorSuccess"

# colorWarning - Lighter orange for dark mode #FFDE4B → rgb(1.0, 0.871, 0.294)
set_color "VariableID:13:2114" "$DARK" 1.0 0.871 0.294 "colorWarning"

# colorError - Lighter red for dark mode #EF5F4D → rgb(0.937, 0.373, 0.302)
set_color "VariableID:13:2115" "$DARK" 0.937 0.373 0.302 "colorError"

# colorInfo - Lighter purple for dark mode #A8BBF3 → rgb(0.659, 0.733, 0.953)
set_color "VariableID:13:2116" "$DARK" 0.659 0.733 0.953 "colorInfo"

# colorTextBase - Near White #F4F4F5 → rgb(0.957, 0.957, 0.961)
set_color "VariableID:13:2117" "$DARK" 0.957 0.957 0.961 "colorTextBase"

# colorBgBase - Near Black #09090B → rgb(0.035, 0.035, 0.043)
set_color "VariableID:13:2118" "$DARK" 0.035 0.035 0.043 "colorBgBase"

echo ""
echo "============================================================================"
echo "✅ SEED COLORS UPDATED!"
echo "============================================================================"
echo ""
echo "Colors updated:"
echo "  • colorPrimary    → Nectar Pink (#FF90E8 / #FFA8E7)"
echo "  • colorSuccess    → Green (#23A094 / #4BC3B7)"
echo "  • colorWarning    → Orange (#FFC900 / #FFDE4B)"
echo "  • colorError      → Red (#DC341E / #EF5F4D)"
echo "  • colorInfo       → Purple (#90A8ED / #A8BBF3)"
echo "  • colorTextBase   → Text (#18181B / #F4F4F5)"
echo "  • colorBgBase     → Background (#FFFFFF / #09090B)"
echo ""
echo "Note: These are seed values. The colors collection will generate"
echo "      full palettes from these base colors automatically."
echo ""
