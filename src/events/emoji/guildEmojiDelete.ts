import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildEmojiDelete: Guard.IEvent<Events.GuildEmojiDelete> = {
    name: Events.GuildEmojiDelete,
    execute: async (client, emoji) => {
        try {
            const guildData = client.servers.get(emoji.guild.id);
            if (!guildData || !guildData.emoji) return;

            const entry = await emoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = emoji.guild.members.cache.get(entry.executorId);
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
                operation: OperationFlags.EmojiDelete,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: emoji.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'emoji',
                });
                return;
            }

            client.utils.setRoles(staffMember, guildData.quarantineRole);
            const newEmoji = await emoji.guild.emojis.create({
                attachment: emoji.url,
                name: emoji.name,
                roles: emoji.roles.cache,
                reason: 'Emoji silindiği için geri yüklendi.',
            });

            client.utils.sendPunishLog({
                guild: emoji.guild,
                action: safe.length ? 'silerek limite ulaştı' : 'sildi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${newEmoji} (${inlineCode(newEmoji.id)})`,
                targetType: 'emojiyi',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Emoji Delete Error:', error);
        }
    },
};

export default GuildEmojiDelete;
