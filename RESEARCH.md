---
type: research
tags: [graphforge, research, obsidian-api, juggl]
updated: 2026-06-22
---

# GraphForge Research: Obsidian Plugin API + Juggl Analysis

## Juggl Architecture (Key Findings)

### Rendering: Cytoscape.js (2D, NOT 3D)
- Juggl uses **Cytoscape.js** (^3.26.0) -- a 2D graph visualization library
- NOT Three.js, NOT WebGL, NOT 3D
- This is the critical finding: Juggl is an advanced 2D graph, not 3D
- **Implication for GraphForge:** To build a TRUE 3D graph, we need Three.js or WebGL on top of Obsidian's canvas

### Cytoscape Extensions Used
- `cytoscape-cola` -- force-directed layout
- `cytoscape-d3-force` -- D3 force simulation
- `cytoscape-dagre` -- hierarchical tree layout
- `cytoscape-avsdf` -- circular layout
- `cytoscape-navigator` -- minimap
- `cytoscape-popper` -- hover popovers
- `cytoscape-cxtmenu` -- context menus
- `cytoscape-dblclick` -- double-click events

### How Juggl Creates Graph Views
1. **ItemView** (`JugglView`) -- extends Obsidian's `ItemView`, registered as custom view type
2. **Markdown Code Block** -- `juggl` code block processor for inline graphs
3. **Side Panes** -- `JugglNodesPane` and `JugglStylePane` (Svelte-based)

### Plugin Structure
- **Language:** TypeScript
- **UI Framework:** Svelte
- **Build:** Rollup → single `main.js` bundle
- **Entry:** `src/main.ts` (JugglPlugin extends Plugin)
- **Manifest:** `manifest.json` (id: juggl, min Obsidian 1.4.16)

### Node Styling System
- Cytoscape CSS-like stylesheet system
- 5-layer composition: default → global groups → custom CSS → local groups → YAML overrides
- Node size mapped to degree (connection count): `mapData(degree, 0, 60, 5, 35)`
- 13 node shapes supported
- Custom CSS from `.obsidian/plugins/juggl/graph.css`

### Layout Algorithms (6 total)
1. Cola (continuous force-directed)
2. D3 Force (configurable alpha, velocity, link distance)
3. Dagre (hierarchical)
4. AVSDF (circular)
5. Grid
6. Concentric (rings by importance)

### Key Obsidian APIs Used by Juggl
| API | Purpose |
|-----|---------|
| `Plugin` (extends) | Base plugin class |
| `ItemView` (extends) | Custom graph views |
| `WorkspaceLeaf` | Split panes, view management |
| `Workspace` | Layout ready, leaf tracking, events |
| `Vault` | File CRUD, content reading, events |
| `MetadataCache` | Link resolution, frontmatter, file cache |
| `TFile` | File abstraction |
| `MarkdownRenderer.renderMarkdown()` | Hover popover content |
| `parseYaml()` | Code block and frontmatter parsing |
| `Menu` | Context menus |
| `Component` | Lifecycle management |
| `Events` / `EventRef` | Custom event system |
| `addCommand()` | Plugin commands |
| `addSettingTab()` | Settings UI |
| `registerView()` | Custom view type registration |
| `registerMarkdownCodeBlockProcessor()` | Code block rendering |
| `registerHoverLinkSource()` | Hover integration |
| `addRibbonIcon()` | Ribbon icon |
| `FileSystemAdapter` | Custom CSS file I/O |
| `debounce()` | Layout debouncing |

## Obsidian Plugin API (Research Findings)

### Creating Custom Views
```typescript
// 1. Extend ItemView
class MyView extends ItemView {
    getViewType(): string { return "my-view"; }
    getDisplayText(): string { return "My View"; }
    
    async onOpen() {
        // Create DOM elements in this.containerEl.children[1]
        const container = this.containerEl.children[1];
        container.empty();
        // ... build your view
    }
    
    async onClose() {
        // Cleanup
    }
}

// 2. Register in plugin
this.registerView("my-view", (leaf) => new MyView(leaf));

// 3. Open programmatically
const leaf = this.app.workspace.getRightLeaf(false);
await leaf.setViewState({ type: "my-view", active: true });
```

### Reading Note Links and Tags
```typescript
// Get all links from a file
const cache = this.app.metadataCache.getFileCache(file);
const links = cache?.links || [];
const frontmatterTags = cache?.frontmatter?.tags || [];
const tags = cache?.tags || [];

// Get all files linking TO a file
const backlinks = this.app.metadataCache.resolvedLinks[file.path];

// Get all files
const allFiles = this.app.vault.getFiles();

// Read file content
const content = await this.app.vault.cachedRead(file);

// Parse frontmatter
const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
```

### Plugin Manifest Structure
```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "minAppVersion": "1.4.16",
    "description": "Description",
    "author": "Author",
    "authorUrl": "https://...",
    "fundingUrl": "https://...",
    "isDesktopOnly": false
}
```

### Performance Considerations
- Obsidian's `MetadataCache` is the fast way to get links (not parsing markdown)
- `cachedRead()` is faster than `read()` for content
- Debounce expensive operations (layout, rendering)
- Use `requestAnimationFrame` for smooth animations
- Limit DOM updates -- batch changes
- For 500+ nodes: use Canvas or WebGL, not DOM elements

## GraphForge Technical Approach

### For TRUE 3D (differentiating from Juggl)
Juggl is 2D only. For GraphForge to be truly 3D:

**Option A: Three.js in Obsidian ItemView**
- Create an ItemView with a `<canvas>` element
- Initialize Three.js renderer on the canvas
- Map Obsidian notes to 3D nodes (spheres, cubes)
- Use Obsidian's MetadataCache for link data
- Camera controls: OrbitControls for mouse/touch
- Raycasting for node selection

**Option B: WebGL directly**
- More control, lighter weight than Three.js
- Custom shaders for effects
- Steeper learning curve

**Option C: Extend Juggl**
- Fork Juggl and add a 3D rendering mode
- Reuse its Obsidian integration (proven)
- Add Three.js layer on top of Cytoscape data model
- Risk: Cytoscape is fundamentally 2D, may not map well to 3D

### Recommended Stack
- **Language:** TypeScript (Obsidian standard)
- **3D Rendering:** Three.js (most documentation, largest community)
- **UI:** Svelte (what Obsidian uses internally)
- **Build:** Rollup or esbuild (single bundle output)
- **Physics:** cannon-es or custom (for node layout in 3D)
- **State:** Lightweight store (Svelte stores or custom)

### MVP Feature Set (revised based on research)
1. Three.js 3D graph in Obsidian ItemView
2. Nodes = notes, edges = links (from MetadataCache)
3. OrbitControls for 3D navigation
4. Color by folder/tag
5. Click node to open note
6. 3-5 visual themes
7. Performance target: 200+ nodes at 60fps

### Development Environment Setup
```bash
# 1. Clone Obsidian plugin template
git clone https://github.com/obsidianmd/obsidian-sample-plugin.git graphforge
cd graphforge

# 2. Install dependencies
npm install
npm install three @types/three cannon-es

# 3. Build
npm run dev    # watch mode
npm run build  # production

# 4. Link to Obsidian plugins dir
ln -s $(pwd) ~/.obsidian/plugins/graphforge
```
