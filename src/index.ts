import { redis } from '#lib/redis';
import './lib/setup';

import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { config } from 'config';
import { GatewayIntentBits } from 'discord.js';

const client = new SapphireClient({
	defaultPrefix: config.prefix,
	caseInsensitiveCommands: true,
	logger: {
		level: LogLevel.Debug
	},
	shards: 'auto',
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	],
	loadMessageCommandListeners: true
});

const main = async () => {
	try {
		container.redis = redis;

		client.logger.info('Logging in...');
		await client.login();
		client.logger.info(`Logged in as @${client.user?.username} (${client.user?.id})!`);
	} catch (error) {
		client.logger.fatal(error);
		await client.destroy();
		process.exit(1);
	}
};

void main();

declare module '@sapphire/framework' {
	interface Container{
		redis: typeof redis;
	}
}