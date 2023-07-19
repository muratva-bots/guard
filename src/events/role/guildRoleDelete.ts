import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

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

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

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
                if (role.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('rol')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    role.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await role.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(role.guild.id, true);

            if (role.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const roleName = `${role} (${inlineCode(role.id)})`;
                const action = safe.length ? 'silerek limite ulaştı' : 'sildi';
                role.guild.publicUpdatesChannel.send({
                    content: roleMention(role.guild.id),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${roleName} adlı rolü ${action} ve yasaklandı.`,
                                safe.includes(SafeFlags.General)
                                    ? [
                                          '# Limite Yakalanmadan Önceki İşlemleri',
                                          codeBlock('yaml', limit.operations.map((o, i) => `${i++}. ${o}`).join('\n')),
                                      ].join('\n')
                                    : undefined,
                            ].join('\n'),
                        ),
                    ],
                });
            }
        } catch (error) {
            console.error('Guild Role Delete Error:', error);
        }
    },
};

export default GuildRoleDelete;
