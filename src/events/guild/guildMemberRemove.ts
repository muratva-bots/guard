import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, Guild, inlineCode } from 'discord.js';

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
            await client.utils.closePermissions();
            await client.utils.setDanger(member.guild.id, true);

            client.utils.sendPunishLog({
                guild: member.guild,
                action: safe.length ? 'yasaklayarak limite ulaştı' : 'yasakladı',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${entry.target.username} (${inlineCode(entry.target.id)})`,
                targetType: 'sunucudan',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
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
