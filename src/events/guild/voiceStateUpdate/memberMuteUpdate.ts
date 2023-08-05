import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { Client } from '@/structures';
import { AuditLogEvent, VoiceState, inlineCode } from 'discord.js';

async function memberMuteUpdate(client: Client, oldState: VoiceState, newState: VoiceState) {
    const guildData = client.servers.get(newState.guild.id);
    if (!guildData || !guildData.voiceKick) return;
    if (newState.channelId) return;

    if (oldState.serverMute && !newState.serverMute) {
        const entry = await newState.guild
            .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate })
            .then((audit) => audit.entries.first());
        if (
            !entry ||
            !entry.executor ||
            entry.executor.bot ||
            entry.changes[0]?.key !== 'mute' ||
            entry.targetId !== newState.id ||
            Date.now() - entry.createdTimestamp > 5000
        )
            return;

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
                type: 'susturma atma',
            });
            return;
        }

        await client.utils.setRoles(staffMember, guildData.quarantineRole);
        if (newState.guild.publicUpdatesChannel) {
            client.utils.sendPunishLog({
                guild: newState.guild,
                action: safe.length ? 'atarak limite ulaştı' : 'attı',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${newState.member} (${inlineCode(newState.id)})`,
                targetType: 'susturma',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        }
    }
}

export default memberMuteUpdate;
