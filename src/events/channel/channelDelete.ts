import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const ChannelDelete: Guard.IEvent = {
    name: Events.ChannelDelete,
    execute: async (client, [channel]: Guard.ArgsOf<Events.ChannelDelete>) => {
        try {
            if (channel.isDMBased() || channel.isThread()) return;

            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.channel) return;

            const entry = await channel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? (client.safes.find((_, k) => staffMember.roles.cache.get(k)) || []) : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Channel,
                limit: guildData.settings.channelLimitCount,
                time: guildData.settings.channelLimitTime,
                canCheck: safe.includes(SafeFlags.Channel),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Kanal Silme`,
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
            await client.utils.closePermissions();
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
