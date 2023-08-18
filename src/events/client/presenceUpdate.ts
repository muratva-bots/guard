import { GuildModel } from '@/models';
import { SafeFlags } from '@/enums';
import { EmbedBuilder, Events, TextChannel, codeBlock, inlineCode } from 'discord.js';

const PresenceUpdate: Guard.IEvent<Events.PresenceUpdate> = {
    name: Events.PresenceUpdate,
    execute: async (client, oldPresence, newPresence) => {
        if (
            newPresence.user.bot ||
            (oldPresence &&
                newPresence.status &&
                oldPresence.status === newPresence.status &&
                oldPresence.clientStatus === newPresence.clientStatus)
        )
            return;

        const guild = client.guilds.cache.get(client.config.GUILD_ID);
        if (!guild) return;

        const guildData = client.servers.get(guild.id);
        if (!guildData || (!guildData.web && !guildData.offline)) return;
        
        const staffMember = newPresence.guild.members.cache.get(newPresence.member.id);
        const safe = [
            ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
            ...(client.safes.get(newPresence.member.id) || []),
        ].flat(1);
        if (safe.includes(SafeFlags.Full)) return;

        const member = newPresence.member;
        const staffData = client.staffs.get(member.id);
        const isWeb = guildData.web && member.presence?.clientStatus.web;
        const isOffline = guildData.offline && member.presence?.status === 'offline';

        if (
            !staffData &&
            (isWeb || isOffline) &&
            client.utils.dangerPerms.some((perm) => newPresence.member.permissions.has(perm))
        ) {
            const dangerRoleIds = member.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms)).map((r) => r.id);
            client.staffs.set(member.id, dangerRoleIds);
            member.roles.remove(dangerRoleIds);
            const channel = guild.channels.cache.find((c) => c.name === 'guard-log') as TextChannel;

            if (channel) {
                channel.send({
                    embeds: [
                        new EmbedBuilder({
                            color: client.utils.getRandomColor(),
                            timestamp: Date.now(),
                            description: [
                                `${member} (${inlineCode(member.id)}) adlı kullanıcı ${
                                    member.presence?.clientStatus.web
                                        ? 'internet sitesinden giriş yaptığı'
                                        : 'çevrimdışı olduğu'
                                } için yetkileri çekildi.`,
                                codeBlock(
                                    'yaml',
                                    [
                                        '# Çekilen Rolleri',
                                        member.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms))
                                            .map((r) => `→ ${r.name}`)
                                            .join('\n'),
                                    ].join('\n'),
                                ),
                            ].join('\n'),
                        }),
                    ],
                });
            }
        }

        if (staffData && (!isOffline || !isWeb)) {
            member.roles.add([...member.roles.cache.filter((r) => r.managed && !r.permissions.any(client.utils.dangerPerms)).map((r) => r.id), ...staffData]);
            client.staffs.delete(member.id);
        }

        await GuildModel.updateOne(
            { id: guild.id },
            { $set: { 'guard.staffs': Array.from(client.staffs).map((s) => ({ id: s[0], roles: s[1] })) } },
            { upsert: true },
        );
    },
};

export default PresenceUpdate;
