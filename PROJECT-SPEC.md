# PROJECT: GraphForge — 3D Knowledge Graph Visualization

## MAIN GOAL
Build and launch a marketable 3D graph visualization plugin for Obsidian that generates sustainable revenue, using a solo-founder + AI-assisted development approach.

## REALISTIC CONTEXT
- **Founder:** Bozo (644bo) — works in WSL, comfortable with terminals, patient with debugging
- **AI Agent:** HMS (Hermes) — handles architecture, coding, design decisions, research
- **Executive constraints:** All software must be free and open-source for internal use; the product itself is a paid offering for customers
- **Competitive landscape:** Juggl (810 stars, interactive graph), Neo4j Graph View (advanced querying), Breadcrumbs (hierarchy) all exist. Need clear differentiation.

## PROJECT VISION
Transform Obsidian's basic graph view into an immersive 3D knowledge visualization experience. Start with an Obsidian plugin, expand to standalone app, eventually target enterprise.

## PHASE 1: RESEARCH & PROTOTYPE (Months 1-2)
**Goal:** Validate technical feasibility and define MVP feature set

Tasks:
1. Audit existing Obsidian graph plugins (Juggl, Neo4j Graph View, Breadcrumbs, Mind Map)
2. Determine technical architecture: Three.js vs Cytoscape.js vs D3.js for 3D rendering
3. Build minimum viable 3D graph prototype (web-based, not yet an Obsidian plugin)
4. Define MVP feature set based on what's achievable in 3 months
5. Research Obsidian plugin API and development workflow
6. Create competitive differentiation document -- what makes GraphForge unique?

**Deliverables:**
- Technical architecture document
- Working web-based 3D graph prototype
- Competitive analysis document
- MVP feature specification

## PHASE 2: MVP OBSIDIAN PLUGIN (Months 3-5)
**Goal:** Launch functional Obsidian plugin to paying users

MVP Features (prioritized):
1. 3D graph rendering with Three.js
2. Interactive node navigation (click, drag, zoom)
3. Color-coded nodes by folder/tag (leverage existing graph.json)
4. 3-5 visual themes
5. Basic physics simulation for node layout
6. Performance target: handle 500+ nodes smoothly

**Pricing:** $4.99-9.99/month (or one-time $29.99)

**Launch targets:**
- Month 3: Functional prototype, beta testers from Obsidian community
- Month 4: Community plugin release (free version with basic features)
- Month 5: Premium version with advanced features, target 50 paying users

## PHASE 3: STANDALONE APP (Months 6-9)
**Goal:** Expand beyond Obsidian ecosystem

Features:
- Multi-platform data import (Obsidian, Notion, Roam, Logseq)
- Advanced 3D features (lighting, particle effects)
- Team collaboration
- Embeddable graph views for websites

**Pricing:** $9.99/month individual, $49/month teams

## PHASE 4: ENTERPRISE (Months 10-12)
**Target:** $50K-100K ARR

Features:
- White-label deployment
- SSO and admin controls
- API integrations
- Custom visualization dashboards
- Priority support

**Pricing:** $5K-50K annual contracts

## TECHNICAL STACK (to research and validate)
- **Rendering:** Three.js (WebGL) or Cytoscape.js (used by Juggl)
- **Plugin framework:** Obsidian Plugin API (TypeScript)
- **Physics:** cannon-es or custom force-directed
- **State management:** Svelte (what Obsidian uses internally)
- **Build:** Vite or esbuild

## GO-TO-MARKET STRATEGY
1. Build in public on Twitter/X and Obsidian Discord
2. Create demo videos (screen recordings of 3D graph in action)
3. Submit to Obsidian Community Plugin Store
4. Launch on Product Hunt
5. Partner with Obsidian YouTubers for reviews
6. Offer free tier to build user base, charge for premium features

## REALISTIC REVENUE TARGETS
- Month 4: $0 (free launch, build user base)
- Month 6: $250-500 MRR (25-50 paying users)
- Month 9: $1-2K MRR (100-200 paying users)
- Month 12: $5-10K MRR (enterprise early adopters)

## CONSTRAINTS & RULES
1. All internal development tools must be free and open-source
2. No paid subscriptions for development tools
3. Bozo makes all final decisions on features and direction
4. HMS handles implementation, research, and first-draft decisions
5. Nothing is launched without Bozo's explicit approval
6. Regular check-ins on progress and direction

## SUCCESS CRITERIA (12 months)
- Functional Obsidian plugin published to community store
- 100+ active users
- $500+ MRR
- Clear product-market fit signals (users requesting features, positive reviews)
- Technical foundation solid enough for enterprise pivot

## IMMEDIATE NEXT STEPS (HMS should start here)
1. Research Obsidian plugin development API and best practices
2. Analyze Juggl's open-source code to understand 3D rendering approach in Obsidian
3. Evaluate Three.js vs Cytoscape.js for Obsidian plugin integration
4. Create a proof-of-concept 3D graph web app (standalone, not plugin yet)
5. Set up Obsidian plugin development environment
