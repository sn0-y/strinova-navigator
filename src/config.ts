// Server Specific Configurations

interface config {
	prefix: string;
	guildId: string;
	roles: {
		staff: string;
		leadmod: string;
	};
	channels: {
		eventNotifications: string;
		modCasesLog: string;
		modmailLog: string;
	};
}

export type ActivityWeightClass = 'HIGH' | 'MEDIUM' | 'LOW';

export const WEIGHT_BUDGETS: Record<ActivityWeightClass, number> = {
	HIGH: 0.6, // up to 60% of total score
	MEDIUM: 0.25, // up to 25% of total score
	LOW: 0.15 // up to 15% of total score
};

export const CATEGORY_CONFIG = {
	modChatMessages: { weightClass: 'MEDIUM' as ActivityWeightClass, pointsPerUnit: 1 },
	publicChatMessages: { weightClass: 'LOW' as ActivityWeightClass, pointsPerUnit: 0.5 },
	voiceChatMinutes: { weightClass: 'LOW' as ActivityWeightClass, pointsPerUnit: 0.25 },

	modActionsTaken: { weightClass: 'HIGH' as ActivityWeightClass, pointsPerUnit: 10 }, // Modmail
	casesHandled: { weightClass: 'HIGH' as ActivityWeightClass, pointsPerUnit: 20 } // Warns/Kicks/Bans
};

const production: config = {
	prefix: '&',
	guildId: '1182952140684136470',
	roles: {
		staff: '1182953334492106772',
		leadmod: '1182953730572820562'
	},
	channels: {
		eventNotifications: '1307316881492938822',
		modmailLog: '1296899264789745704',
		modCasesLog: '1307316835397406831'
	}
};

const development: config = {
	prefix: '&',
	guildId: '1460717170064359457',
	roles: {
		staff: '1460717636018110550',
		leadmod: '1474998553515393189'
	},
	channels: {
		eventNotifications: '1475032816524984340',
		modmailLog: '1475032816524984340',
		modCasesLog: '1475032816524984340'
	}
};

export const isProduction = process.env.NODE_ENV === 'production';

export const config: config = isProduction ? production : development;
