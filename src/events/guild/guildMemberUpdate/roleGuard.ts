import { SafeFlags } from '@/enums';
import { Client } from '@/structures';
import { AuditLogEvent, GuildMember, inlineCode } from 'discord.js';

async function roleGuard(client: Client, oldMember: GuildMember, newMember: GuildMember) {
    if (
        oldMember.roles.cache.map((r) => r.id) === newMember.roles.cache.map((r) => r.id) ||
        !newMember.roles.cache.filter(
            (role) =>
                !oldMember.roles.cache.has(role.id) &&
                client.utils.dangerPerms.some((perm) => role.permissions.has(perm)),
        ).size
    )
        return;

    const guildData = client.servers.get(newMember.guild.id);
    if (!guildData || !guildData.banKick) return;

    const entry = await newMember.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate })
        .then((audit) => audit.entries.first());
    if (
        !entry ||
        !entry.executor ||
        entry.executor.bot ||
        Date.now() - entry.createdTimestamp > 5000 ||
        entry.targetId === entry.executorId
    )
        return;

    const staffMember = newMember.guild.members.cache.get(entry.executorId);
    const safe = [
        ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
        ...(client.safes.get(entry.executorId) || []),
    ].flat(1);
    if (safe.includes(SafeFlags.Full)) return;

          client.utils.setRoles(staffMember, guildData.quarantineRole);
    await client.utils.closePermissions(newMember.guild);
    await newMember.roles.set(oldMember.roles.cache);

    client.utils.sendPunishLog({
        guild: newMember.guild,
        action: 'verdi',
        authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
        targetName: `${newMember} (${inlineCode(newMember.id)})`,
        targetType: 'sağ tık rol',
        isSafe: false,
        operations: [],
    });
}

export default roleGuard;
