import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { ChannelModel } from '@guard-bot/models';
import { AuditLogEvent, Events, GuildChannel, bold, inlineCode } from 'discord.js';

const ChannelUpdate: Guard.IEvent = {
    name: Events.ChannelUpdate,
    execute: async (client, [oldChannel, newChannel]: Guard.ArgsOf<Events.ChannelUpdate>) => {
        try {
            if (oldChannel.isDMBased() || oldChannel.isThread()) return;

            const guildData = client.servers.get(oldChannel.guildId);
            if (!guildData || !guildData.settings.guard.channel) return;

            const entry = await oldChannel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = oldChannel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.Channel,
                limit: guildData.settings.guard.channelLimitCount,
                time: guildData.settings.guard.channelLimitTime,
                canCheck: safe.includes(SafeFlags.Channel),
            });
            if (limit) {
                if ((newChannel as GuildChannel).guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('kanal')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    (newChannel as GuildChannel).guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await oldChannel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(oldChannel.guildId, true);

            const data = await ChannelModel.findOne({ id: newChannel.id });
            if (data) {
                (newChannel as GuildChannel).edit({
                    name: data.name,
                    nsfw: data.nsfw,
                    parent: data.parent,
                    topic: data.topic,
                    position: data.position,
                    userLimit: data.userLimit,
                    permissionOverwrites: data.permissionOverwrites,
                });
            }

            if (oldChannel.guild.publicUpdatesChannel) {
                const channelName = bold(oldChannel.name);
                const action = safe.length ? 'güncelleyerek limite ulaştı' : 'güncelledi';
                oldChannel.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${channelName} adlı kanalı ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Channel Update Error:', error);
        }
    },
};

export default ChannelUpdate;
