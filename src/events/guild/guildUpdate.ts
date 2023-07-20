import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildUpdate: Guard.IEvent = {
    name: Events.GuildUpdate,
    execute: async (client, [oldGuild, newGuild]: Guard.ArgsOf<Events.GuildUpdate>) => {
        try {
            const guildData = client.servers.get(newGuild.id);
            if (!guildData || !guildData.settings.general) return;

            const entry = await newGuild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = newGuild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.General,
                limit: guildData.settings.generalLimitCount,
                time: guildData.settings.generalLimitTime,
                canCheck: safe.includes(SafeFlags.General),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Sunucuyu Güncelleme`,
            });
            if (limit) {
                client.utils.sendLimitWarning({
                    guild: oldGuild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'sunucu ayarları',
                });
                return;
            }

            await newGuild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(newGuild.id, true);
            await oldGuild.edit(client.guildSettings);

            // readye url koruması yapmamız gerek ama self ile yapılıyor sadece nasıl yapıcaz?

            client.utils.sendPunishLog({
                guild: newGuild,
                action: safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${newGuild.name} (${inlineCode(newGuild.id)})`,
                targetType: 'sunucunun ayarlarını',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
            });
        } catch (error) {
            console.error('Guild Update Error:', error);
        }
    },
};

export default GuildUpdate;
