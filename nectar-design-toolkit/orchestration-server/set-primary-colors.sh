#!/bin/bash
SERVER="http://localhost:9877"

set_color() {
    local varId=$1
    local modeId=$2
    local r=$3
    local g=$4
    local b=$5
    echo "Setting $varId mode=$modeId to r=$r g=$g b=$b"
    curl -s -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$varId\",\"modeId\":\"$modeId\",\"value\":{\"r\":$r,\"g\":$g,\"b\":$b}}}"
    echo ""
    sleep 1
}

LIGHT="27:0"
DARK="27:1"

echo "===== SETTING PRIMARY COLORS - LIGHT MODE ====="
set_color "VariableID:30:13" "$LIGHT" 1.0 0.95 0.98   # primary/100
set_color "VariableID:36:22" "$LIGHT" 1.0 0.85 0.95   # primary/200
set_color "VariableID:36:23" "$LIGHT" 1.0 0.75 0.93   # primary/300
set_color "VariableID:38:24" "$LIGHT" 1.0 0.65 0.92   # primary/400
set_color "VariableID:30:12" "$LIGHT" 1.0 0.565 0.91  # primary/500
set_color "VariableID:39:25" "$LIGHT" 0.9 0.45 0.80   # primary/600
set_color "VariableID:39:26" "$LIGHT" 0.75 0.35 0.68  # primary/700
set_color "VariableID:39:27" "$LIGHT" 0.6 0.25 0.55   # primary/800
set_color "VariableID:30:14" "$LIGHT" 0.45 0.15 0.42  # primary/900

echo ""
echo "===== SETTING PRIMARY COLORS - DARK MODE ====="
set_color "VariableID:30:13" "$DARK" 0.45 0.15 0.42   # primary/100 (inverted)
set_color "VariableID:36:22" "$DARK" 0.6 0.25 0.55    # primary/200
set_color "VariableID:36:23" "$DARK" 0.75 0.35 0.68   # primary/300
set_color "VariableID:38:24" "$DARK" 0.9 0.45 0.80    # primary/400
set_color "VariableID:30:12" "$DARK" 1.0 0.565 0.91   # primary/500 (same)
set_color "VariableID:39:25" "$DARK" 1.0 0.65 0.92    # primary/600
set_color "VariableID:39:26" "$DARK" 1.0 0.75 0.93    # primary/700
set_color "VariableID:39:27" "$DARK" 1.0 0.85 0.95    # primary/800
set_color "VariableID:30:14" "$DARK" 1.0 0.95 0.98    # primary/900 (inverted)

echo ""
echo "Primary colors done!"
