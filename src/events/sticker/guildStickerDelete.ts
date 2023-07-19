import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const GuildStickerDelete: Guard.IEvent = {
    name: Events.GuildStickerDelete,
    execute: async (client, [sticker]: Guard.ArgsOf<Events.GuildStickerDelete>) => {
        try {
            const guildData = client.servers.get(sticker.guild.id);
            if (!guildData || !guildData.settings.sticker) return;

            const entry = await sticker.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerDelete })
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
                })} -> Çıkartma Silme`,
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

            await sticker.guild.stickers.create({
                file: sticker.url,
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description,
                reason: 'Çıkartma silindiği için yeniden oluşturuldu!',
            });

            if (sticker.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const stickerName = `${sticker.name} (${inlineCode(sticker.id)})`;
                const action = safe.length ? 'silerek limite ulaştı' : 'sildi';
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
            console.error('Guild Sticker Delete Error:', error);
        }
    },
};

export default GuildStickerDelete;
