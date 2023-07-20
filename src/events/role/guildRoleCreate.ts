import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildRoleCreate: Guard.IEvent = {
    name: Events.GuildRoleCreate,
    execute: async (client, [role]: Guard.ArgsOf<Events.GuildRoleCreate>) => {
        try {
            const guildData = client.servers.get(role.guild.id);
            if (!guildData || !guildData.settings.role) return;

            const entry = await role.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = role.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Role,
                limit: guildData.settings.roleLimitCount,
                time: guildData.settings.roleLimitTime,
                canCheck: safe.includes(SafeFlags.Role),
                operation: OperationFlags.RoleCreate
            });
            if (limit && limit.isWarn) {
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
            await client.utils.closePermissions(role.guild);
            await client.utils.setDanger(role.guild.id, true);
            await role.delete();

            client.utils.sendPunishLog({
                guild: role.guild,
                action: safe.length ? 'oluşturarak limite ulaştı' : 'oluşturdu',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${role} (${inlineCode(role.id)})`,
                targetType: 'rolü',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Role Create Error:', error);
        }
    },
};

export default GuildRoleCreate;
