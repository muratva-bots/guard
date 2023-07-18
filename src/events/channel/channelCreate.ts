import { SafeFlags } from "@guard-bot/enums";
import { AuditLogEvent, Events, bold, inlineCode } from "discord.js";

const ChannelCreate: Guard.IEvent = {
    name: Events.ChannelCreate,
    execute: async (client, [channel]: Guard.ArgsOf<Events.ChannelCreate>) => {
        try {
            if (channel.isDMBased() || channel.isThread()) return;

            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.guard.channel) return;

            const entry = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate }).then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || [])
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits(
                entry.executor.id,
                'channel_operations',
                (guildData.settings.guard.channelLimitCount || client.config.DEFAULTS.LIMIT.COUNT),
                (guildData.settings.guard.channelLimitTime || client.config.DEFAULTS.LIMIT.TIME),
                safe.includes(SafeFlags.Channel) 
            );
            if (limit) {
                if (channel.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold("kanal")} limitinde ${inlineCode(limit.maxCount.toString())} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(remainingCount.toString())}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    channel.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await channel.guild.members.ban(entry.executor.id, { reason: "Koruma!" });
            await client.utils.closePermissions();
            await client.utils.setDanger(channel.guildId, true);
            if (channel.deletable) await channel.delete();

            if (channel.guild.publicUpdatesChannel) {
                const channelName = bold(channel.name);
                const action = safe.length ? "oluşturdu limite ulaştı" : "oluşturdu";
                channel.guild.publicUpdatesChannel.send(`@everyone ${entry.executor} adlı kullanıcı ${channelName} adlı kanalı ${action} ve yasaklandı.`);
            }
        } catch (error) {
            console.error("Channel Create Error:", error);
        }
    },
};

export default ChannelCreate;