import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, Guild, inlineCode } from 'discord.js';

const GuildMemberRemove: Guard.IEvent<Events.GuildMemberRemove> = {
    name: Events.GuildMemberRemove,
    execute: async (client, member) => {
        try {
            const guildData = client.servers.get(member.guild.id);
            if (!guildData || !guildData.banKick) return;

            const entryResult = await getEntry(member.guild);
            if (!entryResult) return;

            const { entry, entryType } = entryResult;
            const staffMember = member.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.banKickLimitCount,
                time: guildData.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick) && entryType !== 'PRUNE',
                operation: OperationFlags.Kick,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: member.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'atma',
                });
                return;
            }

            await member.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(member.guild);
            await client.utils.setDanger(member.guild.id, true);

            client.utils.sendPunishLog({
                guild: member.guild,
                action: safe.length ? 'yasaklayarak limite ulaştı' : 'yasakladı',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${entry.target.username} (${inlineCode(entry.target.id)})`,
                targetType: 'sunucudan',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
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
