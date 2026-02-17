import { Precondition } from '@sapphire/framework';
import { config } from 'config';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, GuildMember, Message } from 'discord.js';

export class LeadModOnlyPrecondition extends Precondition {
	public override messageRun(message: Message) {
		if (!this.verifyLeadMod(message.member)) return this.error({ message: 'You must be a lead moderator to use this command.' });
		return this.ok();
	}

	public override chatInputRun(interaction: ChatInputCommandInteraction) {
		const guildMember = interaction.guild?.members.cache.get(interaction.user.id) || null;
		if (!this.verifyLeadMod(guildMember)) return this.error({ message: 'You must be a lead moderator to use this command.' });
		return this.ok();
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
		const guildMember = interaction.guild?.members.cache.get(interaction.user.id) || null;

		if (!this.verifyLeadMod(guildMember)) return this.error({ message: 'You must be a lead moderator to use this command.' });
		return this.ok();
	}

	private verifyLeadMod(member: GuildMember | null) {
		if (!member) return false;
		return member.roles.cache.has(config.roles.leadmod);
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		LeadModOnly: never;
	}
}
