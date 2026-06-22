import { TFile, MetadataCache } from 'obsidian';

export interface SuggestedConnection {
	source: TFile;
	target: TFile;
	reason: string;
	score: number;
}

export function findSuggestedConnections(
	files: TFile[],
	metadataCache: MetadataCache,
	existingLinks: Map<string, Set<string>>,
	maxSuggestions: number = 20
): SuggestedConnection[] {
	const suggestions: SuggestedConnection[] = [];
	const scored = new Map<string, SuggestedConnection>();

	// Build index of file data
	interface FileInfo {
		file: TFile;
		basename: string;
		words: Set<string>;
		folder: string;
		tags: Set<string>;
	}

	const fileInfos: FileInfo[] = files.map(f => {
		const cache = metadataCache.getFileCache(f);
		const tags = new Set<string>();
		const fmTags = cache?.frontmatter?.tags || [];
		if (Array.isArray(fmTags)) fmTags.forEach((t: string) => tags.add(t.toLowerCase()));
		(cache?.tags || []).forEach(t => tags.add(t.tag.toLowerCase()));

		// Extract meaningful words from basename (split on spaces, hyphens, underscores, camelCase)
		const basename = f.basename;
		const words = new Set<string>();
		const tokens = basename
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.split(/[\s\-_./]+/)
			.filter(w => w.length > 2)
			.map(w => w.toLowerCase());
		tokens.forEach(t => words.add(t));

		return {
			file: f,
			basename,
			words,
			folder: f.parent?.path || '/',
			tags,
		};
	});

	// Compare each pair of files
	for (let i = 0; i < fileInfos.length; i++) {
		for (let j = i + 1; j < fileInfos.length; j++) {
			const a = fileInfos[i];
			const b = fileInfos[j];

			// Skip if already linked
			const aLinks = existingLinks.get(a.file.path) || new Set();
			const bLinks = existingLinks.get(b.file.path) || new Set();
			if (aLinks.has(b.file.path) || bLinks.has(a.file.path) ||
				aLinks.has(b.file.path.replace('.md', '')) || bLinks.has(a.file.path.replace('.md', ''))) {
				continue;
			}

			let score = 0;
			const reasons: string[] = [];

			// 1. Shared words in titles
			const sharedWords = [...a.words].filter(w => b.words.has(w));
			if (sharedWords.length > 0) {
				score += sharedWords.length * 3;
				reasons.push(`Shared words: ${sharedWords.join(', ')}`);
			}

			// 2. Same folder
			if (a.folder === b.folder && a.folder !== '/') {
				score += 2;
				reasons.push(`Same folder: ${a.folder}`);
			}

			// 3. Shared tags
			const sharedTags = [...a.tags].filter(t => b.tags.has(t));
			if (sharedTags.length > 0) {
				score += sharedTags.length * 4;
				reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
			}

			// 4. Substring match (one title contains the other)
			const aLower = a.basename.toLowerCase();
			const bLower = b.basename.toLowerCase();
			if (aLower.includes(bLower) || bLower.includes(aLower)) {
				score += 5;
				reasons.push('Title substring match');
			}

			// 5. Similar edit distance for short titles
			if (a.basename.length < 30 && b.basename.length < 30) {
				const dist = levenshteinDistance(aLower, bLower);
				const maxLen = Math.max(aLower.length, bLower.length);
				if (maxLen > 0 && dist / maxLen < 0.3 && dist > 0) {
					score += 3;
					reasons.push('Similar titles');
				}
			}

			if (score > 0) {
				const key = [a.file.path, b.file.path].sort().join('|||');
				const existing = scored.get(key);
				if (!existing || existing.score < score) {
					scored.set(key, {
						source: a.file,
						target: b.file,
						reason: reasons.join('; '),
						score,
					});
				}
			}
		}
	}

	// Sort by score and return top N
	const sorted = Array.from(scored.values()).sort((a, b) => b.score - a.score);
	for (const s of sorted) {
		if (suggestions.length >= maxSuggestions) break;
		suggestions.push(s);
	}

	return suggestions;
}

function levenshteinDistance(a: string, b: string): number {
	const m = a.length, n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,
				dp[i][j - 1] + 1,
				dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
		}
	}
	return dp[m][n];
}
