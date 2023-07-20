import { LimitFlags, OperationFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, Guild, inlineCode } from 'discord.js';

const ChannelCreate: Guard.IEvent = {
    name: Events.ChannelCreate,
    execute: async (client, [channel]: Guard.ArgsOf<Events.ChannelCreate>) => {
        try {
            if (channel.isDMBased() || channel.isThread()) return;

            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.channel) return;

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
                limit: guildData.settings.channelLimitCount,
                time: guildData.settings.channelLimitTime,
                canCheck: safe.includes(SafeFlags.Channel),
                operation: OperationFlags.ChannelCreate,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: channel.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'rol',
                });
                return;
            }

            await channel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(channel.guild);
            await client.utils.setDanger(channel.guildId, true);
            if (channel.deletable) await channel.delete();

            client.utils.sendPunishLog({
                guild: channel.guild,
                action: safe.length ? 'oluşturarak limite ulaştı' : 'oluşturdu',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${channel.name} (${inlineCode(channel.id)})`,
                targetType: 'kanalı',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Channel Create Error:', error);
        }
    },
};

export default ChannelCreate;

async function getEntry(guild: Guild) {
    try {
        const now = Date.now();
        const channelEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate })
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
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelOverwriteCreate })
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
