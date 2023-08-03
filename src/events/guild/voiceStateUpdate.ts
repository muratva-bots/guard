import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const VoiceStateUpdate: Guard.IEvent<Events.VoiceStateUpdate> = {
    name: Events.VoiceStateUpdate,
    execute: async (client, _, newState) => {
        try {
            if (newState.channelId) return;

            const guildData = client.servers.get(newState.guild.id);
            if (!guildData || !guildData.voiceKick) return;

            const entry = await newState.guild
                .fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberDisconnect,
                })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = newState.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.VoiceKick,
                limit: guildData.voiceKickLimitCount,
                time: guildData.voiceKickLimitTime,
                canCheck: safe.includes(SafeFlags.VoiceKick),
                operation: OperationFlags.VoiceKick,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: newState.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'bağlantı kesme',
                });
                return;
            }

            if (newState.guild.publicUpdatesChannel) {
                client.utils.sendPunishLog({
                    guild: newState.guild,
                    action: safe.length ? 'keserek limite ulaştı' : 'kesti',
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    targetName: `${newState.member} (${inlineCode(newState.id)})`,
                    targetType: 'ses bağlantısını',
                    isSafe: safe.length > 0,
                    operations: limit ? limit.operations : [],
                });
            }
        } catch (error) {
            console.error('Voice Kick Error:', error);
        }
    },
};

export default VoiceStateUpdate;
