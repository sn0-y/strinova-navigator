// src/services/mod-reports.service.ts
import { prisma } from 'prisma';
import { CATEGORY_CONFIG, WEIGHT_BUDGETS } from '../config';

interface ModeratorStats {
	cases: number;
	tickets: number;
	publicMessages: number;
	voiceMinutes: number;
}

interface ModeratorReportResult {
	userId: string;
	stats: ModeratorStats;
	finalScore: string;
	tierChange: number;
}

interface StatbotSeriesPoint {
	count?: number;
	memberId?: string;
}

export interface StatbotPresenceData {
	discordId: string;
	messagesCount: number;
	voiceMinutes: number;
}

export async function fetchStatbotData(guildId: string, startDate: Date, endDate: Date): Promise<StatbotPresenceData[]> {
	const apiToken = process.env.STATBOT_API_TOKEN;
	if (!apiToken) throw new Error('STATBOT_API_TOKEN is not set');

	const start = startDate.getTime();
	const end = endDate.getTime();

	const moderators = await prisma.moderator.findMany({
		select: { userId: true },
		where: { isActive: true }
	});

	if (moderators.length === 0) return [];

	async function fetchSeriesTotals(endpoint: string, extraParams: Record<string, string> = {}): Promise<Map<string, number>> {
		const url = new URL(`https://api.statbot.net/v1${endpoint}`);
		url.searchParams.append('start', start.toString());
		url.searchParams.append('end', end.toString());
		url.searchParams.append('interval', 'day');
		url.searchParams.append('by_member', 'true');

		for (const { userId } of moderators) {
			url.searchParams.append('whitelist_members[]', userId);
		}

		for (const [key, value] of Object.entries(extraParams)) {
			url.searchParams.append(key, value);
		}

		try {
			const res = await fetch(url.toString(), {
				headers: { Authorization: `Bearer ${apiToken}` }
			});

			if (!res.ok) {
				console.error(`[Statbot] Request failed for ${endpoint}: ${res.status} ${res.statusText}`);
				return new Map();
			}

			const data = (await res.json()) as StatbotSeriesPoint[];
			const totals = new Map<string, number>();

			for (const { userId } of moderators) {
				totals.set(userId, 0);
			}

			for (const point of data) {
				if (!point.memberId) continue;
				totals.set(point.memberId, (totals.get(point.memberId) ?? 0) + (point.count ?? 0));
			}

			return totals;
		} catch (error) {
			console.error(`[Statbot] Error fetching ${endpoint}:`, error);
			return new Map();
		}
	}

	const [messageTotals, voiceTotals] = await Promise.all([
		fetchSeriesTotals(`/guilds/${guildId}/messages/series`),
		fetchSeriesTotals(`/guilds/${guildId}/voice/series`, {
			'voice_states[]': 'normal'
		})
	]);

	return moderators.map(({ userId }) => ({
		discordId: userId,
		messagesCount: messageTotals.get(userId) ?? 0,
		voiceMinutes: voiceTotals.get(userId) ?? 0
	}));
}

function calculateCategoryRatio(userValue: number, expectedValue: number, totalValue: number) {
	if (totalValue <= 0) return 1;
	if (expectedValue <= 0) return 1;
	return Math.min(1.5, userValue / expectedValue);
}

export function calculateTiers(reportData: Map<string, ModeratorStats>): ModeratorReportResult[] {
	const modCount = Math.max(reportData.size, 1);

	let totalRawCases = 0;
	let totalRawTickets = 0;
	let totalRawPublicMsgs = 0;
	let totalRawVoice = 0;

	for (const stats of reportData.values()) {
		totalRawCases += stats.cases * CATEGORY_CONFIG.casesHandled.pointsPerUnit;
		totalRawTickets += stats.tickets * CATEGORY_CONFIG.modActionsTaken.pointsPerUnit;
		totalRawPublicMsgs += stats.publicMessages * CATEGORY_CONFIG.publicChatMessages.pointsPerUnit;
		totalRawVoice += stats.voiceMinutes * CATEGORY_CONFIG.voiceChatMinutes.pointsPerUnit;
	}

	const expectedCases = totalRawCases / modCount;
	const expectedTickets = totalRawTickets / modCount;
	const expectedPublicMsgs = totalRawPublicMsgs / modCount;
	const expectedVoice = totalRawVoice / modCount;

	const results: ModeratorReportResult[] = [];

	for (const [userId, stats] of reportData.entries()) {
		const userCases = stats.cases * CATEGORY_CONFIG.casesHandled.pointsPerUnit;
		const userTickets = stats.tickets * CATEGORY_CONFIG.modActionsTaken.pointsPerUnit;
		const userPublicMsgs = stats.publicMessages * CATEGORY_CONFIG.publicChatMessages.pointsPerUnit;
		const userVoice = stats.voiceMinutes * CATEGORY_CONFIG.voiceChatMinutes.pointsPerUnit;

		const caseRatio = calculateCategoryRatio(userCases, expectedCases, totalRawCases);
		const ticketRatio = calculateCategoryRatio(userTickets, expectedTickets, totalRawTickets);
		const publicMsgRatio = calculateCategoryRatio(userPublicMsgs, expectedPublicMsgs, totalRawPublicMsgs);
		const voiceRatio = calculateCategoryRatio(userVoice, expectedVoice, totalRawVoice);

		const scoreCases = caseRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.casesHandled.weightClass];
		const scoreTickets = ticketRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.modActionsTaken.weightClass];
		const scorePublicMsgs = publicMsgRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.publicChatMessages.weightClass];
		const scoreVoice = voiceRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.voiceChatMinutes.weightClass];

		const finalScore = scoreCases + scoreTickets + scorePublicMsgs + scoreVoice;

		let tierChange = 0;

		if (finalScore < 0.5) {
			tierChange = -1;
		} else if (finalScore >= 1.2) {
			tierChange = 1;
		}

		results.push({
			userId,
			stats,
			finalScore: finalScore.toFixed(2),
			tierChange
		});
	}

	return results;
}

export async function generateModeratorReport(guildId: string, startDate: Date, endDate: Date) {
	const activeModerators = await prisma.moderator.findMany({
		select: { userId: true },
		where: { isActive: true }
	});

	if (activeModerators.length === 0) return [];

	const activeModeratorIds = activeModerators.map((moderator) => moderator.userId);

	const dbActivities = await prisma.modActivity.groupBy({
		by: ['userId', 'type'],
		where: {
			userId: { in: activeModeratorIds },
			recordedAt: {
				gte: startDate,
				lte: endDate
			}
		},
		_sum: {
			value: true
		}
	});

	const statbotData = await fetchStatbotData(guildId, startDate, endDate);

	const reportData = new Map<string, ModeratorStats>();

	for (const userId of activeModeratorIds) {
		reportData.set(userId, initializeModStats());
	}

	for (const activity of dbActivities) {
		const stats = reportData.get(activity.userId);
		if (!stats) continue;

		if (activity.type === 'CASE_HANDLED') stats.cases += activity._sum.value || 0;
		if (activity.type === 'TICKET_HANDLED') stats.tickets += activity._sum.value || 0;
	}

	for (const user of statbotData) {
		const stats = reportData.get(user.discordId);
		if (!stats) continue;

		stats.publicMessages = user.messagesCount;
		stats.voiceMinutes = user.voiceMinutes;
	}

	return calculateTiers(reportData);
}

// Helper to ensure clean object creation
function initializeModStats(): ModeratorStats {
	return { cases: 0, tickets: 0, publicMessages: 0, voiceMinutes: 0 };
}

export async function processTierUpdates(reportResults: any[], weekStartDate: Date) {
	const userIds = reportResults.map((r) => r.userId);
	const existingMods = await prisma.moderator.findMany({
		where: { userId: { in: userIds } }
	});

	const modMap = new Map(existingMods.map((m) => [m.userId, m]));
	const prismaOperations = [];

	// Clean data arrays to send back to the command
	const outcomes = {
		promotions: [] as any[],
		demotions: [] as any[],
		maintained: [] as any[]
	};

	for (const result of reportResults) {
		const mod = modMap.get(result.userId);
		if (!mod || mod.isExempt) continue;

		const oldTier = mod.currentTier;
		const recommendedTier = Math.max(0, Math.min(3, oldTier + result.tierChange));
		const actualChange = recommendedTier - oldTier;

		prismaOperations.push(
			prisma.weeklyModStat.upsert({
				where: {
					userId_weekStartDate: {
						userId: mod.userId,
						weekStartDate: weekStartDate
					}
				},
				update: {
					cases: result.stats.cases,
					tickets: result.stats.tickets,
					publicMessages: result.stats.publicMessages,
					voiceMinutes: result.stats.voiceMinutes,
					finalScore: parseFloat(result.finalScore),
					oldTier,
					newTier: recommendedTier
				},
				create: {
					userId: mod.userId,
					weekStartDate: weekStartDate,
					cases: result.stats.cases,
					tickets: result.stats.tickets,
					publicMessages: result.stats.publicMessages,
					voiceMinutes: result.stats.voiceMinutes,
					finalScore: parseFloat(result.finalScore),
					oldTier,
					newTier: recommendedTier
				}
			})
		);

		// Push the raw data into our outcome object
		const record = { userId: mod.userId, oldTier, newTier: recommendedTier, score: result.finalScore, stats: result.stats };

		if (actualChange > 0) outcomes.promotions.push(record);
		else if (actualChange < 0) outcomes.demotions.push(record);
		else outcomes.maintained.push(record);
	}

	if (prismaOperations.length > 0) {
		await prisma.$transaction(prismaOperations);
	}

	return outcomes;
}
export async function aggregateMonthlyReport(startDate: Date, endDate: Date) {
	return await prisma.weeklyModStat.groupBy({
		by: ['userId'],
		where: {
			weekStartDate: {
				gte: startDate,
				lte: endDate
			}
		},
		_sum: {
			cases: true,
			tickets: true,
			publicMessages: true,
			voiceMinutes: true
		}
	});
}
