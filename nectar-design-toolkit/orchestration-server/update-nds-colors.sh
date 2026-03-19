#!/bin/bash
# ============================================================================
# Update NDS Brand Colors in the colors collection
# Updates existing color palettes with NDS brand values
# ============================================================================

SERVER="http://localhost:9877"

echo "============================================================================"
echo "🎨 UPDATING NDS BRAND COLORS IN COLORS COLLECTION"
echo "============================================================================"
echo ""

# Helper function to set variable value
set_color() {
    local name="$1"
    local light_r="$2"
    local light_g="$3"
    local light_b="$4"
    local dark_r="$5"
    local dark_g="$6"
    local dark_b="$7"
    
    echo "  Setting: $name"
    
    # Light mode
    curl -s --max-time 10 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"set_variable_value\",\"payload\":{\"collectionName\":\"colors\",\"variableName\":\"$name\",\"modeName\":\"Light\",\"value\":{\"r\":$light_r,\"g\":$light_g,\"b\":$light_b}}}" > /dev/null
    sleep 0.3
    
    # Dark mode
    curl -s --max-time 10 -X POST "$SERVER/command" \
        -H 'Content-Type: application/json' \
        -d "{\"command\":\"set_variable_value\",\"payload\":{\"collectionName\":\"colors\",\"variableName\":\"$name\",\"modeName\":\"Dark\",\"value\":{\"r\":$dark_r,\"g\":$dark_g,\"b\":$dark_b}}}" > /dev/null
    sleep 0.3
}

# ============================================================================
# MAGENTA -> PINK (NDS Primary)
# Updating magenta palette with our pink brand colors
# ============================================================================
echo ""
echo "🩷 Updating MAGENTA with NDS Pink colors..."

# Note: Ant Design uses 1-10 scale, NDS uses 100-900
# Mapping: 1=100, 2=200, 3=300, 4=400, 5=500, 6=600, 7=700, 8=800, 9=900, 10=darker

# Pink Light Mode (original values)
set_color "magenta/1" 1.0000 0.9412 0.9843  0.4784 0.1569 0.4078   # pink/100 -> pink/900
set_color "magenta/2" 1.0000 0.8824 0.9686  0.7020 0.2275 0.6000   # pink/200 -> pink/800  
set_color "magenta/3" 1.0000 0.7647 0.9373  0.8980 0.2980 0.7686   # pink/300 -> pink/700
set_color "magenta/4" 1.0000 0.6588 0.9059  1.0000 0.4314 0.8706   # pink/400 -> pink/600
set_color "magenta/5" 1.0000 0.5647 0.9098  1.0000 0.5647 0.9098   # pink/500 -> pink/500
set_color "magenta/6" 1.0000 0.4314 0.8706  1.0000 0.6588 0.9059   # pink/600 -> pink/400
set_color "magenta/7" 0.8980 0.2980 0.7686  1.0000 0.7647 0.9373   # pink/700 -> pink/300
set_color "magenta/8" 0.7020 0.2275 0.6000  1.0000 0.8824 0.9686   # pink/800 -> pink/200
set_color "magenta/9" 0.4784 0.1569 0.4078  1.0000 0.9412 0.9843   # pink/900 -> pink/100
set_color "magenta/10" 0.3200 0.1000 0.2700 1.0000 0.9700 0.9900   # darker/lighter

echo "✅ Magenta/Pink updated!"

# ============================================================================
# GEEKBLUE -> PURPLE (NDS Secondary/Info)
# ============================================================================
echo ""
echo "💜 Updating GEEKBLUE with NDS Purple colors..."

set_color "geekblue/1" 0.9412 0.9529 0.9922  0.1569 0.2235 0.4078
set_color "geekblue/2" 0.8824 0.9059 0.9843  0.2275 0.3216 0.6392
set_color "geekblue/3" 0.7647 0.8118 0.9686  0.2980 0.4196 0.8314
set_color "geekblue/4" 0.6588 0.7333 0.9529  0.4314 0.5451 0.8980
set_color "geekblue/5" 0.5647 0.6588 0.9294  0.5647 0.6588 0.9294
set_color "geekblue/6" 0.4314 0.5451 0.8980  0.6588 0.7333 0.9529
set_color "geekblue/7" 0.2980 0.4196 0.8314  0.7647 0.8118 0.9686
set_color "geekblue/8" 0.2275 0.3216 0.6392  0.8824 0.9059 0.9843
set_color "geekblue/9" 0.1569 0.2235 0.4078  0.9412 0.9529 0.9922
set_color "geekblue/10" 0.1000 0.1500 0.2700 0.9700 0.9800 0.9950

echo "✅ Geekblue/Purple updated!"

# ============================================================================
# CYAN -> GREEN (NDS Success/Tertiary)
# Using cyan slot for our teal/green
# ============================================================================
echo ""
echo "💚 Updating CYAN with NDS Green colors..."

set_color "cyan/1" 0.9020 0.9686 0.9608  0.0431 0.1882 0.1765
set_color "cyan/2" 0.7608 0.9216 0.9059  0.0667 0.2902 0.2706
set_color "cyan/3" 0.5216 0.8431 0.8118  0.0902 0.3961 0.3686
set_color "cyan/4" 0.2941 0.7647 0.7176  0.1137 0.5098 0.4706
set_color "cyan/5" 0.1373 0.6275 0.5804  0.1373 0.6275 0.5804
set_color "cyan/6" 0.1137 0.5098 0.4706  0.2941 0.7647 0.7176
set_color "cyan/7" 0.0902 0.3961 0.3686  0.5216 0.8431 0.8118
set_color "cyan/8" 0.0667 0.2902 0.2706  0.7608 0.9216 0.9059
set_color "cyan/9" 0.0431 0.1882 0.1765  0.9020 0.9686 0.9608
set_color "cyan/10" 0.0200 0.1200 0.1100 0.9500 0.9850 0.9800

echo "✅ Cyan/Green updated!"

# ============================================================================
# GOLD -> ORANGE (NDS Warning/Quaternary)
# ============================================================================
echo ""
echo "🧡 Updating GOLD with NDS Orange colors..."

set_color "gold/1" 1.0000 0.9804 0.8980  0.2000 0.1569 0.0000
set_color "gold/2" 1.0000 0.9529 0.7608  0.4000 0.3137 0.0000
set_color "gold/3" 1.0000 0.9098 0.5216  0.6000 0.4706 0.0000
set_color "gold/4" 1.0000 0.8706 0.2941  0.8000 0.6275 0.0000
set_color "gold/5" 1.0000 0.7882 0.0000  1.0000 0.7882 0.0000
set_color "gold/6" 0.8000 0.6275 0.0000  1.0000 0.8706 0.2941
set_color "gold/7" 0.6000 0.4706 0.0000  1.0000 0.9098 0.5216
set_color "gold/8" 0.4000 0.3137 0.0000  1.0000 0.9529 0.7608
set_color "gold/9" 0.2000 0.1569 0.0000  1.0000 0.9804 0.8980
set_color "gold/10" 0.1300 0.1000 0.0000 1.0000 0.9900 0.9400

echo "✅ Gold/Orange updated!"

# ============================================================================
# RED (NDS Error/Danger)
# ============================================================================
echo ""
echo "❤️ Updating RED with NDS Red colors..."

set_color "red/1" 0.9922 0.9098 0.8980  0.1725 0.0431 0.0235
set_color "red/2" 0.9843 0.8000 0.7725  0.3451 0.0824 0.0510
set_color "red/3" 0.9608 0.5843 0.5333  0.5176 0.1255 0.0745
set_color "red/4" 0.9373 0.3725 0.3020  0.6902 0.1647 0.0941
set_color "red/5" 0.8627 0.2039 0.1176  0.8627 0.2039 0.1176
set_color "red/6" 0.6902 0.1647 0.0941  0.9373 0.3725 0.3020
set_color "red/7" 0.5176 0.1255 0.0745  0.9608 0.5843 0.5333
set_color "red/8" 0.3451 0.0824 0.0510  0.9843 0.8000 0.7725
set_color "red/9" 0.1725 0.0431 0.0235  0.9922 0.9098 0.8980
set_color "red/10" 0.1100 0.0280 0.0150 0.9960 0.9500 0.9400

echo "✅ Red updated!"

# ============================================================================
# YELLOW (NDS Warning alt)
# ============================================================================
echo ""
echo "💛 Updating YELLOW with NDS Yellow colors..."

set_color "yellow/1" 0.9961 0.9882 0.9098  0.1882 0.1882 0.0353
set_color "yellow/2" 0.9961 0.9765 0.7647  0.3804 0.3804 0.0745
set_color "yellow/3" 0.9961 0.9412 0.5412  0.5686 0.5686 0.1098
set_color "yellow/4" 0.9922 0.8784 0.2784  0.7569 0.7608 0.1490
set_color "yellow/5" 0.9451 0.9529 0.2000  0.9451 0.9529 0.2000
set_color "yellow/6" 0.7569 0.7608 0.1490  0.9922 0.8784 0.2784
set_color "yellow/7" 0.5686 0.5686 0.1098  0.9961 0.9412 0.5412
set_color "yellow/8" 0.3804 0.3804 0.0745  0.9961 0.9765 0.7647
set_color "yellow/9" 0.1882 0.1882 0.0353  0.9961 0.9882 0.9098
set_color "yellow/10" 0.1200 0.1200 0.0200 0.9980 0.9940 0.9500

echo "✅ Yellow updated!"

# ============================================================================
# GRAY -> NEUTRAL (NDS Neutral)
# ============================================================================
echo ""
echo "⬜ Updating GRAY with NDS Neutral colors..."

# Neutral uses 0, 50, 100-900, 1000 - map to 1-10
# 1=0/white, 2=50, 3=100, 4=200, 5=300, 6=400, 7=500, 8=600, 9=700, 10=800/900

set_color "gray/1" 1.0000 1.0000 1.0000  0.0353 0.0353 0.0431   # neutral/0 -> neutral/1000
set_color "gray/2" 0.9804 0.9804 0.9804  0.0941 0.0941 0.1059   # neutral/50 -> neutral/900
set_color "gray/3" 0.9569 0.9569 0.9608  0.1529 0.1529 0.1647   # neutral/100 -> neutral/800
set_color "gray/4" 0.8941 0.8941 0.9059  0.2471 0.2471 0.2745   # neutral/200 -> neutral/700
set_color "gray/5" 0.8314 0.8314 0.8471  0.3216 0.3216 0.3569   # neutral/300 -> neutral/600
set_color "gray/6" 0.6314 0.6314 0.6667  0.4431 0.4431 0.4784   # neutral/400 -> neutral/500
set_color "gray/7" 0.4431 0.4431 0.4784  0.6314 0.6314 0.6667   # neutral/500 -> neutral/400
set_color "gray/8" 0.3216 0.3216 0.3569  0.8314 0.8314 0.8471   # neutral/600 -> neutral/300
set_color "gray/9" 0.2471 0.2471 0.2745  0.8941 0.8941 0.9059   # neutral/700 -> neutral/200
set_color "gray/10" 0.1529 0.1529 0.1647 0.9569 0.9569 0.9608   # neutral/800 -> neutral/100

echo "✅ Gray/Neutral updated!"

echo ""
echo "============================================================================"
echo "✅ ALL NDS BRAND COLORS UPDATED IN COLORS COLLECTION!"
echo "============================================================================"
echo ""
echo "Updated palettes:"
echo "  • magenta -> NDS Pink (Primary)"
echo "  • geekblue -> NDS Purple (Secondary/Info)"  
echo "  • cyan -> NDS Green (Success/Tertiary)"
echo "  • gold -> NDS Orange (Warning/Quaternary)"
echo "  • red -> NDS Red (Error/Danger)"
echo "  • yellow -> NDS Yellow (Warning alt)"
echo "  • gray -> NDS Neutral"
echo ""
