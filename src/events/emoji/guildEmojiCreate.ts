import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildEmojiCreate: Guard.IEvent<Events.GuildEmojiCreate> = {
    name: Events.GuildEmojiCreate,
    execute: async (client, emoji) => {
        try {
            const guildData = client.servers.get(emoji.guild.id);
            if (!guildData || !guildData.emoji) return;

            const entry = await emoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiCreate })
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
                operation: OperationFlags.EmojiCreate,
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

            await client.utils.setRoles(staffMember, guildData.quarantineRole);
            await emoji.delete();

            client.utils.sendPunishLog({
                guild: emoji.guild,
                action: safe.length ? 'oluşturarak limite ulaştı' : 'oluşturdu',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${emoji.name} (${inlineCode(emoji.id)})`,
                targetType: 'emojiyi',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Emoji Create Error:', error);
        }
    },
};

export default GuildEmojiCreate;
