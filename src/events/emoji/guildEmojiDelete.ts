import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

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
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Emoji Silme`,
            });
            if (limit) {
                client.utils.sendLimitWarning({
                    guild: emoji.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'emoji',
                });
                return;
            }

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
                targetType: 'emoji delete',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
            });
        } catch (error) {
            console.error('Guild Emoji Delete Error:', error);
        }
    },
};

export default GuildEmojiDelete;
