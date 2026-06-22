// physics.ts -- Physics engines for GraphForge
import type { GraphNode } from './GraphForgeView';

export interface ForceParams {
	gravity: number;
	repel: number;
	linkForce: number;
	linkDistance: number;
	damping: number;
}

export function getDefaultForceParams(): ForceParams {
	return { gravity: 0.5, repel: 0.5, linkForce: 0.5, linkDistance: 0.5, damping: 0.85 };
}

export function runClassicalPhysics(nodes: GraphNode[], p: ForceParams): void {
	const repelScale = 100 + p.repel * 300;
	const linkScale = 0.003 + p.linkForce * 0.012;
	const linkDistScale = 10 + p.linkDistance * 40;
	const centerScale = 0.003 + p.gravity * 0.015;
	const damp = 0.75 + p.damping * 0.23;
	const nodeCount = nodes.length;

	if (nodeCount > 100) {
		const cellSize = 30;
		const grid = new Map<string, number[]>();
		for (let i = 0; i < nodeCount; i++) {
			const n = nodes[i];
			const key = `${Math.floor(n.x/cellSize)},${Math.floor(n.y/cellSize)},${Math.floor(n.z/cellSize)}`;
			if (!grid.has(key)) grid.set(key, []);
			grid.get(key)!.push(i);
		}
		for (let i = 0; i < nodeCount; i++) {
			const a = nodes[i];
			const cx = Math.floor(a.x / cellSize), cy = Math.floor(a.y / cellSize), cz = Math.floor(a.z / cellSize);
			for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
				const cell = grid.get(`${cx+dx},${cy+dy},${cz+dz}`);
				if (!cell) continue;
				for (const j of cell) {
					if (j <= i) continue;
					const b = nodes[j];
					const ddx = a.x - b.x, ddy = a.y - b.y, ddz = a.z - b.z;
					const d = Math.sqrt(ddx*ddx+ddy*ddy+ddz*ddz) + 0.1;
					const f = repelScale / (d * d);
					a.vx += (ddx/d)*f; a.vy += (ddy/d)*f; a.vz += (ddz/d)*f;
					b.vx -= (ddx/d)*f; b.vy -= (ddy/d)*f; b.vz -= (ddz/d)*f;
				}
			}
		}
	} else {
		for (let i = 0; i < nodeCount; i++) for (let j = i + 1; j < nodeCount; j++) {
			const a = nodes[i], b = nodes[j];
			const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
			const d = Math.sqrt(dx*dx+dy*dy+dz*dz) + 0.1;
			const f = repelScale / (d * d);
			a.vx += (dx/d)*f; a.vy += (dy/d)*f; a.vz += (dz/d)*f;
			b.vx -= (dx/d)*f; b.vy -= (dy/d)*f; b.vz -= (dz/d)*f;
		}
	}

	for (const n of nodes) {
		for (const lp of n.links) {
			const t = nodes.find(nd => nd.file.path === lp + '.md' || nd.file.path === lp);
			if (t) { const dx = t.x-n.x, dy = t.y-n.y, dz = t.z-n.z; const d = Math.sqrt(dx*dx+dy*dy+dz*dz)+0.1; const force = linkScale * (d - linkDistScale); n.vx += (dx/d)*force; n.vy += (dy/d)*force; n.vz += (dz/d)*force; }
		}
		n.vx -= n.x * centerScale; n.vy -= n.y * centerScale; n.vz -= n.z * centerScale;
		n.vx *= damp; n.vy *= damp; n.vz *= damp;
		const spd = Math.sqrt(n.vx*n.vx+n.vy*n.vy+n.vz*n.vz);
		if (spd > 15) { n.vx = (n.vx/spd)*15; n.vy = (n.vy/spd)*15; n.vz = (n.vz/spd)*15; }
		n.x += n.vx; n.y += n.vy; n.z += n.vz;
	}
}

export function runEinsteinPhysics(nodes: GraphNode[], p: ForceParams): void {
	const C = 15 + p.linkDistance * 35;
	const G = 0.01 + p.gravity * 0.09;
	const repelStr = 15 + p.repel * 60;
	const linkStr = 0.003 + p.linkForce * 0.012;
	const linkDist = 10 + p.linkDistance * 40;
	const damp = 0.75 + p.damping * 0.23;

	for (const n of nodes) {
		const mass = 1 + n.degree * 0.3;
		let fx = 0, fy = 0, fz = 0;
		for (const other of nodes) {
			if (other === n) continue;
			const dx = other.x - n.x, dy = other.y - n.y, dz = other.z - n.z;
			const dist = Math.sqrt(dx*dx+dy*dy+dz*dz) + 0.1;
			const oMass = 1 + other.degree * 0.3;
			fx += (dx/dist) * G * mass * oMass / (dist*dist);
			fy += (dy/dist) * G * mass * oMass / (dist*dist);
			fz += (dz/dist) * G * mass * oMass / (dist*dist);
			if (dist < 25) { const r = repelStr/(dist*dist); fx -= (dx/dist)*r; fy -= (dy/dist)*r; fz -= (dz/dist)*r; }
		}
		for (const lp of n.links) {
			const t = nodes.find(nd => nd.file.path === lp + '.md' || nd.file.path === lp);
			if (t) { const dx = t.x-n.x, dy = t.y-n.y, dz = t.z-n.z; const d = Math.sqrt(dx*dx+dy*dy+dz*dz)+0.1; const force = linkStr * (d - linkDist); fx += (dx/d)*force; fy += (dy/d)*force; fz += (dz/d)*force; }
		}
		const spd = Math.sqrt(n.vx*n.vx+n.vy*n.vy+n.vz*n.vz);
		if (spd > C) { n.vx = (n.vx/spd)*C; n.vy = (n.vy/spd)*C; n.vz = (n.vz/spd)*C; }
		const nm = nodes.reduce((s,o) => { if (o===n) return s; const d=Math.sqrt((o.x-n.x)**2+(o.y-n.y)**2+(o.z-n.z)**2)+0.1; return s+(1+o.degree*0.2)/d; }, 0);
		const td = 1/(1+nm*0.003);
		n.vx = (n.vx+fx*td)*damp; n.vy = (n.vy+fy*td)*damp; n.vz = (n.vz+fz*td)*damp;
		const spd2 = Math.sqrt(n.vx*n.vx+n.vy*n.vy+n.vz*n.vz);
		if (spd2 > 15) { n.vx = (n.vx/spd2)*15; n.vy = (n.vy/spd2)*15; n.vz = (n.vz/spd2)*15; }
		n.x+=n.vx; n.y+=n.vy; n.z+=n.vz;
	}
}

export function runNexusPhysics(nodes: GraphNode[], p: ForceParams): void {
	const t = performance.now() * 0.001;
	const PHI = 1.6180339887;
	const repelStr = 10 + p.repel * 40;
	const linkStr = 0.003 + p.linkForce * 0.012;
	const linkDist = 10 + p.linkDistance * 40;
	const centerStr = 0.001 + p.gravity * 0.008;
	const damp = 0.75 + p.damping * 0.23;

	for (const n of nodes) {
		let fx = 0, fy = 0, fz = 0;
		for (const other of nodes) {
			if (other === n) continue;
			const dx = n.x-other.x, dy = n.y-other.y, dz = n.z-other.z;
			const dist = Math.sqrt(dx*dx+dy*dy+dz*dz) + 0.1;
			if (dist < 30) { const r = repelStr/(dist*dist); fx += (dx/dist)*r; fy += (dy/dist)*r; fz += (dz/dist)*r; }
		}
		for (const lp of n.links) {
			const target = nodes.find(nd => nd.file.path === lp + '.md' || nd.file.path === lp);
			if (target) { const dx = target.x-n.x, dy = target.y-n.y, dz = target.z-n.z; const d = Math.sqrt(dx*dx+dy*dy+dz*dz)+0.1; const force = linkStr * (d - linkDist); fx += (dx/d)*force; fy += (dy/d)*force; fz += (dz/d)*force; }
		}
		const angle = Math.atan2(n.y, n.x);
		const spiralForce = 0.02 + p.gravity * 0.05;
		fx += Math.cos(angle + Math.PI/2) * spiralForce * (1 + Math.sin(t*0.15 + nodes.indexOf(n)*PHI)*0.2);
		fy += Math.sin(angle + Math.PI/2) * spiralForce * (1 + Math.sin(t*0.15 + nodes.indexOf(n)*PHI)*0.2);
		fx -= n.x*centerStr; fy -= n.y*centerStr; fz -= n.z*centerStr;
		n.vx = (n.vx+fx)*damp; n.vy = (n.vy+fy)*damp; n.vz = (n.vz+fz)*damp;
		const spd = Math.sqrt(n.vx*n.vx+n.vy*n.vy+n.vz*n.vz);
		if (spd > 12) { n.vx = (n.vx/spd)*12; n.vy = (n.vy/spd)*12; n.vz = (n.vz/spd)*12; }
		n.x += n.vx; n.y += n.vy; n.z += n.vz;
	}
}
