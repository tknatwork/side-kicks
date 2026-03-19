#!/usr/bin/env python3
"""
Set all color values for Nectar Design System
"""
import json
import requests
import time

SERVER = "http://localhost:9877"
LIGHT_MODE = "27:0"
DARK_MODE = "27:1"

# Load variable IDs
with open('/tmp/color_vars.json') as f:
    VAR_IDS = json.load(f)

# Nectar Pink Theme Color Palette
# Primary: Pink tones based on #FF90E8
# Secondary: Coral/Orange accent
# Neutral: Warm grays
# Semantic: Standard colors

COLORS = {
    # Primary Pink Scale (Light mode)
    "primary/100": {"light": (1.0, 0.94, 0.98), "dark": (0.25, 0.12, 0.22)},
    "primary/200": {"light": (1.0, 0.85, 0.95), "dark": (0.35, 0.18, 0.30)},
    "primary/300": {"light": (1.0, 0.75, 0.92), "dark": (0.50, 0.25, 0.42)},
    "primary/400": {"light": (1.0, 0.65, 0.90), "dark": (0.70, 0.35, 0.58)},
    "primary/500": {"light": (1.0, 0.565, 0.91), "dark": (1.0, 0.565, 0.91)},  # #FF90E8
    "primary/600": {"light": (0.90, 0.45, 0.80), "dark": (1.0, 0.65, 0.92)},
    "primary/700": {"light": (0.75, 0.35, 0.65), "dark": (1.0, 0.75, 0.94)},
    "primary/800": {"light": (0.55, 0.25, 0.48), "dark": (1.0, 0.85, 0.96)},
    "primary/900": {"light": (0.35, 0.15, 0.30), "dark": (1.0, 0.94, 0.98)},
    
    # Secondary Coral Scale
    "secondary/100": {"light": (1.0, 0.95, 0.93), "dark": (0.25, 0.15, 0.12)},
    "secondary/200": {"light": (1.0, 0.88, 0.85), "dark": (0.35, 0.22, 0.18)},
    "secondary/300": {"light": (1.0, 0.78, 0.72), "dark": (0.50, 0.32, 0.28)},
    "secondary/400": {"light": (1.0, 0.68, 0.58), "dark": (0.70, 0.45, 0.38)},
    "secondary/500": {"light": (1.0, 0.55, 0.45), "dark": (1.0, 0.55, 0.45)},  # Coral
    "secondary/600": {"light": (0.90, 0.45, 0.35), "dark": (1.0, 0.65, 0.55)},
    "secondary/700": {"light": (0.75, 0.35, 0.28), "dark": (1.0, 0.75, 0.68)},
    "secondary/800": {"light": (0.55, 0.25, 0.20), "dark": (1.0, 0.85, 0.80)},
    "secondary/900": {"light": (0.35, 0.15, 0.12), "dark": (1.0, 0.95, 0.92)},
    
    # Neutral Warm Gray Scale
    "neutral/100": {"light": (0.98, 0.98, 0.97), "dark": (0.10, 0.10, 0.12)},
    "neutral/200": {"light": (0.94, 0.94, 0.92), "dark": (0.15, 0.15, 0.17)},
    "neutral/300": {"light": (0.88, 0.88, 0.85), "dark": (0.22, 0.22, 0.25)},
    "neutral/400": {"light": (0.75, 0.75, 0.72), "dark": (0.35, 0.35, 0.38)},
    "neutral/500": {"light": (0.60, 0.60, 0.58), "dark": (0.50, 0.50, 0.52)},
    "neutral/600": {"light": (0.45, 0.45, 0.43), "dark": (0.65, 0.65, 0.68)},
    "neutral/700": {"light": (0.32, 0.32, 0.30), "dark": (0.78, 0.78, 0.80)},
    "neutral/800": {"light": (0.20, 0.20, 0.18), "dark": (0.88, 0.88, 0.90)},
    "neutral/900": {"light": (0.10, 0.10, 0.12), "dark": (0.98, 0.98, 0.97)},
    
    # Success Green Scale
    "success/100": {"light": (0.92, 0.98, 0.94), "dark": (0.08, 0.18, 0.10)},
    "success/200": {"light": (0.82, 0.95, 0.86), "dark": (0.12, 0.25, 0.15)},
    "success/300": {"light": (0.65, 0.90, 0.72), "dark": (0.18, 0.38, 0.22)},
    "success/400": {"light": (0.45, 0.85, 0.55), "dark": (0.25, 0.55, 0.32)},
    "success/500": {"light": (0.22, 0.78, 0.45), "dark": (0.30, 0.85, 0.52)},
    "success/600": {"light": (0.18, 0.65, 0.38), "dark": (0.45, 0.88, 0.58)},
    "success/700": {"light": (0.15, 0.52, 0.30), "dark": (0.60, 0.92, 0.68)},
    "success/800": {"light": (0.10, 0.38, 0.22), "dark": (0.75, 0.95, 0.80)},
    "success/900": {"light": (0.08, 0.25, 0.15), "dark": (0.88, 0.98, 0.90)},
    
    # Warning Amber Scale
    "warning/100": {"light": (1.0, 0.98, 0.90), "dark": (0.25, 0.20, 0.05)},
    "warning/200": {"light": (1.0, 0.95, 0.78), "dark": (0.35, 0.28, 0.08)},
    "warning/300": {"light": (1.0, 0.90, 0.60), "dark": (0.50, 0.40, 0.12)},
    "warning/400": {"light": (1.0, 0.82, 0.35), "dark": (0.70, 0.55, 0.18)},
    "warning/500": {"light": (1.0, 0.75, 0.0), "dark": (1.0, 0.80, 0.20)},
    "warning/600": {"light": (0.90, 0.65, 0.0), "dark": (1.0, 0.85, 0.40)},
    "warning/700": {"light": (0.75, 0.52, 0.0), "dark": (1.0, 0.90, 0.58)},
    "warning/800": {"light": (0.55, 0.38, 0.0), "dark": (1.0, 0.95, 0.75)},
    "warning/900": {"light": (0.35, 0.25, 0.0), "dark": (1.0, 0.98, 0.88)},
    
    # Error Red Scale
    "error/100": {"light": (1.0, 0.94, 0.94), "dark": (0.25, 0.10, 0.10)},
    "error/200": {"light": (1.0, 0.85, 0.85), "dark": (0.38, 0.15, 0.15)},
    "error/300": {"light": (1.0, 0.72, 0.72), "dark": (0.55, 0.22, 0.22)},
    "error/400": {"light": (0.98, 0.55, 0.55), "dark": (0.75, 0.30, 0.30)},
    "error/500": {"light": (0.95, 0.30, 0.35), "dark": (1.0, 0.40, 0.45)},
    "error/600": {"light": (0.85, 0.22, 0.28), "dark": (1.0, 0.55, 0.58)},
    "error/700": {"light": (0.70, 0.15, 0.20), "dark": (1.0, 0.70, 0.72)},
    
    # Info Blue Scale
    "info/500": {"light": (0.25, 0.55, 0.95), "dark": (0.35, 0.65, 1.0)},
}

def set_color(var_name, mode_id, rgb):
    """Set a color variable value"""
    var_id = VAR_IDS.get(var_name)
    if not var_id:
        print(f"  ⚠️  Variable not found: {var_name}")
        return False
    
    payload = {
        "command": "set_variable_value",
        "payload": {
            "variableId": var_id,
            "modeId": mode_id,
            "value": {"r": rgb[0], "g": rgb[1], "b": rgb[2]}
        }
    }
    
    try:
        resp = requests.post(f"{SERVER}/command", json=payload, timeout=30)
        data = resp.json()
        if data.get("success"):
            return True
        else:
            print(f"  ❌ Failed: {data.get('error')}")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    print("🎨 Setting Nectar Design System Colors")
    print("=" * 50)
    
    success_count = 0
    total_count = 0
    
    for var_name, colors in COLORS.items():
        # Light mode
        print(f"Setting {var_name} (Light)...", end=" ")
        if set_color(var_name, LIGHT_MODE, colors["light"]):
            print("✅")
            success_count += 1
        total_count += 1
        time.sleep(0.5)  # Rate limiting
        
        # Dark mode
        print(f"Setting {var_name} (Dark)...", end=" ")
        if set_color(var_name, DARK_MODE, colors["dark"]):
            print("✅")
            success_count += 1
        total_count += 1
        time.sleep(0.5)
    
    print("=" * 50)
    print(f"✅ Completed: {success_count}/{total_count} values set")

if __name__ == "__main__":
    main()
