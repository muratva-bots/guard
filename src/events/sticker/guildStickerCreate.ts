import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildStickerCreate: Guard.IEvent = {
    name: Events.GuildStickerCreate,
    execute: async (client, [sticker]: Guard.ArgsOf<Events.GuildStickerCreate>) => {
        try {
            const guildData = client.servers.get(sticker.guild.id);
            if (!guildData || !guildData.settings.sticker) return;

            const entry = await sticker.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = sticker.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Sticker,
                limit: guildData.settings.stickerLimitCount,
                time: guildData.settings.stickerLimitTime,
                canCheck: safe.includes(SafeFlags.Sticker),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Çıkartma Oluşturma`,
            });
            if (limit) {
                client.utils.sendLimitWarning({
                    guild: sticker.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'çıkartma',
                });
                return;
            }

            await sticker.delete();

            client.utils.sendPunishLog({
                guild: sticker.guild,
                action: safe.length ? 'ekleyerek limite ulaştı' : 'ekledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${sticker} (${inlineCode(sticker.id)})`,
                targetType: 'çıkartmayı',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
            });
        } catch (error) {
            console.error('Guild Sticker Create Error:', error);
        }
    },
};

export default GuildStickerCreate;
