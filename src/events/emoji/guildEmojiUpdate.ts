import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const GuildEmojiUpdate: Guard.IEvent = {
    name: Events.GuildEmojiUpdate,
    execute: async (client, [oldEmoji, newEmoji]: Guard.ArgsOf<Events.GuildEmojiUpdate>) => {
        try {
            const guildData = client.servers.get(oldEmoji.guild.id);
            if (!guildData || !guildData.settings.emoji) return;

            const entry = await oldEmoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = oldEmoji.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Emoji,
                limit: guildData.settings.emojiLimitCount,
                time: guildData.settings.emojiLimitTime,
                canCheck: safe.includes(SafeFlags.Emoji),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Emoji Güncelleme`,
            });
            if (limit) {
                if (oldEmoji.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('emoji')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    oldEmoji.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await newEmoji.edit(oldEmoji.toJSON());

            if (oldEmoji.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const emojiName = `${oldEmoji} (${inlineCode(oldEmoji.id)})`;
                const action = safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi';
                oldEmoji.guild.publicUpdatesChannel.send({
                    content: roleMention(oldEmoji.guild.id),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${emojiName} adlı emojiyi ${action} ve yasaklandı.`,
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
            console.error('Guild Emoji Create Error:', error);
        }
    },
};

export default GuildEmojiUpdate;
