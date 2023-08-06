import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { ChannelModel } from '@/models';
import { AuditLogEvent, Events, Guild, GuildChannel, inlineCode } from 'discord.js';

const ChannelUpdate: Guard.IEvent<Events.ChannelUpdate> = {
    name: Events.ChannelUpdate,
    execute: async (client, oldChannel, newChannel) => {
        try {
            if (oldChannel.isDMBased() || oldChannel.isThread()) return;

            const guildData = client.servers.get(oldChannel.guildId);
            if (!guildData || !guildData.channel) return;

            const entry = await getEntry((newChannel as GuildChannel).guild);
            if (!entry) return;

            const staffMember = oldChannel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Channel,
                limit: guildData.channelLimitCount,
                time: guildData.channelLimitTime,
                canCheck: safe.includes(SafeFlags.Channel),
                operation: OperationFlags.ChannelUpdate,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: (newChannel as GuildChannel).guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'kanal',
                });
                return;
            }

            await oldChannel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(oldChannel.guild);
            await client.utils.setDanger(oldChannel.guildId, true);

            const data = await ChannelModel.findOne({ id: newChannel.id });
            if (data) {
                (newChannel as GuildChannel).edit({
                    name: data.name,
                    nsfw: data.nsfw,
                    parent: data.parent,
                    topic: data.topic,
                    position: data.position,
                    userLimit: data.userLimit,
                });
                data.permissionOverwrites
                    .filter(p => (newChannel as GuildChannel).guild.roles.cache.has(p.id) || (newChannel as GuildChannel).guild.members.cache.has(p.id))
                    .forEach((p) =>
                        (newChannel as GuildChannel).permissionOverwrites.create(p.id, p.permissions),
                    );
            }

            client.utils.sendPunishLog({
                guild: oldChannel.guild,
                action: safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${oldChannel.name} (${inlineCode(oldChannel.id)})`,
                targetType: 'kanalı',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Channel Update Error:', error);
        }
    },
};

export default ChannelUpdate;

async function getEntry(guild: Guild) {
    try {
        const now = Date.now();
        const channelEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate })
            .then((audit) => audit.entries.first());
        if (
            channelEntry &&
            channelEntry.executor &&
            !channelEntry.executor.bot &&
            5000 > now - channelEntry.createdTimestamp
        ) {
            return channelEntry;
        }

        const overwriteEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelOverwriteUpdate })
            .then((audit) => audit.entries.first());
        if (
            overwriteEntry &&
            overwriteEntry.executor &&
            !overwriteEntry.executor.bot &&
            5000 > now - overwriteEntry.createdTimestamp
        ) {
            return overwriteEntry;
        }

        return null;
    } catch (error) {
        console.error('getEntry Error:', error);
        return null;
    }
}
