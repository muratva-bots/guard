import { ActivityType, Collection, Client as Core, GatewayIntentBits } from 'discord.js';
import { connect } from 'mongoose';

import { SafeFlags } from '@/enums';
import { GuardClass } from '@/models';
import config from '../../config.json';
import { Utils } from './Utils';

export class Client extends Core {
    commands = new Collection<string, Guard.ICommand>();
    safes = new Collection<string, SafeFlags[]>();
    servers = new Collection<string, GuardClass>();
    staffs = new Collection<string, string[]>();
    limits = new Collection<string, Guard.ILimit>();
    guildSettings = {
        name: '',
        banner: '',
        icon: '',
    };
    utils = new Utils(this);
    config = config;

    constructor() {
        super({
            intents: Object.keys(GatewayIntentBits).map((intent) => GatewayIntentBits[intent]),
            presence: {
                activities: [{ name: config.STATUS, type: ActivityType.Watching }],
            },
        });
    }

    async connect() {
        console.log('[MAIN-BOT]: Loading bot commands...');
        await this.utils.loadCommands();

        console.log('[MAIN-BOT]: Loading bot events...');
        await this.utils.loadEvents();

        console.log('[MAIN-BOT]: Connecting mongo...');
        await connect(this.config.MONGO_URL);

        await this.login(this.config.MAIN_TOKEN);
    }
}
