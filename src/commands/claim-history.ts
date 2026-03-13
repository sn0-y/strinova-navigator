import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { prisma } from 'prisma';

@ApplyOptions<Command.Options>({
	name: 'claim-history',
	description: 'View your event prize claim history'
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName(this.name).setDescription(this.description)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		const pastClaims = await prisma.winner.findMany({
			where: { userId: interaction.user.id, inGameUid: { not: null } },
			orderBy: { claimedAt: 'desc' },
			include: { event: true },
			take: 5
		});

		if (pastClaims.length === 0) {
			return interaction.editReply('You have no past prize claims.');
		}

		const embed = new EmbedBuilder()
			.setTitle('Prize Claim History')
			.setColor('Blurple');

		let description = '';
		for (const claim of pastClaims) {
			description += `**Event #${claim.event.id}**: ${claim.event.name}\n`;
			description += `└ UID Submitted: \`${claim.inGameUid}\` on <t:${Math.floor(claim.claimedAt!.getTime() / 1000)}:f>\n\n`;
		}

		embed.setDescription(description);

		return interaction.editReply({ embeds: [embed] });
	}
}
