import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildEmojiCreate: Guard.IEvent = {
    name: Events.GuildEmojiCreate,
    execute: async (client, [emoji]: Guard.ArgsOf<Events.GuildEmojiCreate>) => {
        try {
            const guildData = client.servers.get(emoji.guild.id);
            if (!guildData || !guildData.settings.emoji) return;

            const entry = await emoji.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.EmojiCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = emoji.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? (client.safes.find((_, k) => staffMember.roles.cache.get(k)) || []) : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
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
                })} -> Emoji Oluşturma`,
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

            await emoji.guild.members.ban(entry.executorId);
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
