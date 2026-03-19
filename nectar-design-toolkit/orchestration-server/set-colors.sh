#!/bin/bash
# Nectar Design System - Set Color Values
# This script sets all color values for Light and Dark modes

SERVER="http://localhost:9877"

# Function to set color value
set_color() {
    local var_id="$1"
    local mode_id="$2"
    local r="$3"
    local g="$4"
    local b="$5"
    echo "Setting $var_id mode $mode_id -> rgb($r,$g,$b)"
    curl -s --max-time 90 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$var_id\",\"modeId\":\"$mode_id\",\"value\":{\"r\":$r,\"g\":$g,\"b\":$b}}}"
    echo ""
    sleep 0.5
}

echo "============================================"
echo "🎨 SETTING COLOR VALUES"
echo "============================================"
echo ""

# First, get all variables
echo "Fetching current variables..."
vars=$(curl -s --max-time 30 -X POST "$SERVER/command" \
    -H 'Content-Type: application/json' \
    -d '{"command":"get_variables","payload":{"collectionId":"VariableCollectionId:27:11"}}')
echo "$vars" | head -c 500
echo "..."
echo ""

# Mode IDs
LIGHT="27:0"
DARK="27:1"

# ============================================
# Nectar Pink Theme Colors (Based on #FF90E8)
# ============================================

echo "=== Primary Colors (Nectar Pink) ==="
# Primary Pink Scale
# 100: Very light pink
# 500: Main pink #FF90E8
# 900: Very dark pink

# We need to get variable IDs first. For now, let's set using known IDs from earlier:
# primary/500 = VariableID:30:12
# primary/100 = VariableID:30:13  
# primary/900 = VariableID:30:14
# primary/200 = VariableID:36:22

# Primary Light Mode
set_color "VariableID:30:13" "$LIGHT" 1.0 0.94 0.98      # primary/100 - very light pink
set_color "VariableID:36:22" "$LIGHT" 1.0 0.82 0.95      # primary/200
set_color "VariableID:30:12" "$LIGHT" 1.0 0.565 0.91     # primary/500 - #FF90E8 main
set_color "VariableID:30:14" "$LIGHT" 0.6 0.2 0.5        # primary/900 - dark pink

# Primary Dark Mode (inverted for dark theme)
set_color "VariableID:30:13" "$DARK" 0.25 0.12 0.22      # primary/100 in dark = dark bg
set_color "VariableID:36:22" "$DARK" 0.35 0.18 0.30      # primary/200
set_color "VariableID:30:12" "$DARK" 1.0 0.565 0.91      # primary/500 stays same
set_color "VariableID:30:14" "$DARK" 1.0 0.82 0.95       # primary/900 in dark = light

echo ""
echo "=== Secondary Colors (Coral/Orange accent) ==="
# Secondary - using coral/orange to complement pink
# secondary/500 = VariableID:31:15

set_color "VariableID:31:15" "$LIGHT" 1.0 0.55 0.45      # secondary/500 - coral
set_color "VariableID:31:15" "$DARK" 1.0 0.55 0.45       # same in dark

echo ""
echo "=== Neutral Colors ==="
# neutral/100 = VariableID:31:16
# neutral/900 = VariableID:31:17

set_color "VariableID:31:16" "$LIGHT" 0.98 0.98 0.98     # neutral/100 - near white
set_color "VariableID:31:17" "$LIGHT" 0.12 0.12 0.14     # neutral/900 - near black

set_color "VariableID:31:16" "$DARK" 0.12 0.12 0.14      # neutral/100 dark = near black
set_color "VariableID:31:17" "$DARK" 0.98 0.98 0.98      # neutral/900 dark = near white

echo ""
echo "=== Semantic Colors ==="
# success/500 = VariableID:31:18
# warning/500 = VariableID:32:19
# error/500 = VariableID:32:20
# info/500 = VariableID:33:21

# Success - Green
set_color "VariableID:31:18" "$LIGHT" 0.22 0.78 0.45     # success - bright green
set_color "VariableID:31:18" "$DARK" 0.30 0.85 0.52

# Warning - Amber/Yellow
set_color "VariableID:32:19" "$LIGHT" 1.0 0.75 0.0       # warning - amber
set_color "VariableID:32:19" "$DARK" 1.0 0.80 0.20

# Error - Red
set_color "VariableID:32:20" "$LIGHT" 0.95 0.30 0.35     # error - red
set_color "VariableID:32:20" "$DARK" 1.0 0.40 0.45

# Info - Blue
set_color "VariableID:33:21" "$LIGHT" 0.25 0.55 0.95     # info - blue
set_color "VariableID:33:21" "$DARK" 0.35 0.65 1.0

echo ""
echo "============================================"
echo "✅ COLOR VALUES SET!"
echo "============================================"
