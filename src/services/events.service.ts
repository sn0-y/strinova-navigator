import { container } from '@sapphire/framework';
import { randomInt } from 'crypto';
import { prisma } from 'prisma';
import { Event } from 'prisma/generated/prisma/client';

export async function checkDuplicateEvent(channelId: string) {
	const event = await prisma.event.findFirst({
		where: {
			channelId: channelId,
			status: 'ACTIVE'
		}
	});

	return event;
}

export async function createEvent(channelId: string, eventName: string, requireAttachment: boolean, minCharacters: number) {
	const event = await prisma.event.create({
		data: {
			channelId: channelId,
			name: eventName,
			status: 'ACTIVE',
			requireAttachment: requireAttachment,
			minCharacters: minCharacters
		}
	});

	await container.redis.set(`event:active:${channelId}`, JSON.stringify(event));

	return event;
}

export async function getEvent(channelId: string) {
	const eventDataRaw = await container.redis.get(`event:active:${channelId}`);

	if (!eventDataRaw) {
		const event = await prisma.event.findFirst({
			where: {
				channelId: channelId
			}
		});

		if (!event) return null;

		if (event.status === 'ACTIVE') {
			await container.redis.set(`event:active:${channelId}`, JSON.stringify(event));
		}

		return event;
	}

	const eventData = JSON.parse(eventDataRaw) as Event;
	return eventData;
}

export async function generateSubmission(eventId: number, messageUrl: string, userId: string) {
	const submission = await prisma.participant.upsert({
		where: {
			userId_eventId: {
				eventId: eventId,
				userId: userId
			}
		},
		update: {
			submissionLink: messageUrl
		},
		create: {
			submissionLink: messageUrl,
			eventId: eventId,
			userId: userId
		}
	});

	return submission;
}

export async function endEvent(eventId: number, channelId: string) {
	try {
		await prisma.event.update({
			where: { id: eventId },
			data: { status: 'ENDED' }
		});

		await container.redis.del(`event:active:${channelId}`);

		return true;
	} catch (error) {
		container.logger.error(`Error ending event ${eventId}:`, error);

		return false;
	}
}

export async function pickWinners(eventId: number, winnerCount: number) {
	const participants = await prisma.participant.findMany({
		where: { eventId: eventId }
	});

	if (participants.length === 0) {
		container.logger.info(`Event ${eventId} ended with no participants.`);

		return { success: false, error: 'no_participants' };
	}

	container.logger.info(`Event ${eventId} ended with ${participants.length} participants.`);

	if (participants.length < winnerCount) {
		container.logger.info(
			`Event ${eventId} has ${participants.length} participants, which is less than the winner count of ${winnerCount}. No winners selected.`
		);

		return { success: false, error: 'insufficient_participants' };
	}

	const pool = participants.map((p) => p.userId);

	// Fisher–Yates shuffle to sample without replacement
	for (let i = pool.length - 1; i > 0; i--) {
		const j = randomInt(0, i + 1);
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}

	const winnerIds = pool.slice(0, winnerCount);

	const winnerData = winnerIds.map((userId) => ({
		userId: userId,
		eventId: eventId
	}));

	await prisma.winner.createMany({
		data: winnerData,
		skipDuplicates: true
	});

	return { success: true, winners: winnerIds };
}

export async function findWinner(winnerUserId: string, eventId: number) {
	const winner = await prisma.winner.findFirst({
		where: {
			userId: winnerUserId,
			eventId: eventId
		}
	});

	return winner;
}

export async function submitWinnerUid(winnerUserId: string, eventId: number, inGameUid: string) {
	if (!inGameUid || !/^\d{5,15}$/.test(inGameUid)) {
		return { success: false, error: 'Invalid UID format. Please ensure your UID only contains numbers and is between 5 and 15 digits long.' };
	}

	const winner = await prisma.winner.findFirst({
		where: {
			userId: winnerUserId,
			eventId: eventId
		}
	});

	if (!winner) return { success: false, error: 'You are not a winner for this event.' };

	try {
		await prisma.winner.update({
			where: { userId_eventId: { userId: winnerUserId, eventId: eventId } },
			data: { inGameUid, claimedAt: new Date() }
		});
	} catch (error: any) {
		if (error.code === 'P2002') {
			return { success: false, error: 'This UID has already been claimed for this event.' };
		}
		throw error;
	}

	return { success: true };
}

export async function compileEventReport(eventId: number) {
	const event = await prisma.event.findUnique({ where: { id: eventId } });
	if (!event || event.reportSent) return null;

	const winners = await prisma.winner.findMany({
		where: {
			eventId: eventId
		}
	});

	let csvContent = 'Discord ID,Strinova ID,Claimed At\n';
	let missingCount = 0;

	for (const winner of winners) {
		const uid = winner.inGameUid || 'MISSING';
		const date = winner.claimedAt ? winner.claimedAt.toISOString() : 'N/A';
		csvContent += `${winner.userId},${uid},${date}\n`;

		if (!winner.inGameUid) missingCount++;
	}

	return {
		csvContent,
		eventName: event.name,
		missingCount
	};
}

export async function sendReport(eventId: number, channelId: string) {
	const channel = await container.client.channels.fetch(channelId).catch(() => null);
	if (!channel?.isSendable()) {
		container.logger.error(`Unable to send event report for Event ${eventId} - channel ${channelId} is not sendable.`);
		return false;
	}

	const report = await compileEventReport(eventId);
	if (!report) {
		container.logger.error(`Unable to compile event report for Event ${eventId}.`);
		return false;
	}

	const attachment = {
		name: `event-${eventId}-report.csv`,
		attachment: Buffer.from(report.csvContent, 'utf-8')
	};

	await channel.send({
		content: `The event **${report.eventName}** has ended. Here is the report of winners. ${report.missingCount > 0 ? `There were ${report.missingCount} winners without an in-game UID.` : ''}`,
		files: [attachment]
	});

	await prisma.event.update({
		where: { id: eventId },
		data: { reportSent: true }
	});

	return true;
}

export async function reportSent(eventId: number) {
	const event = await prisma.event.findUnique({ where: { id: eventId } });
	return event?.reportSent || false;
}
