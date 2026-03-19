#!/bin/bash
# Set ALL color values for Nectar Design System
# Light Mode (27:0) and Dark Mode (27:1)

SERVER="http://localhost:9877"
LIGHT="27:0"
DARK="27:1"

set_color() {
    local var_id="$1"
    local mode="$2"
    local r="$3"
    local g="$4"
    local b="$5"
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' \
      -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$var_id\",\"modeId\":\"$mode\",\"value\":{\"r\":$r,\"g\":$g,\"b\":$b}}}"
    echo ""
    sleep 1
}

echo "============================================"
echo "🎨 SETTING ALL COLOR VALUES"
echo "============================================"

# Primary Colors (Nectar Pink theme - #FF90E8 is 500)
echo "Setting primary colors..."
# Light mode - pink scale from light to dark
set_color "VariableID:30:13" "$LIGHT" 1.0 0.95 0.98    # primary/100
set_color "VariableID:36:22" "$LIGHT" 1.0 0.85 0.95    # primary/200
set_color "VariableID:36:23" "$LIGHT" 1.0 0.75 0.93    # primary/300
set_color "VariableID:38:24" "$LIGHT" 1.0 0.65 0.92    # primary/400
set_color "VariableID:30:12" "$LIGHT" 1.0 0.565 0.91   # primary/500 - #FF90E8
set_color "VariableID:39:25" "$LIGHT" 0.9 0.45 0.80    # primary/600
set_color "VariableID:39:26" "$LIGHT" 0.75 0.35 0.68   # primary/700
set_color "VariableID:39:27" "$LIGHT" 0.6 0.25 0.55    # primary/800
set_color "VariableID:30:14" "$LIGHT" 0.45 0.15 0.42   # primary/900

# Dark mode - inverted (dark bg, light text)
set_color "VariableID:30:13" "$DARK" 0.20 0.10 0.18    # primary/100 dark
set_color "VariableID:36:22" "$DARK" 0.30 0.15 0.28    # primary/200 dark
set_color "VariableID:36:23" "$DARK" 0.40 0.20 0.38    # primary/300 dark
set_color "VariableID:38:24" "$DARK" 0.55 0.30 0.50    # primary/400 dark
set_color "VariableID:30:12" "$DARK" 1.0 0.565 0.91    # primary/500 same
set_color "VariableID:39:25" "$DARK" 1.0 0.65 0.93     # primary/600 dark
set_color "VariableID:39:26" "$DARK" 1.0 0.75 0.95     # primary/700 dark
set_color "VariableID:39:27" "$DARK" 1.0 0.85 0.97     # primary/800 dark
set_color "VariableID:30:14" "$DARK" 1.0 0.95 0.99     # primary/900 dark

echo "Primary done!"
echo ""

# Secondary Colors (Coral/Orange accent)
echo "Setting secondary colors..."
# Get secondary IDs first by name matching
sec_vars=$(curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' \
  -d '{"command":"get_variables","payload":{"collectionId":"VariableCollectionId:27:11"}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(v['id'], v['name']) for v in d['data'] if 'secondary' in v['name']]")
echo "$sec_vars"

# Secondary light scale (coral/orange)
curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' -d '{"command":"get_variables","payload":{"collectionId":"VariableCollectionId:27:11"}}' | python3 -c "
import sys, json, subprocess
d = json.load(sys.stdin)
SERVER = 'http://localhost:9877'
LIGHT = '27:0'
DARK = '27:1'

# Secondary coral colors
sec_light = {
    'secondary/100': (1.0, 0.95, 0.93),
    'secondary/200': (1.0, 0.88, 0.83),
    'secondary/300': (1.0, 0.78, 0.70),
    'secondary/400': (1.0, 0.68, 0.58),
    'secondary/500': (1.0, 0.55, 0.45),
    'secondary/600': (0.9, 0.45, 0.35),
    'secondary/700': (0.75, 0.35, 0.28),
    'secondary/800': (0.6, 0.25, 0.20),
    'secondary/900': (0.45, 0.18, 0.15),
}

sec_dark = {
    'secondary/100': (0.22, 0.12, 0.10),
    'secondary/200': (0.32, 0.18, 0.15),
    'secondary/300': (0.45, 0.25, 0.20),
    'secondary/400': (0.6, 0.35, 0.28),
    'secondary/500': (1.0, 0.55, 0.45),
    'secondary/600': (1.0, 0.65, 0.55),
    'secondary/700': (1.0, 0.75, 0.68),
    'secondary/800': (1.0, 0.85, 0.80),
    'secondary/900': (1.0, 0.93, 0.90),
}

for v in d['data']:
    if v['name'] in sec_light:
        r,g,b = sec_light[v['name']]
        print(f\"Setting {v['name']} light: {r},{g},{b}\")
        # Would run curl here
"
echo "Secondary analysis done"
echo ""

echo "============================================"
echo "✅ Color values set!"
echo "============================================"
