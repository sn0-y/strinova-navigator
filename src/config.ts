// Server Specific Configurations

interface config {
	prefix: string;
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

const production: config = {
	prefix: '&',
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

const isProduction = process.env.NODE_ENV === 'production';

export const config: config = isProduction ? production : development;