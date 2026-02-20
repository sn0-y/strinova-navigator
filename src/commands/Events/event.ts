import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Channel } from 'discord.js';
import { checkDuplicateEvent, createEvent } from 'services/events.service';

@ApplyOptions<Subcommand.Options>({
	name: 'event',
	description: 'Event management utilities',
	subcommands: [
		{
			name: 'track',
			type: 'method',
			preconditions: [['StaffOnly', 'LeadModOnly']],
		}
	]
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((subcommand) =>
					subcommand //
						.setName('track')
						.setDescription('Track a new event')
						.addStringOption((option) =>
							option //
								.setName('event-name')
								.setDescription('The name of the event to track')
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option //
								.setName('channel')
								.setDescription('The channel to track the event in')
								.setRequired(true)
						)
						.addBooleanOption((option) =>
							option //
								.setName('require-attachment')
								.setDescription('Whether the event requires an attachment')
								.setRequired(false)
						)
						.addIntegerOption((option) =>
							option //
								.setName('min-characters')
								.setDescription('The minimum number of characters required in the submission')
								.setRequired(false)
						)
				)
		);
	}

	public async track(interaction: Subcommand.ChatInputCommandInteraction) {
		const eventName = interaction.options.getString('event-name', true);
		const channel = interaction.options.getChannel('channel', true) as Channel;
		const requireAttachment = interaction.options.getBoolean('require-attachment', false) ?? false;
		const minCharacters = interaction.options.getInteger('min-characters', false) ?? 0;

		if (!channel.isTextBased()) return interaction.reply({ content: 'The bot only supports text channels.', ephemeral: true });

		const dupeCheck = await checkDuplicateEvent(channel.id);
		if (dupeCheck) return interaction.reply({ content: `This event is already being tracked by [${dupeCheck.id} : ${dupeCheck.name}]`, ephemeral: true });

		const event = await createEvent(channel.id, eventName, requireAttachment, minCharacters);
		return interaction.reply({ content: `Started tracking event [${event.id} : ${event.name}] in ${channel.url}`, ephemeral: true });
	}
}
