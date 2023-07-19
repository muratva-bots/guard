import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode, Guild } from 'discord.js';

const GuildMemberRemove: Guard.IEvent = {
    name: Events.GuildMemberRemove,
    execute: async (client, [member]: Guard.ArgsOf<Events.GuildMemberRemove>) => {
        try {
            const guildData = client.servers.get(member.guild.id);
            if (!guildData || !guildData.settings.guard.banKick) return;

            const { entry, entryType } = await getEntry(member.guild);
            if (!entry) return;

            const staffMember = member.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.settings.guard.banKickLimitCount,
                time: guildData.settings.guard.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick),
            });
            if (limit) {
                if (member.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('yasaklama & atma')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    member.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await member.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(member.guild.id, true);

            if (member.guild.publicUpdatesChannel) {
                const userName = bold(member.user.tag);
                const action = safe.length ? 'kickledi limite ulaştı' : 'kickledi';
                member.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${userName} adlı kullanıcıyı ${action} ve yasaklandı.`,
                );
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
