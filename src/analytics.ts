import { TFile, MetadataCache, Vault } from 'obsidian';

export interface GraphAnalytics {
	totalNodes: number;
	totalConnections: number;
	avgConnections: number;
	mostConnected: { name: string; path: string; count: number }[];
	orphanedCount: number;
	clusterCount: number;
	largestClusterSize: number;
	connectionDensity: number;
	notesPerWeek: { label: string; count: number }[];
}

export function computeAnalytics(
	files: TFile[],
	metadataCache: MetadataCache,
	vault: Vault,
	getLinksForFile: (file: TFile) => string[]
): GraphAnalytics {
	const totalNodes = files.length;

	// Build degree map
	const degreeMap = new Map<string, number>();
	const folderMap = new Map<string, number>();
	const tagMap = new Map<string, number>();

	files.forEach(f => {
		const links = getLinksForFile(f);
		degreeMap.set(f.path, links.length);

		const folder = f.parent?.path || '/';
		folderMap.set(folder, (folderMap.get(folder) || 0) + 1);

		const cache = metadataCache.getFileCache(f);
		const tags = new Set<string>();
		const fmTags = cache?.frontmatter?.tags || [];
		if (Array.isArray(fmTags)) fmTags.forEach((t: string) => tags.add(t.toLowerCase()));
		(cache?.tags || []).forEach(t => tags.add(t.tag.toLowerCase()));
		tags.forEach(tag => {
			tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
		});
	});

	// Total connections (undirected, count each link once)
	let totalConnections = 0;
	degreeMap.forEach(count => { totalConnections += count; });
	// Each link is counted twice (source + target), so divide by 2
	totalConnections = Math.floor(totalConnections / 2);

	// Average connections per node
	const avgConnections = totalNodes > 0 ? totalConnections / totalNodes : 0;

	// Most connected notes (top 5)
	const sorted = Array.from(degreeMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([path, count]) => {
			const file = files.find(f => f.path === path);
			return {
				name: file?.basename || path.split('/').pop() || path,
				path,
				count
			};
		});

	// Orphaned notes
	let orphanedCount = 0;
	degreeMap.forEach((count, path) => {
		if (count === 0) orphanedCount++;
	});

	// Cluster count (using folder-based grouping as proxy)
	const clusterCount = folderMap.size;
	let largestClusterSize = 0;
	folderMap.forEach(size => {
		if (size > largestClusterSize) largestClusterSize = size;
	});

	// Connection density: actual links / possible links
	const possibleLinks = totalNodes * (totalNodes - 1) / 2;
	const connectionDensity = possibleLinks > 0 ? totalConnections / possibleLinks : 0;

	// Notes created per week (last 4 weeks)
	const now = Date.now();
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const notesPerWeek: { label: string; count: number }[] = [];

	for (let i = 3; i >= 0; i--) {
		const weekStart = now - (i + 1) * weekMs;
		const weekEnd = now - i * weekMs;
		let count = 0;
		files.forEach(f => {
			if (f.stat.ctime >= weekStart && f.stat.ctime < weekEnd) {
				count++;
			}
		});
		const startDate = new Date(weekStart);
		const label = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
		notesPerWeek.push({ label, count });
	}

	return {
		totalNodes,
		totalConnections,
		avgConnections,
		mostConnected: sorted,
		orphanedCount,
		clusterCount,
		largestClusterSize,
		connectionDensity,
		notesPerWeek,
	};
}
