import { SafeFlags } from "@guard-bot/enums";
import { AuditLogEvent, Events, bold, inlineCode } from "discord.js";

const GuildRoleDelete: Guard.IEvent = {
    name: Events.GuildRoleDelete,
    execute: async (client, [role]: Guard.ArgsOf<Events.GuildRoleDelete>) => {
        try {
            const guildData = client.servers.get(role.guild.id);
            if (!guildData || !guildData.settings.guard.role) return;

            const entry = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = role.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || [])
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits(
                entry.executor.id,
                'role_operations',
                (guildData.settings.guard.roleLimitCount || client.config.DEFAULTS.LIMIT.COUNT),
                (guildData.settings.guard.roleLimitTime || client.config.DEFAULTS.LIMIT.TIME),
                safe.includes(SafeFlags.Role) 
            );
            if (limit) {
                if (role.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold("rol")} limitinde ${inlineCode(limit.maxCount.toString())} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(remainingCount.toString())}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    role.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await role.guild.members.ban(entry.executor.id, { reason: "Koruma!" });
            await client.utils.closePermissions();
            await client.utils.setDanger(role.guild.id, true);

            if (role.guild.publicUpdatesChannel) {
                const roleName = bold(role.name);
                const action = safe.length ? "sildi limite ulaştı" : "sildi";
                role.guild.publicUpdatesChannel.send(`@everyone ${entry.executor} adlı kullanıcı ${roleName} adlı kanalı ${action} ve yasaklandı.`);
            }
        } catch (error) {
            console.error("Guild Role Delete Error:", error);
        }
    },
};

export default GuildRoleDelete;