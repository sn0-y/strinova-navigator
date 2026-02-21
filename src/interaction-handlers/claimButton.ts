import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction } from 'discord.js';
import { findWinner, reportSent } from 'services/events.service';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ButtonHandler extends InteractionHandler {
	public async run(interaction: ButtonInteraction, { eventId }: { eventId: number }) {			
		const winner = await findWinner(interaction.user.id, eventId);
		if (!winner) return interaction.reply({ content: 'Sorry, it seems like you are not a winner for this event or you have already claimed your prize.', flags: ['Ephemeral'] });

		if (winner.inGameUid) return interaction.reply({ content: `You have already claimed your prize with UID: ${winner.inGameUid}. If you believe this is a mistake, please contact the staff team.`, flags: ['Ephemeral'] });

		const modal = new ModalBuilder()
			.setCustomId(`event:claim:modal:${eventId}`)
			.setTitle('Claim Your Prize! 🎁');

		const uidInput = new TextInputBuilder()
			.setCustomId('uidInput')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setPlaceholder('Your Strinova UID')
			.setMinLength(5)
			.setMaxLength(15);

		const label = new LabelBuilder()
			.setLabel('Strinova ID:')
			.setTextInputComponent(uidInput);
		
		modal.addLabelComponents(label);
		return await interaction.showModal(modal);
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('event:claim:btn:')) return this.none();

		const eventId = parseInt(interaction.customId.split(':')[3]);
		if (isNaN(eventId)) return this.none();

		if (!await reportSent(eventId)) return this.none();

		return this.some({ eventId });
	}
}
