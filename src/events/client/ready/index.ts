import { SafeFlags } from '@/enums';
import { GuildModel } from '@/models';
import { Events, Team } from 'discord.js';
import presenceGuard from './presenceGuard';

const Ready: Guard.IEvent<Events.ClientReady> = {
    name: Events.ClientReady,
    execute: async (client) => {
        const guild = client.guilds.cache.get(client.config.GUILD_ID);
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

        presenceGuard(client, guild);

        setInterval(
            async () => {
                if (client.utils.danger === false) await client.utils.getBackup(guild);
            },
            1000 * 60 * 60,
        );

        const document =
            (await GuildModel.findOne({ id: guild.id })) ||
            (await GuildModel.create({ id: guild.id }));
        client.servers.set(guild.id, { ...(document.guard) });

        client.utils.danger = document.guard.danger;

        const staffs = document.guard.staffs || [];
        staffs.forEach((s) => client.staffs.set(s.id, s.roles));

        const safes = document.guard.safes || [];
        safes.forEach((s) => client.safes.set(s.id, s.allow));

        const guildEventEmitter = GuildModel.watch([{ $match: { 'fullDocument.id': guild.id } }], {
            fullDocument: 'updateLookup',
        });
        guildEventEmitter.on('change', ({ fullDocument }) =>
            client.servers.set(guild.id, { ...(fullDocument.guard) })
        );
    },
};

export default Ready;
