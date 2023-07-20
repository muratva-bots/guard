import { SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const GuildMemberUpdate: Guard.IEvent = {
    name: Events.GuildMemberUpdate,
    execute: async (client, [oldMember, newMember]: Guard.ArgsOf<Events.GuildMemberUpdate>) => {
        try {
            if (
                !oldMember.roles.cache.every((r) => newMember.roles.cache.has(r.id)) ||
                !newMember.roles.cache.filter(
                    (role) =>
                        !oldMember.roles.cache.has(role.id) &&
                        client.utils.dangerPerms.some((perm) => role.permissions.has(perm)),
                ).size
            )
                return;
            const guildData = client.servers.get(newMember.guild.id);
            if (!guildData || !guildData.settings.banKick) return;

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

            await newMember.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(newMember.guild);
            await client.utils.setDanger(newMember.guild.id, true);
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
        } catch (error) {
            console.error('Guild Member Update Error:', error);
        }
    },
};

export default GuildMemberUpdate;
