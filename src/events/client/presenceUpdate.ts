import { GuildModel } from "@/models";
import { EmbedBuilder, Events, codeBlock, inlineCode } from "discord.js";

const PresenceUpdate: Guard.IEvent<Events.PresenceUpdate> = {
    name: Events.PresenceUpdate,
    execute: async (client, oldPresence, newPresence) => {
        if (
            newPresence.user.bot ||
            (
                oldPresence.status &&
                newPresence.status &&
                oldPresence.status === newPresence.status &&
                oldPresence.clientStatus === newPresence.clientStatus
            )
        ) return;

        const guild = client.guilds.cache.get(client.config.GUILD_ID);
        if (!guild) return;

        const guildData = client.servers.get(guild.id);
        if (!guildData || (!guildData.web && !guildData.offline)) return;

        const member = newPresence.member;
        const staffData = client.staffs.get(member.id);
        const isWeb = guildData.web && member.presence?.clientStatus.web;
        const isOffline = guildData.offline && member.presence?.status === 'offline';

        if (!staffData && (isWeb || isOffline) && client.utils.dangerPerms.some((perm) => newPresence.member.permissions.has(perm))) {
            client.staffs.set(
                member.id,
                member.roles.cache.filter(r => !r.managed && r.id !== guild.id).map((r) => r.id),
            );
            member.roles.set(member.roles.cache.filter((r) => r.managed));

            if (guild.publicUpdatesChannel) {
                guild.publicUpdatesChannel.send({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            timestamp: Date.now(),
                            description: [
                                `${member} (${inlineCode(member.id)}) adlı kullanıcı ${member.presence?.clientStatus.web
                                    ? 'internet sitesinden giriş yaptığı'
                                    : 'çevrimdışı olduğu'
                                } için yetkileri çekildi.`,
                                codeBlock(
                                    'yaml',
                                    [
                                        '# Çekilen Rolleri',
                                        member.roles.cache
                                            .filter((r) => !r.managed && r.id !== guild.id)
                                            .map((r) => `→ ${r.name}`)
                                            .join('\n'),
                                    ].join('\n'),
                                ),
                            ].join('\n')
                        })
                    ],
                });
            }
        }

        if (staffData && (!isOffline || !isWeb)) {
            console.log("AMINA KODUĞUMUN GUARDI", staffData)
            member.roles.set([...member.roles.cache.filter(r => r.managed).map(r => r.id), ...staffData]);
            client.staffs.delete(member.id);
        }

        await GuildModel.updateOne(
            { id: guild.id },
            { $set: { 'guard.staffs': Array.from(client.staffs).map((s) => ({ id: s[0], roles: s[1] })) } },
            { upsert: true }
        );
    }
}

export default PresenceUpdate;
