import { SafeFlags } from '@/enums';
import { GuildModel, IGuild } from '@/models';
import { Events, Team } from 'discord.js';
import checkOfflineAndWeb from './checkOfflineAndWeb';

const Ready: Guard.IEvent = {
    name: Events.ClientReady,
    execute: async (client) => {
        const guild = client.guilds.cache.get('1130942265020383373');
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
                if (client.utils.danger === false) await client.utils.getBackup(guild);
            },
            1000 * 60 * 60,
        );

        const document =
            (await GuildModel.findOne({ id: guild.id })) ||
            (await GuildModel.create({ id: guild.id, settings: { guard: {} } }));
        client.servers.set(guild.id, { settings: { ...((document.settings || {}).guard || {}) } });

        client.utils.danger = document.settings.guard.danger;

        const staffs = document.settings.guard.staffs || [];
        staffs.forEach((s) => client.staffs.set(s.id, s.roles));

        const safes = document.settings.guard.safes || [];
        safes.forEach((s) => client.safes.set(s.id, s.allow));

        const guildEventEmitter = GuildModel.watch([{ $match: { 'fullDocument.id': guild.id } }], {
            fullDocument: 'updateLookup',
        });
        guildEventEmitter.on('change', ({ fullDocument }: { fullDocument: IGuild }) =>
            client.servers.set(guild.id, { settings: { ...((fullDocument.settings || {}).guard || {}) } }),
        );
    },
};

export default Ready;
