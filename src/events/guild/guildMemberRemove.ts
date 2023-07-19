import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, Guild, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const GuildMemberRemove: Guard.IEvent = {
    name: Events.GuildMemberRemove,
    execute: async (client, [member]: Guard.ArgsOf<Events.GuildMemberRemove>) => {
        try {
            const guildData = client.servers.get(member.guild.id);
            if (!guildData || !guildData.settings.banKick) return;

            const { entry, entryType } = await getEntry(member.guild);
            if (!entry) return;

            const staffMember = member.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.settings.banKickLimitCount,
                time: guildData.settings.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick) && entryType !== 'PRUNE',
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Üye Atma`,
            });
            if (limit) {
                if (member.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('yasaklama & atma')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    member.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await member.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(member.guild.id, true);

            if (member.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const memberName = `${member} (${inlineCode(member.id)})`;
                const action = safe.length ? 'atarak limite ulaştı' : 'attı';
                member.guild.publicUpdatesChannel.send({
                    content: roleMention(member.guild.id),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${memberName} adlı kullanıcıyı ${action} ve yasaklandı.`,
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
            console.error('Guild Kick Error:', error);
        }
    },
};

export default GuildMemberRemove;

async function getEntry(guild: Guild) {
    try {
        const now = Date.now();
        const kickEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick })
            .then((audit) => audit.entries.first());
        if (kickEntry && kickEntry.executor && !kickEntry.executor.bot && 5000 > now - kickEntry.createdTimestamp) {
            return {
                entryType: 'KICK',
                entry: kickEntry,
            };
        }

        const pruneEntry = await guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberPrune })
            .then((audit) => audit.entries.first());
        if (pruneEntry && pruneEntry.executor && !pruneEntry.executor.bot && 5000 > now - pruneEntry.createdTimestamp) {
            return {
                entryType: 'PRUNE',
                entry: pruneEntry,
            };
        }

        return null;
    } catch (error) {
        console.error('getEntry Error:', error);
        return null;
    }
}
