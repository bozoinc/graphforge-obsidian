# GraphForge -- Next-Level Feature Brainstorm

## High-Impact Features (Productivity Multipliers)

### 1. Smart Auto-Layout Engine
Instead of just force-directed, offer multiple layout algorithms:
- **Force-directed** (current) -- organic, physics-based
- **Hierarchical** -- tree-like, great for structured notes
- **Circular** -- nodes arranged in rings by connection count
- **Grid** -- clean, organized, easy to scan
- **Timeline** -- nodes arranged by creation date
- **Radial** -- selected node at center, connections radiating out

### 2. Note Preview on Hover
Hover over a node and see a popup with:
- Note content preview (first 200 chars)
- Tags, creation date, file size
- Number of backlinks
- Quick actions: open, copy link, mark as favorite

### 3. Path Finding
"Show me the path from Note A to Note B" -- highlights the shortest connection path between two nodes through intermediate notes. Great for discovering indirect relationships.

### 4. Graph Comparison
Compare two snapshots of your graph over time. See what nodes were added, removed, or changed connections. Visual diff for your knowledge base.

### 5. Focus Mode + Distraction-Free Writing
Click a node to enter focus mode:
- Dim all unrelated nodes
- Show only the note and its direct connections
- Open the note in a split pane
- Write while seeing your context

### 6. Keyboard Navigation
Full keyboard support:
- Arrow keys to move between nodes
- Enter to open selected node
- Tab to cycle through connections
- / to search
- Esc to reset view

### 7. Node Bookmarks & Pins
Pin important nodes so they always appear at the top of the graph. Bookmarked nodes get a special icon and are always visible regardless of filters.

### 8. Graph Snapshots
Save the current graph state (positions, filters, view mode) as a snapshot. Restore later. Great for "before/after" comparisons or saving different perspectives on the same data.

### 9. Import from Other Tools
Import graphs from:
- Roam Research (JSON export)
- Logseq (EDN/JSON)
- Notion (CSV)
- Zotero (BibTeX)
- Any markdown folder

### 10. Mobile-Optimized View
Simplified 3D view for mobile devices with:
- Touch-optimized controls
- Reduced node count for performance
- Gesture-based navigation

## Theme Ideas

### Galaxy Theme (Requested)
- Deep space background with stars
- Nodes as glowing orbs with nebula-like halos
- Connection lines as light trails
- Subtle particle effects (floating dust, distant stars)
- Color palette: deep purples, blues, cyans, whites
- Bloom effect intensified for "star glow"

### Additional Themes to Consider

**Minimalist**
- Clean white/gray background
- Simple circles for nodes
- Thin gray lines
- No bloom, no particles
- Focus on content, not visuals

**Cyberpunk**
- Dark background with neon grid
- Nodes in neon colors (pink, cyan, yellow)
- Glitch effects on hover
- Scanline overlay
- Retro-futuristic feel

**Paper/Warm**
- Warm beige/cream background
- Nodes as soft circles with paper texture
- Hand-drawn style connection lines
- Warm color palette
- Cozy, analog feel

**Ocean**
- Deep blue gradient background
- Nodes as bubbles with iridescent sheen
- Gentle wave-like animation
- Bioluminescent glow effects
- Calming, meditative feel

**Forest**
- Dark green background
- Nodes as glowing fireflies
- Connection lines as vines/roots
- Particle effects like floating leaves
- Natural, organic feel

## Priority Recommendation

Build these in order:
1. **Galaxy theme** -- Visual wow factor, easy to implement
2. **Note preview on hover** -- Huge productivity boost
3. **Multiple layout algorithms** -- Solves the "cluttered graph" problem
4. **Focus mode** -- Core workflow improvement
5. **Keyboard navigation** -- Power user essential
6. **Path Finding** -- Unique feature, great for demos
7. **Node bookmarks** -- Simple but high impact
8. **Graph snapshots** -- Useful for tracking progress
9. **Import from other tools** -- Expands addressable market
10. **Mobile view** -- Future-proofing
