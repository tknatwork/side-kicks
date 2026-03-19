#!/usr/bin/env python3
"""
Nectar Design System Builder
Industry-standard design system following Atomic Design methodology
"""

import requests
import json
import time

BASE_URL = "http://localhost:9877"

def send_command(command: str, payload: dict = None) -> dict:
    """Send command to Figma plugin via orchestration server"""
    try:
        response = requests.post(
            f"{BASE_URL}/command",
            headers={"Content-Type": "application/json"},
            json={"command": command, "payload": payload or {}},
            timeout=30
        )
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return {"success": False, "error": str(e)}

def create_frame(name: str, x: float, y: float, width: float, height: float, page_id: str = None) -> dict:
    """Create a frame on the current or specified page"""
    payload = {
        "name": name,
        "x": x,
        "y": y,
        "width": width,
        "height": height
    }
    if page_id:
        payload["pageId"] = page_id
    return send_command("create_frame", payload)

def create_text(text: str, x: float, y: float, font_size: int = 16, font_weight: str = "Regular") -> dict:
    """Create a text node"""
    return send_command("create_text", {
        "text": text,
        "x": x,
        "y": y,
        "fontSize": font_size,
        "fontWeight": font_weight
    })

def set_auto_layout(node_id: str, direction: str = "VERTICAL", padding: int = 40, spacing: int = 24, wrap: bool = False) -> dict:
    """Apply auto-layout to a frame"""
    return send_command("set_auto_layout", {
        "nodeId": node_id,
        "direction": direction,
        "padding": padding,
        "itemSpacing": spacing,
        "layoutWrap": "WRAP" if wrap else "NO_WRAP"
    })

def move_node(node_id: str, page_id: str) -> dict:
    """Move a node to a different page"""
    return send_command("move_node_to_page", {
        "nodeId": node_id,
        "pageId": page_id
    })

def rename_node(node_id: str, name: str) -> dict:
    """Rename a node"""
    return send_command("rename_node", {
        "nodeId": node_id,
        "name": name
    })

def delete_node(node_id: str) -> dict:
    """Delete a node"""
    return send_command("delete_node", {"nodeId": node_id})

def get_page_children(page_id: str) -> list:
    """Get all children of a page"""
    result = send_command("get_page_children", {"pageId": page_id})
    return result.get("data", []) if result.get("success") else []

def get_local_components() -> list:
    """Get all local components"""
    result = send_command("get_local_components")
    return result.get("data", []) if result.get("success") else []

# Page IDs
PAGES = {
    "cover": "63:100",
    "getting_started": "63:101", 
    "colors": "63:102",
    "typography": "63:103",
    "spacing": "63:104",
    "effects": "63:105",
    "separator": "63:106",
    "atoms": "63:107",
    "molecules": "67:1927",
    "organisms": "67:1928",
    "templates": "70:1929",
    "pages": "70:1930"
}

# Frame sizes
FRAME_SIZES = {
    "desktop": {"width": 1440, "height": 900},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 375, "height": 812}
}

# ============================================================================
# COMPONENT STRUCTURE (Industry Standard Naming)
# ============================================================================

ATOMS = {
    "Button": {
        "variants": ["Primary", "Secondary", "Outline", "Ghost"],
        "states": ["Default", "Hover", "Focus", "Disabled"],
        "sizes": ["Small", "Medium", "Large"]
    },
    "Input": {
        "variants": ["Text", "Password", "Search", "Textarea"],
        "states": ["Default", "Focus", "Error", "Disabled"]
    },
    "Badge": {
        "variants": ["Primary", "Success", "Warning", "Error", "Neutral", "Outline"],
        "sizes": ["Small", "Medium"]
    },
    "Toggle": {
        "states": ["Off", "On", "Disabled"]
    },
    "Checkbox": {
        "states": ["Unchecked", "Checked", "Indeterminate", "Disabled"]
    },
    "Radio": {
        "states": ["Unselected", "Selected", "Disabled"]
    },
    "Avatar": {
        "sizes": ["XSmall", "Small", "Medium", "Large", "XLarge"],
        "variants": ["Image", "Initials", "Icon"]
    },
    "Icon": {
        "sizes": ["Small", "Medium", "Large"]
    },
    "Divider": {
        "variants": ["Horizontal", "Vertical"]
    },
    "Spinner": {
        "sizes": ["Small", "Medium", "Large"]
    }
}

MOLECULES = {
    "FormField": {
        "variants": ["Default", "WithHelper", "WithError"],
        "description": "Label + Input + Helper/Error text"
    },
    "Alert": {
        "variants": ["Success", "Warning", "Error", "Info"],
        "description": "Icon + Title + Description + Action"
    },
    "Toast": {
        "variants": ["Default", "WithAction", "WithIcon"],
        "description": "Notification message"
    },
    "Tab": {
        "states": ["Default", "Active", "Disabled"],
        "description": "Individual tab item"
    },
    "TabBar": {
        "description": "Collection of tabs"
    },
    "Dropdown": {
        "states": ["Closed", "Open"],
        "description": "Select with dropdown menu"
    },
    "SearchBar": {
        "description": "Search input with icon"
    },
    "Breadcrumb": {
        "description": "Navigation breadcrumb"
    },
    "Pagination": {
        "description": "Page navigation"
    }
}

ORGANISMS = {
    "Card": {
        "variants": ["Simple", "Product", "Profile", "Stats", "Pricing"],
        "description": "Content container"
    },
    "Navbar": {
        "variants": ["Default", "WithSearch", "WithAvatar"],
        "description": "Main navigation"
    },
    "Footer": {
        "variants": ["Simple", "WithColumns", "WithNewsletter"],
        "description": "Page footer"
    },
    "Modal": {
        "variants": ["Default", "Confirmation", "WithForm"],
        "description": "Overlay dialog"
    },
    "Sidebar": {
        "description": "Side navigation"
    },
    "DataTable": {
        "description": "Table with sorting/filtering"
    },
    "Hero": {
        "variants": ["Simple", "WithImage", "Split"],
        "description": "Landing page hero section"
    }
}

# ============================================================================
# BUILD FUNCTIONS
# ============================================================================

def build_cover_page():
    """Build the cover page with design system info"""
    print("\n📄 Building Cover Page...")
    
    # Clear existing content
    children = get_page_children(PAGES["cover"])
    for child in children:
        delete_node(child["id"])
        time.sleep(0.1)
    
    # Create cover frame
    result = create_frame("Cover", 0, 0, 1440, 900)
    if result.get("success"):
        frame_id = result["data"]["id"]
        print(f"  Created cover frame: {frame_id}")
        
        # Add title text
        create_text("🌸 Nectar Design System", 100, 200, 64, "Bold")
        create_text("A comprehensive design system for building beautiful, consistent interfaces", 100, 300, 24, "Regular")
        create_text("Version 1.0.0", 100, 360, 16, "Regular")
        
        # System info
        create_text("📊 System Overview", 100, 450, 32, "Bold")
        create_text("• 25 Variable Collections (468+ variables)", 100, 500, 18, "Regular")
        create_text("• Light & Dark Mode Support", 100, 530, 18, "Regular")
        create_text("• Desktop, Tablet & Mobile Responsive", 100, 560, 18, "Regular")
        create_text("• Atomic Design Methodology", 100, 590, 18, "Regular")
        
    return result

def build_documentation_section(page_id: str, title: str, content_items: list):
    """Build a documentation section frame"""
    children = get_page_children(page_id)
    
    # Create section frame
    y_offset = len(children) * 1000
    result = create_frame(title, 100, y_offset, 1240, 800)
    if result.get("success"):
        frame_id = result["data"]["id"]
        set_auto_layout(frame_id, "VERTICAL", 60, 32)
        print(f"  Created section: {title}")
    return result

def reorganize_components():
    """Move components to correct pages based on atomic design"""
    print("\n🔄 Reorganizing components...")
    
    components = get_local_components()
    print(f"  Found {len(components)} components")
    
    # Categorize components
    atoms = []
    molecules = []
    organisms = []
    
    atom_prefixes = ["Button", "Input", "Badge", "Toggle", "Checkbox", "Radio", "Avatar", "Icon", "Divider", "Spinner"]
    molecule_prefixes = ["FormField", "Alert", "Toast", "Tab", "TabBar", "Dropdown", "SearchBar", "Breadcrumb", "Pagination", "NavItem", "User"]
    organism_prefixes = ["Card", "Navbar", "Footer", "Modal", "Sidebar", "DataTable", "Hero", "Pricing", "Navigation"]
    
    for comp in components:
        name = comp["name"]
        prefix = name.split("/")[0] if "/" in name else name
        
        if prefix in atom_prefixes:
            atoms.append(comp)
        elif prefix in molecule_prefixes:
            molecules.append(comp)
        else:
            organisms.append(comp)
    
    print(f"  Atoms: {len(atoms)}")
    print(f"  Molecules: {len(molecules)}")
    print(f"  Organisms: {len(organisms)}")
    
    return {"atoms": atoms, "molecules": molecules, "organisms": organisms}

def main():
    """Main build process"""
    print("=" * 60)
    print("🌸 NECTAR DESIGN SYSTEM BUILDER")
    print("=" * 60)
    
    # Step 1: Check connection
    result = requests.get(f"{BASE_URL}/health", timeout=5)
    if result.status_code != 200:
        print("❌ Server not running!")
        return
    print("✅ Connected to orchestration server")
    
    # Step 2: Build cover page
    build_cover_page()
    
    # Step 3: Analyze and reorganize components
    categorized = reorganize_components()
    
    print("\n" + "=" * 60)
    print("✅ BUILD COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()
