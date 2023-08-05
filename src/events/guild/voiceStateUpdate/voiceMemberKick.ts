import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { Client } from '@/structures';
import { AuditLogEvent, inlineCode } from 'discord.js';

async function voiceMemberKick(client: Client, _, newState) {
    const guildData = client.servers.get(newState.guild.id);
    if (!guildData || !guildData.voiceKick) return;
    if (newState.channelId) return;

    const entry = await newState.guild
        .fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberDisconnect,
        })
        .then((audit) => audit.entries.first());
    if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

    const staffMember = newState.guild.members.cache.get(entry.executorId);
    const safe = [
        ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
        ...(client.safes.get(entry.executorId) || []),
    ].flat(1);
    if (safe.includes(SafeFlags.Full)) return;

    const limit = client.utils.checkLimits({
        userId: entry.executor.id,
        type: LimitFlags.VoiceKick,
        limit: guildData.voiceKickLimitCount,
        time: guildData.voiceKickLimitTime,
        canCheck: safe.includes(SafeFlags.VoiceKick),
        operation: OperationFlags.VoiceKick,
    });
    if (limit && limit.isWarn) {
        client.utils.sendLimitWarning({
            guild: newState.guild,
            authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
            currentCount: limit.currentCount,
            maxCount: limit.maxCount,
            type: 'bağlantı kesme',
        });
        return;
    }
            client.utils.setRoles(staffMember, guildData.quarantineRole);

    if (newState.guild.publicUpdatesChannel) {
        client.utils.sendPunishLog({
            guild: newState.guild,
            action: safe.length ? 'keserek limite ulaştı' : 'kesti',
            authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
            targetName: `${newState.member} (${inlineCode(newState.id)})`,
            targetType: 'ses bağlantısını',
            isSafe: safe.length > 0,
            operations: limit ? limit.operations : [],
        });
    }
}

export default voiceMemberKick;
