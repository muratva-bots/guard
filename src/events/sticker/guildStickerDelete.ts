import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildStickerDelete: Guard.IEvent<Events.GuildStickerDelete> = {
    name: Events.GuildStickerDelete,
    execute: async (client, sticker) => {
        try {
            const guildData = client.servers.get(sticker.guild.id);
            if (!guildData || !guildData.sticker) return;

            const entry = await sticker.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = sticker.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Sticker,
                limit: guildData.stickerLimitCount,
                time: guildData.stickerLimitTime,
                canCheck: safe.includes(SafeFlags.Sticker),
                operation: OperationFlags.StickerDelete,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: sticker.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'çıkartma',
                });
                return;
            }

            await client.utils.setRoles(staffMember, guildData.quarantineRole);
            await sticker.guild.stickers.create({
                file: sticker.url,
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description,
                reason: 'Çıkartma silindiği için yeniden oluşturuldu!',
            });

            client.utils.sendPunishLog({
                guild: sticker.guild,
                action: safe.length ? 'silerek limite ulaştı' : 'sildi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${sticker.name} (${inlineCode(sticker.id)})`,
                targetType: 'çıkartmayı',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Sticker Delete Error:', error);
        }
    },
};

export default GuildStickerDelete;
