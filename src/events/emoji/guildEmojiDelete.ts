import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const GuildEmojiDelete: Guard.IEvent = {
    name: Events.GuildEmojiDelete,
    execute: async (client, [emoji]: Guard.ArgsOf<Events.GuildEmojiDelete>) => {
        try {
            const guildData = client.servers.get(emoji.guild.id);
            if (!guildData || !guildData.settings.emoji) return;

            const entry = await emoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = emoji.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Emoji,
                limit: guildData.settings.emojiLimitCount,
                time: guildData.settings.emojiLimitTime,
                canCheck: safe.includes(SafeFlags.Emoji),
            });
            if (limit) {
                if (emoji.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('emoji')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    emoji.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await emoji.guild.emojis.create({
                attachment: emoji.url,
                name: emoji.name,
                roles: emoji.roles.cache,
                reason: 'Emoji silindiği için geri yüklendi.',
            });

            if (emoji.guild.publicUpdatesChannel) {
                const emojiName = `${emoji} (${inlineCode(emoji.name)} - ${inlineCode(emoji.id)})`;
                const action = safe.length ? 'sildi limite ulaştı' : 'sildi';
                emoji.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${emojiName} adlı emojiyi ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Guild Emoji Delete Error:', error);
        }
    },
};

export default GuildEmojiDelete;
