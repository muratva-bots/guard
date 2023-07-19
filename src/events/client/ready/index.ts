import { GuildModel, IGuild } from '@guard-bot/models';
import checkOfflineAndWeb from './checkOfflineAndWeb';
import { Events, Team } from 'discord.js';
import { SafeFlags } from '@guard-bot/enums';

const Ready: Guard.IEvent = {
    name: Events.ClientReady,
    execute: async (client) => {
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.log('Guild is undefined.');
            return;
        }

        client.guildSettings = {
            banner: guild.bannerURL({ size: 4096, forceStatic: true }),
            icon: guild.iconURL({ size: 4096, forceStatic: true }),
            name: guild.name,
        };

        await guild.members.fetch();

        console.log(`${client.user.tag} is online!`);

        await client.application.fetch();
        const ownerID =
            client.application.owner instanceof Team
                ? (client.application.owner as Team).ownerId
                : client.application.owner.id;
        client.safes.set(ownerID, [SafeFlags.Full]);

        checkOfflineAndWeb(client, guild);
        setInterval(() => checkOfflineAndWeb(client, guild), 1000 * 30);

        setInterval(
            async () => {
                if (client.utils.danger === false) await client.utils.getBackup();
            },
            1000 * 60 * 60,
        );

        const document = (await GuildModel.findOne({ id: guild.id })) || (await GuildModel.create({ id: guild.id }));
        client.servers.set(guild.id, { settings: { guard: {}, ...(document.settings || {}) } });

        client.utils.danger = document.settings.guard.danger;

        const staffs = document.settings.guard.staffs || [];
        staffs.forEach((s) => client.staffs.set(s.id, s.roles));

        const safes = document.settings.guard.safes || [];
        safes.forEach((s) => client.safes.set(s.id, s.allow));

        const guildEventEmitter = GuildModel.watch([{ $match: { 'fullDocument.id': guild.id } }], {
            fullDocument: 'updateLookup',
        });
        guildEventEmitter.on('change', ({ fullDocument }: { fullDocument: IGuild }) =>
            client.servers.set(guild.id, { settings: { guard: {}, ...(fullDocument.settings || {}) } }),
        );
    },
};

export default Ready;
