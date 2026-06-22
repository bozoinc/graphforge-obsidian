# Changelog

## [0.2.0] - 2026-06-22

### Added
- **3 Physics Engines** -- Classical (force-driven), Einstein (relativity-inspired with spacetime curvature and time dilation), and Nexus Harmonics (quantum behavior with golden ratio spirals)
- **8 Layout Algorithms** -- Force, Tree, Circle, Grid, Timeline, Radial, Solar System, and Galaxy
- **5 Tunable Force Sliders** -- Gravity, Repel, Link Force, Distance, and Damping/Rotation with real-time control
- **Analytics Panel** -- Node/link counts, connection density, most connected notes, weekly activity chart, connection distribution histogram
- **Export** -- PNG screenshot, interactive HTML, and JSON data export
- **Time Travel Mode** -- Slider to watch your knowledge graph evolve over time with play/pause animation
- **AI-Powered Suggestions** -- Automatically detects potentially related but unlinked notes with accept all/individual options
- **Loading Spinner** -- Animated loading indicator with status updates during graph initialization
- **Smooth Layout Transitions** -- Cubic ease-out animations when switching layouts with concurrent animation guards
- **Spatial Grid Optimization** -- O(n) physics for large vaults (>100 nodes) with automatic fallback
- **Proper Error Handling** -- Try/catch throughout with user-facing error messages
- **Memory Management** -- Proper Three.js geometry/material/DOM disposal on close

### Changed
- Extracted physics engines into separate `physics.ts` module for better code organization
- Improved spring dynamics for link forces (displacement-based rather than distance-based)
- Enhanced node hover preview with error handling for file reads
- Updated force control panel with safer slider ranges to prevent instability

### Fixed
- Bloom radius setting not saving correctly
- GPU memory leak in onClose() -- geometries and materials now properly disposed
- Ghost timer in temporal play loop continuing after panel close
- Layout animation running concurrently when switched rapidly
- Node meshes array reallocated on every mouse move (now cached)

## [0.1.0] - 2026-06-20

### Added
- Initial release
- 3D graph visualization using Three.js
- 4 visual themes (Dark, Light, Neon, Galaxy)
- Basic force-directed physics
- Node labels and hover effects
- Search/filter functionality
- Focus mode
- Keyboard navigation
- Context menu (open note, copy link, focus here)
- Double-click to open notes
- OrbitControls for 3D navigation
