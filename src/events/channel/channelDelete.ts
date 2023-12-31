import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, Guild, inlineCode } from 'discord.js';

const ChannelDelete: Guard.IEvent<Events.ChannelDelete> = {
    name: Events.ChannelDelete,
    execute: async (client, channel) => {
        try {
            if (channel.isDMBased() || channel.isThread()) return;

            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.channel) return;

            const entry = await getEntry(channel.guild);
            if (!entry) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
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
                operation: OperationFlags.ChannelDelete,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: channel.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'kanal',
                });
                return;
            }

            await channel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(channel.guild);
            await client.utils.setDanger(channel.guildId, true);

            client.utils.sendPunishLog({
                guild: channel.guild,
                action: safe.length ? 'silerek limite ulaştı' : 'sildi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${channel.name} (${inlineCode(channel.id)})`,
                targetType: 'kanalı',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Channel Delete Error:', error);
        }
    },
};

export default ChannelDelete;

async function getEntry(guild: Guild) {
    try {
        const now = Date.now();
        const channelEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete })
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
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelOverwriteDelete })
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
