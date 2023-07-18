import {
	Client as Core,
	GatewayIntentBits,
	ActivityType,
	Collection,
} from "discord.js";
import { connect } from "mongoose";

import { Utils } from "./Utils";
import config from "../../config.json";
import { IGuild } from "@guard-bot/models";

export class Client extends Core {
	commands = new Collection<string, Guard.ICommand>();
	safes = new Collection<string, Guard.TSafe[]>();
	servers = new Collection<string, IGuild>();
	staffs = new Collection<string, string[]>();
	limits = new Collection<string, Guard.ILimit>();
	guildSettings = {
		name: "",
		banner: "",
		icon: ""
	};
	utils = new Utils(this);
	config = config;

	constructor() {
		super({
			intents: Object.keys(GatewayIntentBits).map(
				(intent) => GatewayIntentBits[intent],
			),
			presence: {
				activities: [
					{ name: config.STATUS, type: ActivityType.Watching },
				],
			},
		});
	}

	async connect() {
		console.log("Loading bot events...");
		await this.utils.loadEvents();

		console.log("Loading bot commands...");
		await this.utils.loadCommands();

		console.log("Connecting mongo...");
		await connect(this.config.MONGO_URL);

		await this.login(this.config.MAIN_TOKEN);
	}
}
