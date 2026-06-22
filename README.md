# GraphForge -- 3D Knowledge Graph Visualization for Obsidian

GraphForge transforms your Obsidian vault into an immersive 3D knowledge graph. See your notes as nodes, their connections as links, and explore your knowledge in a whole new dimension.

## Features

### 🎨 Visual Themes
- **Dark** -- Clean, professional dark theme
- **Light** -- Bright, airy light theme
- **Neon** -- Vibrant neon accents on dark background
- **Galaxy** -- Deep space with starfield, nebulae, and bloom effects

### ⚡ Physics Engines
- **Classical** -- Traditional force-directed layout
- **Einstein** -- Relativity-inspired physics with spacetime curvature, time dilation, and speed of light limits
- **Nexus** -- Quantum harmonics with golden ratio spirals, prime number resonance, and wave function evolution

### 📐 Layout Algorithms
- **Force** -- Dynamic force-directed (default)
- **Tree** -- Hierarchical tree structure
- **Circle** -- Rings by connection count
- **Grid** -- Organized grid layout
- **Timeline** -- Chronological by creation date
- **Radial** -- Selected node at center
- **Solar System** -- Hub and orbital rings
- **Galaxy** -- Spiral arms with golden ratio spacing

### 🎛️ Force Controls
Tune the physics in real-time:
- **Gravity** -- Central attraction strength
- **Repel** -- Node separation force
- **Link** -- Connection attraction strength
- **Distance** -- Link rest distance / speed of light
- **Damping/Rotation** -- Velocity friction

### 📊 Analytics Panel
- Total nodes, links, orphans, connection density
- Most connected notes (top 5)
- Weekly activity bar chart
- Connection distribution histogram

### 📤 Export
- **PNG** -- High-resolution screenshot
- **HTML** -- Interactive standalone visualization
- **JSON** -- Raw graph data for external tools

### ⏳ Time Travel
- Slider to watch your knowledge graph evolve over time
- Play/pause animation through note creation history

### 💡 AI-Powered Suggestions
- Automatically detects potentially related but unlinked notes
- Accept individual suggestions or all at once
- Highlights suggested connections in the graph

## Installation

1. Install from Obsidian Community Plugins (search "GraphForge")
2. Enable the plugin in Settings → Community Plugins
3. Click the ribbon icon (graph node) or run command "Open GraphForge"

## Usage

### Navigation
- **Rotate** -- Click and drag
- **Zoom** -- Scroll wheel
- **Pan** -- Right-click and drag
- **Open note** -- Double-click a node
- **Context menu** -- Right-click a node

### Keyboard Shortcuts
- `Ctrl+P` → "Open GraphForge" -- Open the graph view
- `Arrow keys` -- Cycle through nodes
- `Enter` -- Open selected node
- `Tab` -- Cycle through connections
- `/` -- Focus search box
- `Escape` -- Reset view / exit focus mode
- `F` -- Toggle focus mode

### Toolbar
- 🔍 **Search** -- Filter nodes by name
- 🏷️ **Labels** -- Toggle node labels
- 🔄 **Reset** -- Reset camera view
- ⏸️ **Pause** -- Pause/resume physics
- 🎯 **Focus** -- Focus mode (dim unrelated nodes)
- 📐 **Layout** -- Switch layout algorithm
- 🔭 **View** -- View mode (All, Hub & Spoke, Constellation, Focused)
- 💡 **Suggest** -- AI-powered connection suggestions
- 📊 **Analytics** -- Graph statistics panel
- 📤 **Export** -- Export as PNG/HTML/JSON
- 🎛️ **Forces** -- Tune physics parameters
- ⏳ **Time** -- Time travel mode
- ⚡ **Physics** -- Switch physics engine

## Configuration

Access settings via Settings → Community Plugins → GraphForge:

- **Theme** -- Visual theme (Dark/Light/Neon/Galaxy)
- **Max Nodes** -- Maximum nodes to display (50-2000)
- **Node Size** -- Base node size
- **Show Labels** -- Display node names
- **Show Orphans** -- Show unconnected notes
- **Connection Mode** -- How links are detected (wikilinks/folder/tags/all)
- **Auto Rotate** -- Gentle automatic rotation
- **Bloom Intensity** -- Glow effect strength
- **Bloom Threshold** -- Glow threshold
- **Bloom Radius** -- Glow spread

## Architecture

```
graphforge-plugin/
├── manifest.json          # Plugin manifest
├── styles.css             # Plugin styles
├── README.md              # This file
└── src/
    ├── main.ts            # Plugin entry point
    ├── settings.ts        # Settings and types
    ├── GraphForgeView.ts  # Main 3D view class
    ├── analytics.ts       # Graph analytics computation
    └── suggestions.ts     # AI-powered link suggestions
```

## Performance Tips

- For vaults with 500+ nodes, use "Hub & Spoke" or "Constellation" view modes
- Reduce "Max Nodes" setting for smoother animation
- Pause physics (⏸️) when not actively exploring
- Use "Focused" view mode to reduce rendered nodes

## License

MIT License -- Free and open source.
