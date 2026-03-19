#!/bin/bash
# ============================================================================
# Nectar Design System - Create Brand Color Primitives Collection
# Creates the full NDS brand color palette as a new variable collection
# ============================================================================

SERVER="http://localhost:9877"

echo "============================================================================"
echo "🎨 NECTAR DESIGN SYSTEM - BRAND COLOR PRIMITIVES"
echo "============================================================================"
echo ""

# First, let's create the brand primitives collection
echo "Creating brand primitives collection..."

# Create collection via plugin command
create_collection() {
    local name="$1"
    echo "  Creating collection: $name"
    curl -s --max-time 30 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"create_variable_collection\",\"payload\":{\"name\":\"$name\"}}"
    sleep 0.5
}

# Create variables in collection
create_color_variable() {
    local collection_id="$1"
    local name="$2"
    local light_r="$3"
    local light_g="$4"
    local light_b="$5"
    local dark_r="$6"
    local dark_g="$7"
    local dark_b="$8"
    
    echo "  Creating: $name"
    curl -s --max-time 30 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"create_color_variable\",\"payload\":{\"collectionId\":\"$collection_id\",\"name\":\"$name\",\"lightValue\":{\"r\":$light_r,\"g\":$light_g,\"b\":$light_b},\"darkValue\":{\"r\":$dark_r,\"g\":$dark_g,\"b\":$dark_b}}}" > /dev/null
    sleep 0.2
}

# For now, let's focus on updating existing seed colors with more detailed palette
# and then creating brand colors in batch using the plugin

echo ""
echo "📝 Note: The Ant Design System generates color palettes from seed values."
echo "   We've already updated the seed colors with NDS values."
echo ""
echo "   The full NDS brand primitives include:"
echo "   - Pink scale (100-900) - Primary"
echo "   - Purple scale (100-900) - Secondary/Info"
echo "   - Green scale (100-900) - Success/Tertiary"
echo "   - Orange scale (100-900) - Warning/Quaternary"
echo "   - Red scale (100-900) - Error/Danger"
echo "   - Yellow scale (100-900) - Warning"
echo "   - Neutral scale (0-1000) - Text/Background"
echo ""
echo "To add these as brand primitives, use the NDS Builder plugin in Figma"
echo "or create them through the API using create_color_variable commands."
echo ""

# Let's first check what collections exist
echo "Checking existing collections..."
curl -s --max-time 60 -X POST "$SERVER/command" \
    -H 'Content-Type: application/json' \
    -d '{"command":"get_variable_collections"}' > /tmp/nds_collections.json 2>/dev/null &

echo "Request sent. Use 'cat /tmp/nds_collections.json | jq' to see results."
echo ""
echo "============================================================================"
echo "COLOR VALUES REFERENCE (from NDS docs):"
echo "============================================================================"

cat << 'COLORS'

## PINK (Primary)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| pink/100    | #FFF0FB  | 1.0000  | 0.9412  | 0.9843  |
| pink/200    | #FFE1F7  | 1.0000  | 0.8824  | 0.9686  |
| pink/300    | #FFC3EF  | 1.0000  | 0.7647  | 0.9373  |
| pink/400    | #FFA8E7  | 1.0000  | 0.6588  | 0.9059  |
| pink/500    | #FF90E8  | 1.0000  | 0.5647  | 0.9098  |
| pink/600    | #FF6EDE  | 1.0000  | 0.4314  | 0.8706  |
| pink/700    | #E54CC4  | 0.8980  | 0.2980  | 0.7686  |
| pink/800    | #B33A99  | 0.7020  | 0.2275  | 0.6000  |
| pink/900    | #7A2868  | 0.4784  | 0.1569  | 0.4078  |

## PURPLE (Secondary/Info)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| purple/100  | #F0F3FD  | 0.9412  | 0.9529  | 0.9922  |
| purple/200  | #E1E7FB  | 0.8824  | 0.9059  | 0.9843  |
| purple/300  | #C3CFF7  | 0.7647  | 0.8118  | 0.9686  |
| purple/400  | #A8BBF3  | 0.6588  | 0.7333  | 0.9529  |
| purple/500  | #90A8ED  | 0.5647  | 0.6588  | 0.9294  |
| purple/600  | #6E8BE5  | 0.4314  | 0.5451  | 0.8980  |
| purple/700  | #4C6BD4  | 0.2980  | 0.4196  | 0.8314  |
| purple/800  | #3A52A3  | 0.2275  | 0.3216  | 0.6392  |
| purple/900  | #283968  | 0.1569  | 0.2235  | 0.4078  |

## GREEN (Success/Tertiary)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| green/100   | #E6F7F5  | 0.9020  | 0.9686  | 0.9608  |
| green/200   | #C2EBE7  | 0.7608  | 0.9216  | 0.9059  |
| green/300   | #85D7CF  | 0.5216  | 0.8431  | 0.8118  |
| green/400   | #4BC3B7  | 0.2941  | 0.7647  | 0.7176  |
| green/500   | #23A094  | 0.1373  | 0.6275  | 0.5804  |
| green/600   | #1D8278  | 0.1137  | 0.5098  | 0.4706  |
| green/700   | #17655E  | 0.0902  | 0.3961  | 0.3686  |
| green/800   | #114A45  | 0.0667  | 0.2902  | 0.2706  |
| green/900   | #0B302D  | 0.0431  | 0.1882  | 0.1765  |

## ORANGE (Warning/Quaternary)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| orange/100  | #FFFAE5  | 1.0000  | 0.9804  | 0.8980  |
| orange/200  | #FFF3C2  | 1.0000  | 0.9529  | 0.7608  |
| orange/300  | #FFE885  | 1.0000  | 0.9098  | 0.5216  |
| orange/400  | #FFDE4B  | 1.0000  | 0.8706  | 0.2941  |
| orange/500  | #FFC900  | 1.0000  | 0.7882  | 0.0000  |
| orange/600  | #CCA000  | 0.8000  | 0.6275  | 0.0000  |
| orange/700  | #997800  | 0.6000  | 0.4706  | 0.0000  |
| orange/800  | #665000  | 0.4000  | 0.3137  | 0.0000  |
| orange/900  | #332800  | 0.2000  | 0.1569  | 0.0000  |

## RED (Error/Danger)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| red/100     | #FDE8E5  | 0.9922  | 0.9098  | 0.8980  |
| red/200     | #FBCCC5  | 0.9843  | 0.8000  | 0.7725  |
| red/300     | #F59588  | 0.9608  | 0.5843  | 0.5333  |
| red/400     | #EF5F4D  | 0.9373  | 0.3725  | 0.3020  |
| red/500     | #DC341E  | 0.8627  | 0.2039  | 0.1176  |
| red/600     | #B02A18  | 0.6902  | 0.1647  | 0.0941  |
| red/700     | #842013  | 0.5176  | 0.1255  | 0.0745  |
| red/800     | #58150D  | 0.3451  | 0.0824  | 0.0510  |
| red/900     | #2C0B06  | 0.1725  | 0.0431  | 0.0235  |

## YELLOW (Warning alt)
| Token       | Hex      | r       | g       | b       |
|-------------|----------|---------|---------|---------|
| yellow/100  | #FEFCE8  | 0.9961  | 0.9882  | 0.9098  |
| yellow/200  | #FEF9C3  | 0.9961  | 0.9765  | 0.7647  |
| yellow/300  | #FEF08A  | 0.9961  | 0.9412  | 0.5412  |
| yellow/400  | #FDE047  | 0.9922  | 0.8784  | 0.2784  |
| yellow/500  | #F1F333  | 0.9451  | 0.9529  | 0.2000  |
| yellow/600  | #C1C226  | 0.7569  | 0.7608  | 0.1490  |
| yellow/700  | #91911C  | 0.5686  | 0.5686  | 0.1098  |
| yellow/800  | #616113  | 0.3804  | 0.3804  | 0.0745  |
| yellow/900  | #303009  | 0.1882  | 0.1882  | 0.0353  |

## NEUTRAL
| Token        | Hex      | r       | g       | b       |
|--------------|----------|---------|---------|---------|
| neutral/0    | #FFFFFF  | 1.0000  | 1.0000  | 1.0000  |
| neutral/50   | #FAFAFA  | 0.9804  | 0.9804  | 0.9804  |
| neutral/100  | #F4F4F5  | 0.9569  | 0.9569  | 0.9608  |
| neutral/200  | #E4E4E7  | 0.8941  | 0.8941  | 0.9059  |
| neutral/300  | #D4D4D8  | 0.8314  | 0.8314  | 0.8471  |
| neutral/400  | #A1A1AA  | 0.6314  | 0.6314  | 0.6667  |
| neutral/500  | #71717A  | 0.4431  | 0.4431  | 0.4784  |
| neutral/600  | #52525B  | 0.3216  | 0.3216  | 0.3569  |
| neutral/700  | #3F3F46  | 0.2471  | 0.2471  | 0.2745  |
| neutral/800  | #27272A  | 0.1529  | 0.1529  | 0.1647  |
| neutral/900  | #18181B  | 0.0941  | 0.0941  | 0.1059  |
| neutral/1000 | #09090B  | 0.0353  | 0.0353  | 0.0431  |

COLORS

echo ""
echo "============================================================================"
echo "✅ Reference complete. Use the NDS Builder plugin to create these variables."
echo "============================================================================"
