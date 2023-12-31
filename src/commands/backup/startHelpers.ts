import { Client as Core } from '@/structures';
import { Client, GatewayIntentBits } from 'discord.js';

function startHelpers(client: Core) {
    console.log('The helpers is waking up.');

    const promises: Promise<Client>[] = [];
    for (const TOKEN of client.config.HELPER_TOKENS) {
        promises.push(
            new Promise<any>((resolve) => {
                const helperClient = new Client({
                    intents: [
                        GatewayIntentBits.Guilds,
                        GatewayIntentBits.GuildPresences,
                        GatewayIntentBits.GuildMembers,
                    ],
                });

                helperClient.on('ready', () => {
                    const guild = helperClient.guilds.cache.first();
                    if (!guild) {
                        console.log(`[HELPER-BOT]: ${helperClient.user.tag} is not in server!`);
                        helperClient.destroy();
                        return;
                    }

                    resolve(helperClient);
                });

                helperClient.on('rateLimit', (rateLimitData) => {
                    console.log(
                        `[HELPER-BOT]: ${helperClient.user.tag} rate limited caught. Retrying in ${Math.round(
                            rateLimitData.timeout / 1000,
                        )} seconds.`,
                    );
                });

                helperClient.login(TOKEN).catch(() => console.log(`[HELPER-BOT]: ${TOKEN} is not online.`));
            }),
        );
    }

    return Promise.all(promises);
}

export default startHelpers;
