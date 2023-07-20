import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildRoleDelete: Guard.IEvent = {
    name: Events.GuildRoleDelete,
    execute: async (client, [role]: Guard.ArgsOf<Events.GuildRoleDelete>) => {
        try {
            const guildData = client.servers.get(role.guild.id);
            if (!guildData || !guildData.settings.role) return;

            const entry = await role.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = role.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Role,
                limit: guildData.settings.roleLimitCount,
                time: guildData.settings.roleLimitTime,
                canCheck: safe.includes(SafeFlags.Role),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Rol Silme`,
            });
            if (limit) {
                client.utils.sendLimitWarning({
                    guild: role.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'rol',
                });
                return;
            }

            await role.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(role.guild.id, true);

            client.utils.sendPunishLog({
                guild: role.guild,
                action: safe.length ? 'silerek limite ulaştı' : 'sildi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${role} (${inlineCode(role.id)})`,
                targetType: 'rolü',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
            });
        } catch (error) {
            console.error('Guild Role Delete Error:', error);
        }
    },
};

export default GuildRoleDelete;
