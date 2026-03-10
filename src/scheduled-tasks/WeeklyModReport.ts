import { ApplyOptions } from '@sapphire/decorators';
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { config } from '../config';
import { generateModeratorReport, processTierUpdates } from '../services/mod-reports.service';

@ApplyOptions<ScheduledTask.Options>({
	name: 'weekly-mod-report',
	pattern: '55 23 * * 0'
})
export class WeeklyModReportTask extends ScheduledTask {
	public async run() {
		this.container.logger.info('[ModRewards] Starting automated weekly report...');

		// 1. Calculate the strict 7-day window
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(endDate.getDate() - 7);

		try {
			// 2. Fetch Channel to post the report
			const reportChannel = (await this.container.client.channels.fetch(config.channels.eventNotifications)) as TextChannel;
			if (!reportChannel) {
				this.container.logger.error('[ModRewards] Could not find report channel!');
				return;
			}

			// 3. Run the engines
			const rawReportData = await generateModeratorReport(config.guildId, startDate, endDate);

			if (!rawReportData || rawReportData.length === 0) {
				await reportChannel.send('ℹ️ **Weekly Mod Report:** No moderator data found for this timeframe.');
				return;
			}

			const { promotions, demotions, maintained } = await processTierUpdates(rawReportData, startDate);

			// 4. Build and send the UI
			const embed = new EmbedBuilder()
				.setTitle('📊 Automated Weekly Moderator Report')
				.setDescription(`Report: <t:${Math.floor(startDate.getTime() / 1000)}:d> to <t:${Math.floor(endDate.getTime() / 1000)}:d>`)
				.setColor(demotions.length > 0 ? 0xe74c3c : 0x2ecc71)
				.setTimestamp();

			const formatLine = (r: any) =>
				`<@${r.userId}> — Current Tier ${r.oldTier} | Recommended Tier **${r.newTier}** (Score: **${r.score}**)\n*Cases: ${r.stats.cases} | Tickets: ${r.stats.tickets}*`;

			if (promotions.length > 0) embed.addFields({ name: '⬆️ Promotion Recommendations', value: promotions.map(formatLine).join('\n\n') });
			if (demotions.length > 0) embed.addFields({ name: '⬇️ Demotion Recommendations', value: demotions.map(formatLine).join('\n\n') });

			if (maintained.length > 0) {
				const maintainedStr = maintained.map(formatLine).join('\n\n');
				embed.addFields({
					name: '➖ No Tier Change Recommended',
					value: maintainedStr.length > 1024 ? maintainedStr.substring(0, 1000) + '...\n*(Truncated)*' : maintainedStr
				});
			}

			await reportChannel.send({ embeds: [embed] });
			this.container.logger.info('[ModRewards] Successfully posted weekly report.');
		} catch (error) {
			this.container.logger.error('[ModRewards] Fatal error during automated weekly run:', error);
		}
	}
}
