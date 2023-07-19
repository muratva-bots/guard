import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const GuildStickerUpdate: Guard.IEvent = {
    name: Events.GuildStickerUpdate,
    execute: async (client, [sticker]: Guard.ArgsOf<Events.GuildStickerUpdate>) => {
        try {
            const guildData = client.servers.get(sticker.guild.id);
            if (!guildData || !guildData.settings.sticker) return;

            const entry = await sticker.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = sticker.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Sticker,
                limit: guildData.settings.stickerLimitCount,
                time: guildData.settings.stickerLimitTime,
                canCheck: safe.includes(SafeFlags.Sticker),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Çıkartma Güncelleme`,
            });
            if (limit) {
                if (sticker.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('çıkartma')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    sticker.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await sticker.edit({
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description,
            });

            if (sticker.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const stickerName = `${sticker.name} (${inlineCode(sticker.id)})`;
                const action = safe.length ? 'güncelledi limite ulaştı' : 'güncelledi';
                sticker.guild.publicUpdatesChannel.send({
                    content: roleMention(sticker.guildId),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${stickerName} adlı çıkartmayı ${action} ve yasaklandı.`,
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
            console.error('Guild Sticker Update Error:', error);
        }
    },
};

export default GuildStickerUpdate;
