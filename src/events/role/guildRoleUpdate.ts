import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { RoleModel } from '@guard-bot/models';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const GuildRoleUpdate: Guard.IEvent = {
    name: Events.GuildRoleUpdate,
    execute: async (client, [oldRole, newRole]: Guard.ArgsOf<Events.GuildRoleUpdate>) => {
        try {
            const guildData = client.servers.get(oldRole.guild.id);
            if (!guildData || !guildData.settings.guard.role) return;

            if (oldRole.rawPosition !== newRole.rawPosition) {
                newRole.setPosition(oldRole.rawPosition);

                if (
                    client.utils.checkLimits({
                        userId: 'roleposition',
                        type: LimitFlags.Role,
                        limit: 3,
                        time: 1000 * 60,
                        canCheck: true,
                    })
                )
                    await client.utils.closePermissions();
            }

            const entry = await oldRole.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = oldRole.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Role,
                limit: guildData.settings.guard.roleLimitCount,
                time: guildData.settings.guard.roleLimitTime,
                canCheck: safe.includes(SafeFlags.Role),
            });
            if (limit) {
                if (oldRole.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('rol')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    oldRole.guild.publicUpdatesChannel.send({ content });
                }
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

            if (oldRole.guild.publicUpdatesChannel) {
                const roleName = bold(oldRole.name);
                const action = safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi';
                oldRole.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${roleName} adlı rolü ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Guild Role Update Error:', error);
        }
    },
};

export default GuildRoleUpdate;
