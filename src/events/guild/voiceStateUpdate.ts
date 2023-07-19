import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

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

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.VoiceKick,
                limit: guildData.settings.voiceKickLimitCount,
                time: guildData.settings.voiceKickLimitTime,
                canCheck: safe.includes(SafeFlags.VoiceKick),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Kullanıcıyı Sesten Atma`,
            });
            if (limit) {
                if (newState.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('bağlantı kesme')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    newState.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            if (newState.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const memberName = `${newState} (${inlineCode(newState.id)})`;
                const action = safe.length ? 'keserek limite ulaştı' : 'kesti';
                newState.guild.publicUpdatesChannel.send({
                    content: roleMention(newState.guild.id),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${memberName} adlı kullanıcının ses bağlantısını ${action} ve yasaklandı.`,
                                safe.includes(SafeFlags.General)
                                    ? [
                                          '# Limite Yakalanmadan Önceki İşlemleri',
                                          codeBlock('yaml', limit.operations.map((o, i) => `${i++}. ${o}`).join('\n')),
                                      ].join('\n')
                                    : undefined,
                            ].join('\n'),
                        ),
                    ],
                });
            }
        } catch (error) {
            console.error('Voice Kick Error:', error);
        }
    },
};

export default VoiceStateUpdate;
