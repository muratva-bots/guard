import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildUpdate: Guard.IEvent<Events.GuildUpdate> = {
    name: Events.GuildUpdate,
    execute: async (client, oldGuild, newGuild) => {
        try {
            const guildData = client.servers.get(newGuild.id);
            if (!guildData || !guildData.general) return;

            const entry = await newGuild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = newGuild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.General,
                limit: guildData.generalLimitCount,
                time: guildData.generalLimitTime,
                canCheck: safe.includes(SafeFlags.General),
                operation: OperationFlags.GuildUpdate,
            });
            if (limit && limit.isWarn) {
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
            await client.utils.closePermissions(newGuild);
            await client.utils.setDanger(newGuild.id, true);
            await oldGuild.edit(client.guildSettings);

            client.utils.sendPunishLog({
                guild: newGuild,
                action: safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${newGuild.name} (${inlineCode(newGuild.id)})`,
                targetType: 'sunucunun ayarlarını',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Update Error:', error);
        }
    },
};

export default GuildUpdate;
