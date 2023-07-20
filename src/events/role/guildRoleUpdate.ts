import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { RoleModel } from '@guard-bot/models';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildRoleUpdate: Guard.IEvent = {
    name: Events.GuildRoleUpdate,
    execute: async (client, [oldRole, newRole]: Guard.ArgsOf<Events.GuildRoleUpdate>) => {
        try {
            const guildData = client.servers.get(oldRole.guild.id);
            if (!guildData || !guildData.settings.role) return;

            const entry = await oldRole.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) {
                if (oldRole.rawPosition !== newRole.rawPosition) {
                    newRole.setPosition(oldRole.rawPosition);

                    if (
                        client.utils.checkLimits({
                            userId: 'roleposition',
                            type: LimitFlags.Role,
                            limit: 3,
                            time: 1000 * 60,
                            canCheck: true,
                            operation: 'operation',
                        })
                    )
                        await client.utils.closePermissions();
                }
                return;
            }

            const staffMember = oldRole.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? (client.safes.find((_, k) => staffMember.roles.cache.get(k)) || []) : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
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
                })} -> Rol Güncelleme`,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: oldRole.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'rol',
                });
                return;
            }

            await oldRole.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(oldRole.guild.id, true);

            const data = await RoleModel.findOne({ id: oldRole.id });
            if (data) {
                oldRole.edit({
                    color: data.color,
                    hoist: data.hoist,
                    mentionable: data.mentionable,
                    name: data.name,
                    permissions: BigInt(data.permissions),
                    position: data.position,
                });
            }

            client.utils.sendPunishLog({
                guild: oldRole.guild,
                action: safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${oldRole} (${inlineCode(oldRole.id)})`,
                targetType: 'rolü',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Guild Role Update Error:', error);
        }
    },
};

export default GuildRoleUpdate;
