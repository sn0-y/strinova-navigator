import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { getConfig } from 'config';
import { EmbedBuilder, type ModalSubmitInteraction } from 'discord.js';
import { compileEventReport, sendReport, submitWinnerUid } from 'services/events.service';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class ModalHandler extends InteractionHandler {
	public async run(interaction: ModalSubmitInteraction, { eventId }: { eventId: number }) {
		const uid = interaction.fields.getTextInputValue('uidInput');

		const submitResult = await submitWinnerUid(interaction.user.id, eventId, uid);
		if (!submitResult.success)
			return interaction.reply({
				content:
					submitResult.error ||
					'Sorry, there was an error processing your claim. Please try again later or contact the staff team if the issue persists.',
				flags: ['Ephemeral']
			});

		const config = await getConfig(interaction.guildId!);
		const receiptEmbed = new EmbedBuilder()
			.setTitle('Prize Claim Receipt')
			.setDescription(`Thank you! Your UID \`${uid}\` has been submitted successfully for event #${eventId}.`)
			.addFields([
				{ name: 'UID Submitted', value: uid },
				{ name: 'Status', value: 'Processing' },
				{ name: 'Estimated Delivery', value: 'Within 14 business days after collection period closes' }
			])
			.setColor('Green')
			.setFooter({ text: 'If you have any questions, please contact the staff team.' });

		try {
			await interaction.user.send({ embeds: [receiptEmbed] });
			await interaction.reply({
				content: `Thank you! Your UID \`${uid}\` has been submitted successfully. I have sent you a receipt in your DMs! Your rewards will be processed within \`14 business days\`.`,
				flags: ['Ephemeral']
			});
		} catch (error) {
			// DMs are closed, fallback to ephemeral response
			await interaction.reply({
				content: `Thank you! Your UID \`${uid}\` has been submitted successfully. Your rewards will be processed within \`14 business days\`.\n*(I tried to DM you a receipt, but your DMs are closed!)*`,
				embeds: [receiptEmbed],
				flags: ['Ephemeral']
			});
		}

		try {
			if (config.channels.eventNotifications) {
				const logChannel = await interaction.client.channels.fetch(config.channels.eventNotifications);
				if (logChannel && logChannel.isSendable()) {
					const logEmbed = new EmbedBuilder()
						.setTitle('Prize Claim Received')
						.setDescription(`User <@${interaction.user.id}> has submitted their UID for event #${eventId}.`)
						.addFields([{ name: 'UID', value: uid }])
						.setColor('Blue')
						.setTimestamp();
					await logChannel.send({ embeds: [logEmbed] });
				}
			}
		} catch (e) {
			console.error('Failed to log prize claim:', e);
		}

		const report = await compileEventReport(eventId);
		if (!report) return;

		if (report.missingCount !== 0) return;

		return sendReport(eventId, config.channels.eventNotifications);
	}

	public override parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('event:claim:modal:')) return this.none();

		const eventId = parseInt(interaction.customId.split(':')[3]);
		if (isNaN(eventId)) return this.none();

		return this.some({ eventId });
	}
}
