import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { TextChannel } from 'discord.js';
import { prisma } from 'prisma';
import { CATEGORY_CONFIG } from 'config';
import { config } from 'config';
import { generateModeratorReport, processTierUpdates, aggregateMonthlyReport } from 'services/mod-reports.service';
import { parseActionType, logCaseActivity, parseModmailFooter, parseSapphireFooter, resolveUsernameToId } from 'services/mod-tracker.service';

@ApplyOptions<Subcommand.Options>({
	description: 'Commands related to moderation reports',
	preconditions: [['LeadModOnly', 'StaffOnly']],
	subcommands: [
		{ name: 'generate-weekly', chatInputRun: 'generateWeekly' },
		{ name: 'view-monthly', chatInputRun: 'viewMonthly' },
		{ name: 'view-individual', chatInputRun: 'viewIndividual' },
		{ name: 'backfill', chatInputRun: 'backfill' },
		{ name: 'add-moderator', chatInputRun: 'addModerator' },
		{ name: 'remove-moderator', chatInputRun: 'removeModerator' },
		{ name: 'list-moderators', chatInputRun: 'listModerators' }
	]
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((command) =>
					command.setName('generate-weekly').setDescription('Generate and store the latest weekly moderator activity report')
				)
				.addSubcommand((command) =>
					command.setName('view-monthly').setDescription('View the aggregated moderator statistics for the last month')
				)
				.addSubcommand((command) => command.setName('view-individual').setDescription("View a specific moderator's report"))
				.addSubcommand((command) => command.setName('backfill').setDescription('Backfill past data'))
				.addSubcommand((command) =>
					command
						.setName('add-moderator')
						.setDescription('Add a moderator to the manually managed rewards roster')
						.addUserOption((option) => option.setName('user').setDescription('The moderator to add').setRequired(true))
						.addIntegerOption((option) =>
							option.setName('tier').setDescription('Starting tier for the moderator').setMinValue(0).setMaxValue(3).setRequired(false)
						)
				)
				.addSubcommand((command) =>
					command
						.setName('remove-moderator')
						.setDescription('Remove a moderator from the manually managed rewards roster')
						.addUserOption((option) => option.setName('user').setDescription('The moderator to remove').setRequired(true))
				)
				.addSubcommand((command) =>
					command.setName('list-moderators').setDescription('List all moderators currently in the manually managed rewards roster')
				)
		);
	}

	public async generateWeekly(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const now = new Date();
		// Compute start and end of the last complete week (e.g., Monday to Sunday)
		const currentDay = now.getDay();
		const daysToLastMonday = currentDay === 0 ? 6 : currentDay - 1; // Days since this week's Monday

		const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday - 7);
		const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastMonday - 1, 23, 59, 59, 999);

		try {
			const rawReport = await generateModeratorReport(interaction.guildId!, startDate, endDate);

			if (!rawReport || rawReport.length === 0) {
				return interaction.editReply('No moderator activity found for the last week.');
			}

			const { promotions, demotions, maintained } = await processTierUpdates(rawReport, startDate);

			return interaction.editReply(
				`Weekly report generated. Mod tiers updated: ${promotions.length} promoted, ${demotions.length} demoted, ${maintained.length} maintained.`
			);
		} catch (error) {
			console.error(error);
			return interaction.editReply('An error occurred while generating the weekly report.');
		}
	}

	public async viewMonthly(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

		try {
			const aggregated = await aggregateMonthlyReport(startOfMonth, endOfMonth);

			if (!aggregated || aggregated.length === 0) {
				return interaction.editReply('No aggregated data found for the last month.');
			}

			// Group by Tier
			const moderators = await prisma.moderator.findMany();
			const tierMap = new Map<number, any[]>();
			[1, 2, 3].forEach((tier) => tierMap.set(tier, []));

			for (const stats of aggregated) {
				const mod = moderators.find((m) => m.userId === stats.userId);
				const tier = mod ? mod.currentTier : 1; // Default to Tier 1

				const points =
					(stats._sum.cases || 0) * CATEGORY_CONFIG.casesHandled.pointsPerUnit +
					(stats._sum.tickets || 0) * CATEGORY_CONFIG.modActionsTaken.pointsPerUnit +
					(stats._sum.publicMessages || 0) * CATEGORY_CONFIG.publicChatMessages.pointsPerUnit +
					(stats._sum.voiceMinutes || 0) * CATEGORY_CONFIG.voiceChatMinutes.pointsPerUnit;

				tierMap.get(tier)?.push({
					userId: stats.userId,
					points,
					cases: stats._sum.cases || 0,
					tickets: stats._sum.tickets || 0,
					publicMessages: stats._sum.publicMessages || 0,
					voiceMinutes: stats._sum.voiceMinutes || 0
				});
			}

			// Format the response
			let content = `**Monthly Aggregated Report (${startOfMonth.toDateString()} - ${endOfMonth.toDateString()})**\n\n`;

			const tierEmojis: Record<number, string> = {
				3: ':Starcore:',
				2: ':downvote~2:',
				1: ':downvote~2:'
			};

			[3, 2, 1].forEach((tier) => {
				content += `## ${tierEmojis[tier] || ''} Tier ${tier}\n`;
				const tierMods = tierMap.get(tier) || [];

				if (tierMods.length === 0) {
					content += '*None!*\n';
				} else {
					// Sort by points descending
					tierMods.sort((a, b) => b.points - a.points);
					tierMods.forEach((m) => {
						content += `<@${m.userId}> | Points: **${m.points}** | ${m.cases} Cases | ${m.tickets} Tickets | ${m.publicMessages} Msgs | ${m.voiceMinutes} Voice Mins\n`;
					});
				}
				content += '\n';
			});

			// Handle limits of Discord messages
			if (content.length > 2000) {
				return interaction.editReply({ files: [{ attachment: Buffer.from(content), name: 'monthly-report.txt' }] });
			} else {
				return interaction.editReply(content);
			}
		} catch (error) {
			console.error(error);
			return interaction.editReply('An error occurred while aggregating the monthly report.');
		}
	}

	public async viewIndividual(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply({ content: 'Individual report generation is not implemented yet.', ephemeral: true });
	}

	public async addModerator(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		const user = interaction.options.getUser('user', true);
		const tier = interaction.options.getInteger('tier', false) ?? 3;

		try {
			const moderator = await prisma.moderator.upsert({
				where: { userId: user.id },
				update: {
					isActive: true,
					currentTier: tier
				},
				create: {
					userId: user.id,
					currentTier: tier,
					isActive: true
				}
			});

			return interaction.editReply(`✅ Added <@${moderator.userId}> to the moderator roster with Tier **${moderator.currentTier}**.`);
		} catch (error) {
			console.error(error);
			return interaction.editReply('An error occurred while adding that moderator to the roster.');
		}
	}

	public async removeModerator(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		const user = interaction.options.getUser('user', true);

		try {
			const existingModerator = await prisma.moderator.findUnique({
				where: { userId: user.id }
			});

			if (!existingModerator || !existingModerator.isActive) {
				return interaction.editReply('That user is not currently in the active moderator roster.');
			}

			await prisma.moderator.update({
				where: { userId: user.id },
				data: { isActive: false }
			});

			return interaction.editReply(`✅ Removed <@${user.id}> from the active moderator roster.`);
		} catch (error) {
			console.error(error);
			return interaction.editReply('An error occurred while removing that moderator from the roster.');
		}
	}

	public async listModerators(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		try {
			const moderators = await prisma.moderator.findMany({
				where: { isActive: true },
				orderBy: [{ currentTier: 'desc' }, { userId: 'asc' }]
			});

			if (moderators.length === 0) {
				return interaction.editReply('There are no active moderators in the manually managed roster.');
			}

			const content = [
				'**Active Moderator Roster**',
				...moderators.map((moderator) => `<@${moderator.userId}> — Tier **${moderator.currentTier}**${moderator.isExempt ? ' — Exempt' : ''}`)
			].join('\n');

			if (content.length > 2000) {
				return interaction.editReply({
					files: [{ attachment: Buffer.from(content), name: 'moderator-roster.txt' }]
				});
			}

			return interaction.editReply(content);
		} catch (error) {
			console.error(error);
			return interaction.editReply('An error occurred while fetching the moderator roster.');
		}
	}

	public async backfill(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.reply({ content: '⏳ Scraping logs for the last 30 days...', ephemeral: true });
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 30); // Go back 30 days

		let totalParsed = 0;

		try {
			const casesChannel = (await this.container.client.channels.fetch(config.channels.modCasesLog)) as TextChannel;
			const modmailChannel = (await this.container.client.channels.fetch(config.channels.modmailLog)) as TextChannel;

			totalParsed += await this.processChannel(casesChannel, startDate, 'CASE_HANDLED', interaction.guild!);
			totalParsed += await this.processChannel(modmailChannel, startDate, 'TICKET_HANDLED', interaction.guild!);

			return interaction.editReply(`✅ Ingestion complete! Backfilled **${totalParsed}** actions into Prisma.`);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply('❌ Error during backfill. Check console.');
		}
	}

	private async processChannel(channel: TextChannel, startDate: Date, activityType: 'CASE_HANDLED' | 'TICKET_HANDLED', guild: any) {
		let lastMessageId: string | undefined;
		let count = 0;

		while (true) {
			const messages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
			if (messages.size === 0) break;

			for (const msg of messages.values()) {
				lastMessageId = msg.id;
				if (msg.createdAt < startDate) return count; // We've gone back far enough

				if (!msg.author.bot || msg.embeds.length === 0) continue;
				const embed = msg.embeds[0];
				const footerText = embed.footer?.text;
				if (!footerText) continue;

				let modId: string | null = null;
				let actionType = null;
				if (activityType === 'TICKET_HANDLED') {
					modId = parseModmailFooter(footerText);
				} else {
					const username = parseSapphireFooter(footerText);
					if (username) modId = await resolveUsernameToId(guild, username);
					actionType = parseActionType(embed.title);
				}

				if (!modId) continue;

				await logCaseActivity(
					modId,
					activityType,
					actionType,
					activityType === 'CASE_HANDLED' ? 'CASES_LOG' : 'MODMAIL_LOG',
					msg.id,
					msg.createdAt
				);
				count++;
			}
		}
		return count;
	}
}
