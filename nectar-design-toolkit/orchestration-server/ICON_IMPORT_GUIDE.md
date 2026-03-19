# 🎯 Icon Import Guide

## Quick Summary
We need to import 76 icons (38 × 2 variants) from your "Central Icon System" Figma file into the NDS file.

---

## Step 1: Get Your Figma Token (One-time setup)

1. **Open this link in your browser:**
   👉 https://www.figma.com/developers/api#access-tokens

2. **Create a new token:**
   - Scroll down to "Personal access tokens"
   - Enter a description like "NDS Icon Import"
   - Click **"Generate token"**
   - **COPY THE TOKEN** (it only shows once!)

3. **Save it to your shell profile:**
   ```bash
   echo 'export FIGMA_TOKEN="YOUR_TOKEN_HERE"' >> ~/.zshrc
   source ~/.zshrc
   ```

---

## Step 2: Run the Import

Once your token is set, run these commands:

```bash
cd "/Users/tusharkant/Github Project/design-docs/My Portfolio/AI_TOOLING/orchestration-server"

# Extract SVGs from Figma
node import-icons.js extract

# Create icons in NDS (make sure plugin is running!)
node import-icons.js create
```

Or do everything at once:
```bash
node import-icons.js all
```

---

## Alternative: Quick One-liner

If you don't want to save the token permanently, just run:

```bash
FIGMA_TOKEN="paste-your-token-here" node import-icons.js all
```

---

## What This Does

1. **Downloads 76 SVG files** from your Central Icon System
2. **Saves them** to the `icons/` folder
3. **Creates components** in your NDS Figma file
4. **Binds colors** to the `icon/default` variable

---

## Need Help?

If you share your Figma token in the chat, I can run the commands for you!
