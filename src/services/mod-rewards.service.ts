import { Guild } from "discord.js";
import { prisma } from "prisma";
import { ActionDetail } from "prisma/generated/prisma/enums";

export type CaseType = 'TICKET_HANDLED' | 'CASE_HANDLED';

/**
 * Parses Modmail footers: "Thread Closed by reiissad (626623961672843432)"
 * @returns The Discord User ID, or null if not found.
 */
export function parseModmailFooter(footerText: string): string | null {
    // Looks for exactly 17 to 20 digits surrounded by parentheses
    const match = footerText.match(/\((\d{17,20})\)/);
    return match ? match[1] : null;
}

/**
 * Parses Sapphire Cases footers: "@neko4an" (Human) or "Sapphire#1234" (Bot)
 * @returns The username (without the @), or null if it's a bot.
 */
export function parseSapphireFooter(footerText: string): string | null {
    // 1. Ignore bots (we don't give rewards to Dyno or Wick)
    if (footerText.includes('#')) {
        return null;
    }

    // 2. Extract human username
    if (footerText.startsWith('@')) {
        return footerText.substring(1).toLowerCase(); // Return 'neko4an'
    }

    return null;
}

/**
 * Extracts the first alphanumeric word from an embed title.
 * E.g., "Warn | User Spamming" -> "Warn"
 * E.g., "🚫 Ban - Rule 3" -> "Ban"
 * @returns The action type string, or null.
 */
export function parseActionType(title: string | null | undefined): ActionDetail | null {
    if (!title) return null;
    
    const match = title.match(/[a-zA-Z]+/);
    
    return match ? (match[0].toUpperCase() as ActionDetail) : null; 
}

/**
 * Converts a raw username (e.g., 'neko4an') into a Discord User ID.
 * @returns The Discord User ID, or null if the user cannot be found.
 */
export async function resolveUsernameToId(guild: Guild, username: string): Promise<string | null> {
    const cachedMember = guild.members.cache.find(m => m.user.username.toLowerCase() === username);
    if (cachedMember) return cachedMember.id;

    try {
        const members = await guild.members.fetch({ query: username, limit: 1 });
        const member = members.first();
        return member ? member.id : null;
    } catch (error) {
        return null;
    }
}

export async function logCaseActivity(userId: string, caseType: CaseType, action: ActionDetail, source: string, messageId: string) {
    await prisma.$transaction(async (prisma) => {
        prisma.moderator.upsert({
            where: { userId },
            update: {},
            create: { userId, currentTier: 3 }
        });

        await prisma.modActivity.create({
            data: {
                userId,
                type: caseType,
                value: 1, // change later
                source,
                referenceId: messageId,
                actionDetail: action
            }
        })
    });
}