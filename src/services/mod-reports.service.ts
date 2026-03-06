// src/services/mod-reports.service.ts
import { prisma } from 'prisma';
import { CATEGORY_CONFIG, WEIGHT_BUDGETS } from '../config';

export interface StatbotPresenceData {
    discordId: string;
    messagesCount: number;
    voiceMinutes: number;
}

export async function fetchStatbotData(guildId: string, startDate: Date, endDate: Date): Promise<StatbotPresenceData[]> {
    const apiToken = process.env.STATBOT_API_TOKEN;
    if (!apiToken) throw new Error("STATBOT_API_TOKEN is not set");

    const start = startDate.getTime();
    const end = endDate.getTime();

    const moderators = await prisma.moderator.findMany({
        select: { userId: true },
        where: { isActive: true }
    });

    const results: StatbotPresenceData[] = [];

    async function fetchSeriesTotal(endpoint: string, userId: string, extraParams: Record<string, string> = {}) {
        const url = new URL(`https://api.statbot.net/v1${endpoint}`);
        url.searchParams.append('start', start.toString());
        url.searchParams.append('end', end.toString());
        url.searchParams.append('interval', 'week');
        url.searchParams.append('whitelist_members[]', userId);
        
        for (const [k, v] of Object.entries(extraParams)) {
            url.searchParams.append(k, v);
        }

        try {
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });

            if (!res.ok) return 0;

            const data = (await res.json()) as { count?: number }[];
            
            return data.reduce((sum, s) => sum + (s.count || 0), 0);
        } catch (error) {
            console.error(`Error fetching statbot data for ${userId}:`, error);
            return 0;
        }
    }

    await Promise.all(moderators.map(async ({ userId }) => {
        const messagesCount = await fetchSeriesTotal(`/guilds/${guildId}/messages/series`, userId);
        const voiceMinutes = await fetchSeriesTotal(`/guilds/${guildId}/voice/series`, userId, {
            'voice_states[]': 'normal'
        });

        results.push({
            discordId: userId,
            messagesCount,
            voiceMinutes
        });
    }));

    return results;
}

export function calculateTiers(reportData: Map<string, any>) {
    const modCount = reportData.size || 1;
    
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

    const expectedCases = Math.max(1, totalRawCases / modCount);
    const expectedTickets = Math.max(1, totalRawTickets / modCount);
    const expectedPublicMsgs = Math.max(1, totalRawPublicMsgs / modCount);
    const expectedVoice = Math.max(1, totalRawVoice / modCount);

    const results = [];

    for (const [userId, stats] of reportData.entries()) {
        
        const userCases = stats.cases * CATEGORY_CONFIG.casesHandled.pointsPerUnit;
        const userTickets = stats.tickets * CATEGORY_CONFIG.modActionsTaken.pointsPerUnit;
        const userPublicMsgs = stats.publicMessages * CATEGORY_CONFIG.publicChatMessages.pointsPerUnit;
        const userVoice = stats.voiceMinutes * CATEGORY_CONFIG.voiceChatMinutes.pointsPerUnit;

        let caseRatio = Math.min(1.5, userCases / expectedCases);
        let ticketRatio = Math.min(1.5, userTickets / expectedTickets);
        let publicMsgRatio = Math.min(1.5, userPublicMsgs / expectedPublicMsgs);
        let voiceRatio = Math.min(1.5, userVoice / expectedVoice);

        if (totalRawCases === 0) caseRatio = 1.0;
        if (totalRawTickets === 0) ticketRatio = 1.0;

        const scoreCases = caseRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.casesHandled.weightClass];
        const scoreTickets = ticketRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.modActionsTaken.weightClass];
        const scorePublicMsgs = publicMsgRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.publicChatMessages.weightClass];
        const scoreVoice = voiceRatio * WEIGHT_BUDGETS[CATEGORY_CONFIG.voiceChatMinutes.weightClass];

        const finalScore = scoreCases + scoreTickets + scorePublicMsgs + scoreVoice;

        let tierChange = 0;
        
        if (finalScore < 0.5) {
            tierChange = -1; // Demote
        } else if (finalScore >= 1.2) {
            tierChange = 1;  // Promote
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
    const dbActivities = await prisma.modActivity.groupBy({
        by: ['userId', 'type'],
        where: {
            recordedAt: {
                gte: startDate,
                lte: endDate,
            }
        },
        _sum: {
            value: true
        }
    });

    const statbotData = await fetchStatbotData(guildId, startDate, endDate);

    const reportData = new Map<string, any>(); // Map<UserId, ModStats>

    for (const activity of dbActivities) {
        const userId = activity.userId;
        if (!reportData.has(userId)) reportData.set(userId, initializeModStats());
        
        const stats = reportData.get(userId);
        if (activity.type === 'CASE_HANDLED') stats.cases = activity._sum.value || 0;
        if (activity.type === 'TICKET_HANDLED') stats.tickets = activity._sum.value || 0;
    }

    for (const user of statbotData) {
        const userId = user.discordId;
        if (!reportData.has(userId)) reportData.set(userId, initializeModStats());
        
        const stats = reportData.get(userId);
        stats.publicMessages = user.messagesCount;
        stats.voiceMinutes = user.voiceMinutes;
    }

    const finalResults = calculateTiers(reportData);

    return finalResults;
}

// Helper to ensure clean object creation
function initializeModStats() {
    return { cases: 0, tickets: 0, publicMessages: 0, voiceMinutes: 0, finalScore: 0 };
}

export async function processTierUpdates(reportResults: any[], weekStartDate: Date) {
    const userIds = reportResults.map(r => r.userId);
    const existingMods = await prisma.moderator.findMany({
        where: { userId: { in: userIds } }
    });

    const modMap = new Map(existingMods.map(m => [m.userId, m]));
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
        const newTier = Math.max(0, Math.min(3, oldTier + result.tierChange));
        const actualChange = newTier - oldTier;

        prismaOperations.push(
            prisma.weeklyModStat.upsert({
                where: {
                    userId_weekStartDate: {
                        userId: mod.userId,
                        weekStartDate: weekStartDate,
                    }
                },
                update: {
                    cases: result.stats.cases,
                    tickets: result.stats.tickets,
                    publicMessages: result.stats.publicMessages,
                    voiceMinutes: result.stats.voiceMinutes,
                    finalScore: parseFloat(result.finalScore),
                    oldTier,
                    newTier,
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
                    newTier,
                }
            })
        );

        if (actualChange !== 0) {
            prismaOperations.push(
                prisma.moderator.update({ where: { userId: mod.userId }, data: { currentTier: newTier } })
            );
        }

        // Push the raw data into our outcome object
        const record = { userId: mod.userId, oldTier, newTier, score: result.finalScore, stats: result.stats };
        
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
