import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import type { GuildMember, Role } from 'discord.js';

const USER_ID_REGEX = /\d{17,20}/;
const MAX_PROGRESS_UPDATE_INTERVAL_MS = 3000;

type ParseType = 'username' | 'user-id';

type AssignmentStatus = 'success' | 'already-had-role' | 'not-found' | 'invalid-input' | 'error' | 'skipped';

interface AssignmentReportRow {
	line: number;
	input: string;
	resolvedUserId: string;
	status: AssignmentStatus;
	message: string;
}

@ApplyOptions<Command.Options>({
	name: 'bulk-role-assign',
	description: 'Assign a role to many users from a txt/csv attachment',
	preconditions: [['LeadModOnly', 'StaffOnly']]
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.addAttachmentOption((option) => option.setName('file').setDescription('TXT or CSV file with one user per line').setRequired(true))
				.addRoleOption((option) => option.setName('role').setDescription('Role to assign').setRequired(true))
				.addStringOption((option) =>
					option
						.setName('parse-type')
						.setDescription('How to parse each line in the file')
						.setRequired(true)
						.addChoices({ name: 'Username', value: 'username' }, { name: 'User ID', value: 'user-id' })
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] });

		if (!interaction.guild) {
			return interaction.editReply('This command can only be used in a server.');
		}

		const file = interaction.options.getAttachment('file', true);
		const role = interaction.options.getRole('role', true) as Role;
		const parseType = interaction.options.getString('parse-type', true) as ParseType;

		if (!this.isSupportedFile(file.name, file.contentType)) {
			return interaction.editReply('Only `.txt` and `.csv` attachments are supported.');
		}

		let rawContent: string;
		try {
			const response = await fetch(file.url);
			if (!response.ok) {
				return interaction.editReply(`Failed to download the file (HTTP ${response.status}).`);
			}
			rawContent = await response.text();
		} catch (error) {
			this.container.logger.error({ error, attachmentUrl: file.url }, '[BulkRoleAssign] Failed to download attachment');
			return interaction.editReply('Failed to download or read the attachment.');
		}

		if (!rawContent.trim()) {
			return interaction.editReply('The provided file is empty.');
		}
		const rawLines = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

		const reportRows: AssignmentReportRow[] = [];
		let processed = 0;
		let successful = 0;
		let alreadyHadRole = 0;
		let failed = 0;
		let skipped = 0;
		let lastProgressUpdateAt = 0;

		for (let index = 0; index < rawLines.length; index++) {
			const lineNumber = index + 1;
			const rawLine = rawLines[index] ?? '';
			const trimmed = rawLine.trim();

			if (!trimmed) {
				skipped++;
				reportRows.push(this.buildReportRow(lineNumber, rawLine, '', 'skipped', 'Empty line'));
				continue;
			}

			const extractedValue = this.extractIdentifier(trimmed, parseType);
			if (!extractedValue) {
				failed++;
				reportRows.push(
					this.buildReportRow(
						lineNumber,
						trimmed,
						'',
						'invalid-input',
						`Could not extract a valid ${parseType === 'user-id' ? 'user ID' : 'username'}`
					)
				);
				continue;
			}

			processed++;

			const member = await this.resolveMember(interaction.guild, extractedValue, parseType);
			if (!member) {
				failed++;
				reportRows.push(this.buildReportRow(lineNumber, extractedValue, '', 'not-found', 'No matching guild member found'));
				lastProgressUpdateAt = await this.maybeUpdateProgress(
					interaction,
					processed,
					rawLines.length,
					successful,
					alreadyHadRole,
					failed,
					skipped,
					lastProgressUpdateAt
				);
				continue;
			}

			if (member.roles.cache.has(role.id)) {
				alreadyHadRole++;
				reportRows.push(this.buildReportRow(lineNumber, extractedValue, member.id, 'already-had-role', 'User already has the role'));
				lastProgressUpdateAt = await this.maybeUpdateProgress(
					interaction,
					processed,
					rawLines.length,
					successful,
					alreadyHadRole,
					failed,
					skipped,
					lastProgressUpdateAt
				);
				continue;
			}

			try {
				await member.roles.add(role, `Bulk role assignment by ${interaction.user.tag}`);
				successful++;
				reportRows.push(this.buildReportRow(lineNumber, extractedValue, member.id, 'success', 'Role assigned'));
			} catch (error) {
				failed++;
				this.container.logger.error({ error, memberId: member.id, roleId: role.id }, '[BulkRoleAssign] Failed to add role');
				reportRows.push(
					this.buildReportRow(lineNumber, extractedValue, member.id, 'error', 'Failed to assign role (permissions or hierarchy)')
				);
			}

			lastProgressUpdateAt = await this.maybeUpdateProgress(
				interaction,
				processed,
				rawLines.length,
				successful,
				alreadyHadRole,
				failed,
				skipped,
				lastProgressUpdateAt
			);
		}

		const reportCsv = this.buildCsvReport(reportRows);
		const summary = [
			`Bulk role assignment complete for <@&${role.id}>.`,
			`Processed: **${processed}**`,
			`Assigned: **${successful}**`,
			`Already had role: **${alreadyHadRole}**`,
			`Failed: **${failed}**`,
			`Skipped: **${skipped}**`
		].join('\n');

		return interaction.editReply({
			content: summary,
			files: [{ attachment: Buffer.from(reportCsv, 'utf8'), name: `bulk-role-assignment-report-${Date.now()}.csv` }]
		});
	}

	private isSupportedFile(name: string | null, contentType: string | null) {
		const normalizedName = (name ?? '').toLowerCase();
		if (normalizedName.endsWith('.txt') || normalizedName.endsWith('.csv')) return true;
		return contentType === 'text/plain' || contentType === 'text/csv' || contentType === 'application/vnd.ms-excel';
	}

	private extractIdentifier(line: string, parseType: ParseType): string | null {
		if (parseType === 'user-id') {
			const tokens = line.split(',').map((token) => token.trim());
			for (const token of tokens) {
				const id = this.extractUserId(token);
				if (id) return id;
			}
			return this.extractUserId(line);
		}

		const username = line.includes(',') ? line.split(',')[0] : line;
		const cleaned = username
			.trim()
			.replace(/^"+|"+$/g, '')
			.replace(/^@/, '');
		return cleaned.length > 0 ? cleaned : null;
	}

	private extractUserId(value: string): string | null {
		const match = value.match(USER_ID_REGEX);
		return match ? match[0] : null;
	}

	private async resolveMember(guild: Command.ChatInputCommandInteraction['guild'], input: string, parseType: ParseType) {
		if (!guild) return null;

		if (parseType === 'user-id') {
			try {
				return await guild.members.fetch(input);
			} catch {
				return null;
			}
		}

		const loweredInput = input.toLowerCase();
		const cached = guild.members.cache.find((member) => this.isUsernameMatch(member, loweredInput));
		if (cached) return cached;

		try {
			const fetched = await guild.members.fetch({ query: input, limit: 100 });
			return fetched.find((member) => this.isUsernameMatch(member, loweredInput)) ?? null;
		} catch {
			return null;
		}
	}

	private isUsernameMatch(member: GuildMember, loweredInput: string) {
		return (
			member.user.username.toLowerCase() === loweredInput ||
			member.displayName.toLowerCase() === loweredInput ||
			(member.user.globalName?.toLowerCase() ?? '') === loweredInput
		);
	}

	private async maybeUpdateProgress(
		interaction: Command.ChatInputCommandInteraction,
		processed: number,
		totalLines: number,
		successful: number,
		alreadyHadRole: number,
		failed: number,
		skipped: number,
		lastProgressUpdateAt: number
	): Promise<number> {
		const now = Date.now();
		if (now - lastProgressUpdateAt < MAX_PROGRESS_UPDATE_INTERVAL_MS) return lastProgressUpdateAt;

		await interaction.editReply(
			`⏳ Processing file... ${processed}/${totalLines} processed | ✅ ${successful} assigned | ℹ️ ${alreadyHadRole} already had role | ❌ ${failed} failed | ⏭️ ${skipped} skipped`
		);
		return now;
	}

	private buildReportRow(line: number, input: string, resolvedUserId: string, status: AssignmentStatus, message: string): AssignmentReportRow {
		return { line, input, resolvedUserId, status, message };
	}

	private buildCsvReport(rows: AssignmentReportRow[]) {
		const header = ['line', 'input', 'resolved_user_id', 'status', 'message'];
		const csvLines = [header.map((value) => this.escapeCsv(value)).join(',')];

		for (const row of rows) {
			csvLines.push(
				[
					this.escapeCsv(row.line.toString()),
					this.escapeCsv(row.input),
					this.escapeCsv(row.resolvedUserId),
					this.escapeCsv(row.status),
					this.escapeCsv(row.message)
				].join(',')
			);
		}

		return csvLines.join('\n');
	}

	private escapeCsv(value: string) {
		const normalized = value.replace(/"/g, '""');
		if (/[",\n]/.test(normalized)) {
			return `"${normalized}"`;
		}
		return normalized;
	}
}
