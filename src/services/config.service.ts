import { container } from '@sapphire/framework';
import { prisma } from 'prisma';
import { ServerConfig } from 'prisma/generated/prisma/client';

const inFlightGetConfigRequests = new Map<string, Promise<ServerConfig | null>>();

export async function getServerConfig(guildId: string): Promise<ServerConfig | null> {
	const configDataRaw = await container.redis.get(`server_config:${guildId}`);

	if (configDataRaw) {
		return JSON.parse(configDataRaw) as ServerConfig;
	}

	if (inFlightGetConfigRequests.has(guildId)) {
		return inFlightGetConfigRequests.get(guildId)!;
	}

	const promise = (async () => {
		try {
			const config = await prisma.serverConfig.findUnique({
				where: {
					guildId: guildId
				}
			});

			if (config) {
				await container.redis.set(`server_config:${guildId}`, JSON.stringify(config), 'EX', 3600); // Cache for 1 hour
			}

			return config;
		} finally {
			inFlightGetConfigRequests.delete(guildId);
		}
	})();

	inFlightGetConfigRequests.set(guildId, promise);
	return promise;
}

export async function upsertServerConfig(guildId: string, data: Partial<Omit<ServerConfig, 'guildId' | 'updatedAt'>>): Promise<ServerConfig> {
	const currentConfig = await prisma.serverConfig.findUnique({ where: { guildId } });

	const config = await prisma.serverConfig.upsert({
		where: { guildId },
		update: data,
		create: {
			guildId,
			prefix: data.prefix ?? '&',
			staffRoleId: data.staffRoleId,
			leadModRoleId: data.leadModRoleId,
			eventNotificationsChannelId: data.eventNotificationsChannelId,
			modCasesLogChannelId: data.modCasesLogChannelId,
			modmailLogChannelId: data.modmailLogChannelId
		}
	});

	await container.redis.set(`server_config:${guildId}`, JSON.stringify(config), 'EX', 3600);

	return config;
}
