import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const GuildBanAdd: Guard.IEvent = {
    name: Events.GuildBanAdd,
    execute: async (client, [ban]: Guard.ArgsOf<Events.GuildBanAdd>) => {
        try {
            const guildData = client.servers.get(ban.guild.id);
            if (!guildData || !guildData.settings.banKick) return;

            const entry = await ban.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = ban.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.settings.banKickLimitCount,
                time: guildData.settings.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Üye Yasaklama`,
            });
            if (limit) {
                if (ban.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('yasaklama & atma')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    ban.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await ban.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(ban.guild.id, true);
            await ban.guild.members.unban(entry.executor.id);

            if (ban.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const memberName = `${ban.user} (${inlineCode(ban.user.id)})`;
                const action = safe.length ? 'yasaklayarak limite ulaştı' : 'yasakladı';
                ban.guild.publicUpdatesChannel.send({
                    content: roleMention(ban.guild.id),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${memberName} adlı kullanıcıyı ${action} ve yasaklandı.`,
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
            console.error('Guild Ban Add Error:', error);
        }
    },
};

export default GuildBanAdd;
