import { Precondition } from '@sapphire/framework';
import { config } from 'config';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, GuildMember, Message } from 'discord.js';

export class StaffOnlyPrecondition extends Precondition {
	public override messageRun(message: Message) {
		if (!this.verifyStaff(message.member)) return this.error({ message: 'You must be a staff member to use this command.' });
		return this.ok();
	}

	public override chatInputRun(interaction: ChatInputCommandInteraction) {
		const guildMember = interaction.guild?.members.cache.get(interaction.user.id) || null;
		if (!this.verifyStaff(guildMember)) return this.error({ message: 'You must be a staff member to use this command.' });
		return this.ok();
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		const guildMember = interaction.guild?.members.cache.get(interaction.user.id) || null;

		if (!this.verifyStaff(guildMember)) return this.error({ message: 'You must be a staff member to use this command.' });
		return this.ok();
	}

	private verifyStaff(member: GuildMember | null) {
		if (!member) return false;
		return member.roles.cache.has(config.roles.staff);
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		StaffOnly: never;
	}
}
