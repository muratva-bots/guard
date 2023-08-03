import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildEmojiUpdate: Guard.IEvent<Events.GuildEmojiUpdate> = {
    name: Events.GuildEmojiUpdate,
    execute: async (client, oldEmoji, newEmoji) => {
        try {
            const guildData = client.servers.get(oldEmoji.guild.id);
            if (!guildData || !guildData.emoji) return;

            const entry = await oldEmoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = oldEmoji.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Emoji,
                limit: guildData.emojiLimitCount,
                time: guildData.emojiLimitTime,
                canCheck: safe.includes(SafeFlags.Emoji),
                operation: OperationFlags.EmojiUpdate,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: oldEmoji.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'emoji',
                });
                return;
            }

            await newEmoji.guild.members.ban(entry.executorId);
            await newEmoji.edit(oldEmoji.toJSON());

            client.utils.sendPunishLog({
                guild: oldEmoji.guild,
                action: safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${oldEmoji.name} (${inlineCode(oldEmoji.id)})`,
                targetType: 'emojiyi',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Emoji Create Error:', error);
        }
    },
};

export default GuildEmojiUpdate;
