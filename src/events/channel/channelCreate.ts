import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const ChannelCreate: Guard.IEvent = {
    name: Events.ChannelCreate,
    execute: async (client, [channel]: Guard.ArgsOf<Events.ChannelCreate>) => {
        try {
            if (channel.isDMBased() || channel.isThread()) return;

            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.channel) return;

            const entry = await channel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Channel,
                limit: guildData.settings.channelLimitCount,
                time: guildData.settings.channelLimitTime,
                canCheck: safe.includes(SafeFlags.Channel),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Kanal Oluşturma`,
            });
            if (limit) {
                if (channel.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('kanal')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    channel.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await channel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(channel.guildId, true);
            if (channel.deletable) await channel.delete();

            if (channel.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const channelName = `${channel} (${inlineCode(channel.id)})`;
                const action = safe.length ? 'oluşturarak limite ulaştı' : 'oluşturdu';
                channel.guild.publicUpdatesChannel.send({
                    content: roleMention(channel.guildId),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${channelName} adlı kanalı ${action} ve yasaklandı.`,
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
            console.error('Channel Create Error:', error);
        }
    },
};

export default ChannelCreate;
