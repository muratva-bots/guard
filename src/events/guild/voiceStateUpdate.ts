import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const VoiceStateUpdate: Guard.IEvent = {
    name: Events.VoiceStateUpdate,
    execute: async (client, [, newState]: Guard.ArgsOf<Events.VoiceStateUpdate>) => {
        try {
            if (newState.channelId) return;

            const guildData = client.servers.get(newState.guild.id);
            if (!guildData || !guildData.settings.voiceKick) return;

            const entry = await newState.guild
                .fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberDisconnect,
                })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = newState.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.VoiceKick,
                limit: guildData.settings.voiceKickLimitCount,
                time: guildData.settings.voiceKickLimitTime,
                canCheck: safe.includes(SafeFlags.VoiceKick),
            });
            if (limit) {
                if (newState.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('bağlantı kesme')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    newState.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            if (newState.guild.publicUpdatesChannel) {
                const member = bold(newState.member.user.username);
                const action = safe.length ? 'attı limite ulaştı' : 'attı';
                newState.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${member} adlı kullanıcısına sağ tık bağlantı kes ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Voice Kick Error:', error);
        }
    },
};

export default VoiceStateUpdate;
