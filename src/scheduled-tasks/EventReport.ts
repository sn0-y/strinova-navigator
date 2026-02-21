import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { config } from 'config';
import { Channel } from 'discord.js';
import { sendReport } from 'services/events.service';

interface ReportPayload {
	eventId: number;
	eventName: string;
}

export class EventReport extends ScheduledTask {
	public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
		super(context, {
			...options,
			name: 'eventReport'
		});
	}

	public async run(payload: ReportPayload) {
		this.container.logger.info(`Compiling report for Event ${payload.eventId}`);

		const channel = (await this.container.client.channels.fetch(config.channels.eventNotifications).catch(() => null)) as Channel | null;
		if (!channel?.isSendable()) return;

		return await sendReport(payload.eventId, config.channels.eventNotifications);
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		eventReport: ReportPayload;
	}
}
