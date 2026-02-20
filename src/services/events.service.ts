import { container } from "@sapphire/framework";
import { prisma } from "prisma";

export async function checkDuplicateEvent(channelId: string) {
    const event = await prisma.event.findFirst({
        where: {
            channelId: channelId,
            status: 'ACTIVE'
        }
    })

    return event;
}

export async function createEvent(channelId: string, eventName: string) {
    const event = await prisma.event.create({
        data: {
            channelId: channelId,
            name: eventName,
            status: 'ACTIVE'
        }
    })

    await container.redis.set(`event:active:${channelId}`, event.id.toString());

    return event;
}