import { Client, Intents, Permissions } from 'discord.js-selfbot-v13';
import config from '../../config.json';

export class SelfClient extends Client {
    constructor() {
        super({
            intents: [Intents.FLAGS.GUILDS],
            presence: {
                status: 'online',
            },
        });
    }

    start() {
        return new Promise<boolean>((resolve) => {
            this.login(config.SELF_TOKEN)
                .then(() => {
                    this.on('ready', async () => {
                        const guild = this.guilds.cache.get(config.GUILD_ID);
                        if (!guild) {
                            console.log('[SELF-BOT]: Guild is undefined.');
                            this.destroy();
                            resolve(false);
                            return;
                        }

                        if (guild.members.me.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                            console.log('[SELF-BOT]: No permission.');
                            this.destroy();
                            resolve(false);
                            return;
                        }

                        resolve(true);

                        setInterval(() => {
                            if (config.GUILD_URL !== guild.vanityURLCode) guild.setVanityCode(config.GUILD_URL);
                        }, 1000 * 4);
                    });
                })
                .catch(() => {
                    console.log('[SELF-BOT]: Token is invalid.');
                    resolve(false);
                });
        });
    }
}
