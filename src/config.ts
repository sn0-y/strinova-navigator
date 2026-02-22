// Server Specific Configurations

interface config {
	prefix: string;
	roles: {
		staff: string;
		leadmod: string;
	};
	channels: {
		eventNotifications: string;
	};
}

const production: config = {
	prefix: '&',
	roles: {
		staff: '1182953334492106772',
		leadmod: '1182953730572820562'
	},
	channels: {
		eventNotifications: '1307316881492938822'
	}
};

const development: config = {
	prefix: '&',
	roles: {
		staff: '1182953334492106772',
		leadmod: '1182953730572820562'
	},
	channels: {
		eventNotifications: '1307316881492938822'
	}
};

const isProduction = process.env.NODE_ENV === 'production';

export const config: config = isProduction ? production : development;