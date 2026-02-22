import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { config } from 'config';
import { Message } from 'discord.js';
import { ActionDetail } from 'prisma/generated/prisma/enums';
import { CaseType, logCaseActivity, parseActionType, parseModmailFooter, parseSapphireFooter, resolveUsernameToId } from 'services/mod-rewards.service';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	name: 'mod-rewards log-parser',
})
export class UserEvent extends Listener {
	public override async run(message: Message) {
		const { channelId } = message;
		
		const isModmailCase = channelId === config.channels.modmailLog;
		const isModCases = channelId === config.channels.modCasesLog;

		if (!isModmailCase && !isModCases) return;
		if (!message.author.bot) return;
		if (message.embeds.length === 0) return;

		const caseType: CaseType = isModmailCase ? 'TICKET_HANDLED' : 'CASE_HANDLED';
		
		const modAction = this.detectActionType(message.embeds[0].title, caseType);
		if (!modAction) return;

		const modId = await this.parseEmbed(message, caseType);
		if (!modId) return;

		await logCaseActivity(modId, caseType, modAction, 'Listener', message.id);
	}

	private async parseEmbed(message: Message, caseType: CaseType) {
		const embed = message.embeds[0];
		const footer = embed.footer?.text;
		if (!footer) return;

		let modId: string | null = null;

		switch (caseType) {
			case 'TICKET_HANDLED':
				modId = parseModmailFooter(footer);
				break;
			case 'CASE_HANDLED':
				const username = parseSapphireFooter(footer);
				if (username) {
					modId = await resolveUsernameToId(message.guild!, username);
				}
				break;
		}

		if (!modId) return;

		return modId;
	}

	private detectActionType(title: string | null | undefined, caseType: CaseType) {
		switch (caseType) {
			case 'TICKET_HANDLED':
				return ActionDetail.CLOSE_TICKET;
			case 'CASE_HANDLED':
				return parseActionType(title);
			default:
				return null;
		}
	}
}
