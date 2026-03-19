#!/bin/bash
# Nectar Design System - Batch Creation Script
# This script creates all variables in the design system

SERVER="http://localhost:9877"
COLLECTION="VariableCollectionId:27:11"

# Function to send command
send_cmd() {
    local cmd="$1"
    local payload="$2"
    echo ">>> $cmd"
    result=$(curl -s --max-time 90 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"$cmd\",\"payload\":$payload}")
    echo "$result"
    echo ""
    sleep 1
}

echo "============================================"
echo "🍯 NECTAR DESIGN SYSTEM - BATCH CREATION"
echo "============================================"
echo ""

# Check connection
echo "Checking connection..."
status=$(curl -s "$SERVER/status" | grep -o '"connected":[^,]*')
echo "Status: $status"
if [[ "$status" != *"true"* ]]; then
    echo "ERROR: Plugin not connected! Please restart the Figma plugin."
    exit 1
fi
echo ""

# ============================================
# COLOR VARIABLES (Creating missing shades)
# ============================================
echo "=== Creating Color Variables ==="

# Primary shades (200, 300, 400, 600, 700, 800 needed)
for shade in 300 400 600 700 800; do
    send_cmd "create_variable" "{\"collectionId\":\"$COLLECTION\",\"name\":\"primary/$shade\",\"resolvedType\":\"COLOR\"}"
done

# Secondary shades
for shade in 100 200 300 400 600 700 800 900; do
    send_cmd "create_variable" "{\"collectionId\":\"$COLLECTION\",\"name\":\"secondary/$shade\",\"resolvedType\":\"COLOR\"}"
done

# Neutral shades (100, 900 exist)
for shade in 200 300 400 500 600 700 800; do
    send_cmd "create_variable" "{\"collectionId\":\"$COLLECTION\",\"name\":\"neutral/$shade\",\"resolvedType\":\"COLOR\"}"
done

# Semantic colors - additional shades
for color in success warning error info; do
    for shade in 100 200 300 400 600 700 800 900; do
        send_cmd "create_variable" "{\"collectionId\":\"$COLLECTION\",\"name\":\"$color/$shade\",\"resolvedType\":\"COLOR\"}"
    done
done

# Surface colors
for name in background surface surface-variant on-surface on-surface-variant outline; do
    send_cmd "create_variable" "{\"collectionId\":\"$COLLECTION\",\"name\":\"surface/$name\",\"resolvedType\":\"COLOR\"}"
done

echo ""
echo "=== Color variables creation complete ==="
echo ""

# ============================================
# TYPOGRAPHY COLLECTION
# ============================================
echo "=== Creating Typography Collection ==="
typo_result=$(curl -s --max-time 90 -X POST "$SERVER/command" \
    -H 'Content-Type: application/json' \
    -d '{"command":"create_variable_collection","payload":{"name":"Typography","modes":["Desktop","Mobile"]}}')
echo "$typo_result"

# Extract typography collection ID
TYPO_COLLECTION=$(echo "$typo_result" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Typography Collection ID: $TYPO_COLLECTION"

if [[ -n "$TYPO_COLLECTION" ]]; then
    # Font sizes
    for size in xs sm base md lg xl 2xl 3xl 4xl 5xl; do
        send_cmd "create_variable" "{\"collectionId\":\"$TYPO_COLLECTION\",\"name\":\"font-size/$size\",\"resolvedType\":\"FLOAT\"}"
    done

    # Line heights
    for lh in none tight snug normal relaxed loose; do
        send_cmd "create_variable" "{\"collectionId\":\"$TYPO_COLLECTION\",\"name\":\"line-height/$lh\",\"resolvedType\":\"FLOAT\"}"
    done

    # Letter spacing
    for ls in tighter tight normal wide wider widest; do
        send_cmd "create_variable" "{\"collectionId\":\"$TYPO_COLLECTION\",\"name\":\"letter-spacing/$ls\",\"resolvedType\":\"FLOAT\"}"
    done

    # Font weights
    for weight in thin extralight light normal medium semibold bold extrabold black; do
        send_cmd "create_variable" "{\"collectionId\":\"$TYPO_COLLECTION\",\"name\":\"font-weight/$weight\",\"resolvedType\":\"FLOAT\"}"
    done
fi

echo ""
echo "=== Typography variables creation complete ==="
echo ""

# ============================================
# SPACING COLLECTION
# ============================================
echo "=== Creating Spacing Collection ==="
spacing_result=$(curl -s --max-time 90 -X POST "$SERVER/command" \
    -H 'Content-Type: application/json' \
    -d '{"command":"create_variable_collection","payload":{"name":"Spacing","modes":["Desktop","Mobile"]}}')
echo "$spacing_result"

# Extract spacing collection ID
SPACING_COLLECTION=$(echo "$spacing_result" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Spacing Collection ID: $SPACING_COLLECTION"

if [[ -n "$SPACING_COLLECTION" ]]; then
    # Spacing scale
    for space in 0 px 0.5 1 1.5 2 2.5 3 3.5 4 5 6 7 8 9 10 11 12 14 16 20 24 28 32 36 40 44 48 52 56 60 64 72 80 96; do
        send_cmd "create_variable" "{\"collectionId\":\"$SPACING_COLLECTION\",\"name\":\"space/$space\",\"resolvedType\":\"FLOAT\"}"
    done

    # Border radius
    for radius in none sm base md lg xl 2xl 3xl full; do
        send_cmd "create_variable" "{\"collectionId\":\"$SPACING_COLLECTION\",\"name\":\"radius/$radius\",\"resolvedType\":\"FLOAT\"}"
    done

    # Border width
    for width in 0 1 2 4 8; do
        send_cmd "create_variable" "{\"collectionId\":\"$SPACING_COLLECTION\",\"name\":\"border/$width\",\"resolvedType\":\"FLOAT\"}"
    done
fi

echo ""
echo "=== Spacing variables creation complete ==="
echo ""

echo "============================================"
echo "✅ DESIGN SYSTEM STRUCTURE CREATED!"
echo "============================================"
