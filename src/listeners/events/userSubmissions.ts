import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { config } from 'config';
import { Message } from 'discord.js';
import { generateSubmission, getEvent } from 'services/events.service';

@ApplyOptions<Listener.Options>({
	name: 'event - user submissions',
	event: Events.MessageCreate
})
export class UserEvent extends Listener {
	public override async run(message: Message) {
		if (message.author.bot) return;
		if (message.member?.roles.cache.hasAny(config.roles.staff, config.roles.leadmod)) return;

		const event = await getEvent(message.channelId);
		if (!event) return;
		if (event.status !== 'ACTIVE') return;

		// Check if submission meets requirements
		const meetsAttachmentRequirement = !event.requireAttachment || message.attachments.size > 0;
		const meetsCharacterRequirement = message.content.length >= event.minCharacters;

		if (!meetsAttachmentRequirement || !meetsCharacterRequirement) return;

		// Generate Submission
		try {
			return await generateSubmission(event.id, message.url, message.author.id);
		} catch (error) {
			this.container.logger.error(`Failed to generate submission for user ${message.author.id} in event ${event.id}:`, error);
		}
	}
}
