import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildBanAdd: Guard.IEvent<Events.GuildBanAdd> = {
    name: Events.GuildBanAdd,
    execute: async (client, ban) => {
        try {
            const guildData = client.servers.get(ban.guild.id);
            if (!guildData || !guildData.settings.banKick) return;

            const entry = await ban.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = ban.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.settings.banKickLimitCount,
                time: guildData.settings.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick),
                operation: OperationFlags.Ban,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: ban.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'yasaklama',
                });
                return;
            }

            await ban.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(ban.guild);
            await client.utils.setDanger(ban.guild.id, true);
            await ban.guild.members.unban(entry.executor.id);

            client.utils.sendPunishLog({
                guild: ban.guild,
                action: safe.length ? 'yasaklayarak limite ulaştı' : 'yasakladı',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${entry.target.username} (${inlineCode(entry.target.id)})`,
                targetType: 'sunucudan',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Ban Add Error:', error);
        }
    },
};

export default GuildBanAdd;
