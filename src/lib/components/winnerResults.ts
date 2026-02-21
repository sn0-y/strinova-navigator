import {
	ContainerBuilder,
	SectionBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MediaGalleryItemBuilder,
	MediaGalleryBuilder
} from 'discord.js';

export default (eventId: string, eventUrl: string, eventName: string, winnerMentions: string[], deadline: string) => [
	new ContainerBuilder()
		.setAccentColor(15105570)
		.addSectionComponents(
			new SectionBuilder()
				.setButtonAccessory(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setLabel('Go to event')
						.setEmoji({
							name: '🏆'
						})
						.setURL(eventUrl)
				)
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🎁 It's time for prize collection!\n**Contest:** ${eventName}`))
		)
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Winners:\n${winnerMentions.length > 0 ? winnerMentions.join('\n') : '*No winners could be selected for this event.*'}`))
		.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
		.addSectionComponents(
			new SectionBuilder()
				.setButtonAccessory(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Primary)
						.setLabel('Claim Rewards')
						.setEmoji({
							name: '🎁'
						})
						.setCustomId(`event:claim:btn:${eventId}`)
				)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`-# - Please submit your UID before <t:${deadline}:f> to claim your rewards!\n-# - Your rewards will be processed within \`14 business days\` after the collection period`
					)
				)
		)
		.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('https://i.imgur.com/SnWIBVd.png'))),
];
