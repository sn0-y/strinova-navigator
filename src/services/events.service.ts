import { container } from '@sapphire/framework';
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

export async function getActiveEvent(channelId: string) {
	const eventDataRaw = await container.redis.get(`event:active:${channelId}`);
	if (!eventDataRaw) return;

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