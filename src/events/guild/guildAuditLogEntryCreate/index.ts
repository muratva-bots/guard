import { SafeFlags } from "@/enums";
import { Events } from "discord.js";

const GuildAuditLogEntryCreate: Guard.IEvent<Events.GuildAuditLogEntryCreate> = {
    name: Events.GuildAuditLogEntryCreate,
    execute: async (client, auditLogEntry, guild) => {
        const guildData = client.servers.get(guild.id);
        if (!guildData) return;

        const staffMember = guild.members.cache.get(auditLogEntry.executorId);
        const safe = [
            ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
            ...(client.safes.get(auditLogEntry.executorId) || []),
        ].flat(1);
        if (safe.includes(SafeFlags.Full)) return;



    },
}

export default GuildAuditLogEntryCreate;
