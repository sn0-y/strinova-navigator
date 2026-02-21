import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { config } from 'config';
import type { ModalSubmitInteraction } from 'discord.js';
import { compileEventReport, sendReport, submitWinnerUid } from 'services/events.service';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class ModalHandler extends InteractionHandler {
	public async run(interaction: ModalSubmitInteraction, { eventId }: { eventId: number }) {
		const uid = interaction.fields.getTextInputValue('uidInput');

		const submitResult = await submitWinnerUid(interaction.user.id, eventId, uid);
		if (!submitResult)
			return interaction.reply({
				content: 'Sorry, there was an error processing your claim. Please try again later or contact the staff team if the issue persists.',
				flags: ['Ephemeral']
			});

		await interaction.reply({
			content: `Thank you! Your UID \`${uid}\` has been submitted successfully. Your rewards will be processed within \`14 business days\`. If you have any questions, please contact the staff team.`,
			flags: ['Ephemeral']
		});

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
