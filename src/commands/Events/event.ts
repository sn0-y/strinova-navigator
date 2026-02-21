import winnerResults from '#lib/components/winnerResults';
import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Channel } from 'discord.js';
import { checkDuplicateEvent, createEvent, endEvent, getEvent, pickWinners } from 'services/events.service';

@ApplyOptions<Subcommand.Options>({
	name: 'event',
	description: 'Event management utilities',
	subcommands: [
		{
			name: 'track',
			type: 'method',
			preconditions: [['StaffOnly', 'LeadModOnly', 'OwnerOnly']],
			chatInputRun: 'track'
		},
		{
			name: 'end',
			type: 'method',
			preconditions: [['StaffOnly', 'LeadModOnly', 'OwnerOnly']],
			chatInputRun: 'end'
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
				.addSubcommand((subcommand) =>
					subcommand
						.setName('end')
						.setDescription('End the currently active event in a channel')
						.addChannelOption((option) => option.setName('channel').setDescription('The channel to end the event in').setRequired(true))
						.addIntegerOption((option) => option.setName('winner-count').setDescription('The number of winners to select').setRequired(true))
						.addChannelOption((option) => option.setName('results-channel').setDescription('The channel to announce the winners in').setRequired(true))
				)
		);
	}

	public async track(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		const eventName = interaction.options.getString('event-name', true);
		const channel = interaction.options.getChannel('channel', true) as Channel;
		const requireAttachment = interaction.options.getBoolean('require-attachment', false) ?? false;
		const minCharacters = interaction.options.getInteger('min-characters', false) ?? 0;

		if (!channel.isTextBased()) return interaction.editReply({ content: 'The bot only supports text channels.' });

		const dupeCheck = await checkDuplicateEvent(channel.id);
		if (dupeCheck)
			return interaction.editReply({ content: `This event is already being tracked by [${dupeCheck.id} : ${dupeCheck.name}]` });

		const event = await createEvent(channel.id, eventName, requireAttachment, minCharacters);
		return interaction.editReply({ content: `Started tracking event [${event.id} : ${event.name}] in ${channel.url}` });
	}

	public async end(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		const channel = interaction.options.getChannel('channel', true) as Channel;
		const winnerCount = interaction.options.getInteger('winner-count', true);
		const resultsChannel = interaction.options.getChannel('results-channel', true) as Channel;
	
		const event = await getEvent(channel.id);
		if (!event) return interaction.editReply({ content: 'There is no active event in this channel.' });

		if (!resultsChannel.isSendable()) return interaction.editReply({ content: 'I do not have permission to send messages in the results channel.' });

		const winners = await pickWinners(event.id, winnerCount);
		if (!winners) return interaction.editReply({ content: 'There was an error selecting winners for the event. Please try again later.' });

		const endResult = await endEvent(event.id, event.channelId);
		if (!endResult) return interaction.editReply({ content: 'There was an error ending the event. Please try again later.' });

		const deadline = (Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)

		await this.container.tasks.create({ name: 'eventReport', payload: {
			eventId: event.id,
			eventName: event.name
		}}, { delay: 7 * 24 * 60 * 60 * 1000, repeated: false });

		await resultsChannel.send({
			flags: ['IsComponentsV2'],
			components: winnerResults(event.id.toString(), `https://discord.com/channels/${interaction.guildId}/${channel.id}`, event.name, winners.map((winner) => `<@${winner}>`), deadline.toString())
		})

		return interaction.editReply({ content: 'Generated successfully' });
	}
}
