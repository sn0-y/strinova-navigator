import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { Role, Channel, ChannelType } from 'discord.js';
import { getServerConfig, upsertServerConfig } from 'services/config.service';

@ApplyOptions<Subcommand.Options>({
	description: 'Commands related to server configuration',
	preconditions: [['OwnerOnly']],
	subcommands: [
		{ name: 'view', chatInputRun: 'viewConfig' },
		{ name: 'set-prefix', chatInputRun: 'setPrefix' },
		{ name: 'set-role', chatInputRun: 'setRole' },
		{ name: 'set-channel', chatInputRun: 'setChannel' }
	]
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addSubcommand((command) => command.setName('view').setDescription('View the current server configuration'))
				.addSubcommand((command) =>
					command
						.setName('set-prefix')
						.setDescription('Set the server prefix')
						.addStringOption((option) => option.setName('prefix').setDescription('The new prefix').setRequired(true))
				)
				.addSubcommand((command) =>
					command
						.setName('set-role')
						.setDescription('Set a special role configuration')
						.addStringOption((option) =>
							option
								.setName('type')
								.setDescription('Which role to set')
								.addChoices(
									{ name: 'Staff Role', value: 'staff' },
									{ name: 'Lead Moderator Role', value: 'leadmod' }
								)
								.setRequired(true)
						)
						.addRoleOption((option) => option.setName('role').setDescription('The role').setRequired(true))
				)
				.addSubcommand((command) =>
					command
						.setName('set-channel')
						.setDescription('Set a special channel configuration')
						.addStringOption((option) =>
							option
								.setName('type')
								.setDescription('Which channel to set')
								.addChoices(
									{ name: 'Event Notifications Log', value: 'eventNotifications' },
									{ name: 'Mod Cases Log', value: 'modCasesLog' },
									{ name: 'Modmail Log', value: 'modmailLog' }
								)
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The channel')
								.addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
								.setRequired(true)
						)
				)
		);
	}

	public async viewConfig(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });
		const config = await getServerConfig(interaction.guildId!);

		if (!config) {
			return interaction.editReply('This server does not have a configuration yet. Use the other `/config` subcommands to set one up.');
		}

		const content = [
			'**Server Configuration**',
			`**Prefix**: \`${config.prefix}\``,
			'',
			'**Roles**',
			`- Staff Role: ${config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Not Set'}`,
			`- Lead Mod Role: ${config.leadModRoleId ? `<@&${config.leadModRoleId}>` : 'Not Set'}`,
			'',
			'**Channels**',
			`- Event Notifications Log: ${config.eventNotificationsChannelId ? `<#${config.eventNotificationsChannelId}>` : 'Not Set'}`,
			`- Mod Cases Log: ${config.modCasesLogChannelId ? `<#${config.modCasesLogChannelId}>` : 'Not Set'}`,
			`- Modmail Log: ${config.modmailLogChannelId ? `<#${config.modmailLogChannelId}>` : 'Not Set'}`
		].join('\n');

		return interaction.editReply(content);
	}

	public async setPrefix(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });
		const prefix = interaction.options.getString('prefix', true);

		await upsertServerConfig(interaction.guildId!, { prefix });
		return interaction.editReply(`✅ Configuration Updated: Prefix set to \`${prefix}\`.`);
	}

	public async setRole(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });
		const type = interaction.options.getString('type', true);
		const role = interaction.options.getRole('role', true) as Role;

		let updateData: any = {};
		if (type === 'staff') updateData.staffRoleId = role.id;
		else if (type === 'leadmod') updateData.leadModRoleId = role.id;

		await upsertServerConfig(interaction.guildId!, updateData);
		return interaction.editReply(`✅ Configuration Updated: ${type} role set to ${role.toString()}.`);
	}

	public async setChannel(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });
		const type = interaction.options.getString('type', true);
		const channel = interaction.options.getChannel('channel', true) as Channel;

		let updateData: any = {};
		if (type === 'eventNotifications') updateData.eventNotificationsChannelId = channel.id;
		else if (type === 'modCasesLog') updateData.modCasesLogChannelId = channel.id;
		else if (type === 'modmailLog') updateData.modmailLogChannelId = channel.id;

		await upsertServerConfig(interaction.guildId!, updateData);
		return interaction.editReply(`✅ Configuration Updated: ${type} channel set to ${channel.toString()}.`);
	}
}
