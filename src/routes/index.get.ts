import { Route } from '@sapphire/plugin-api';

export class UserRoute extends Route {
	public override run(_request: Route.Request, response: Route.Response) {
		response.json({ message: 'The bot is online!' });
	}
}
