import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const GuildEmojiCreate: Guard.IEvent = {
    name: Events.GuildEmojiCreate,
    execute: async (client, [emoji]: Guard.ArgsOf<Events.GuildEmojiCreate>) => {
        try {
            const guildData = client.servers.get(emoji.guild.id);
            if (!guildData || !guildData.settings.guard.emoji) return;

            const entry = await emoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiCreate })
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
                limit: guildData.settings.guard.emojiLimitCount,
                time: guildData.settings.guard.emojiLimitTime,
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

            await emoji.delete();

            if (emoji.guild.publicUpdatesChannel) {
                const emojiName = `${emoji} (${inlineCode(emoji.name)} - ${inlineCode(emoji.id)})`;
                const action = safe.length ? 'ekledi limite ulaştı' : 'ekledi';
                emoji.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${emojiName} adlı emojiyi ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Guild Emoji Create Error:', error);
        }
    },
};

export default GuildEmojiCreate;
