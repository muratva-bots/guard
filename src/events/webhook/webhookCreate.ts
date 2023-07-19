import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const WebhookCreate: Guard.IEvent = {
    name: Events.WebhooksUpdate,
    execute: async (client, [channel]: Guard.ArgsOf<Events.WebhooksUpdate>) => {
        try {
            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.guard.channel) return;

            const entry = await channel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.General,
                limit: guildData.settings.guard.generalLimitCount,
                time: guildData.settings.guard.generalLimitTime,
                canCheck: safe.includes(SafeFlags.General),
            });
            if (limit) {
                if (channel.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('webhook')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    channel.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await channel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(channel.guildId, true);
            if (channel.deletable) await channel.delete();

            if (channel.guild.publicUpdatesChannel) {
                const webhookName = bold(channel.name);
                const action = safe.length ? 'oluşturdu limite ulaştı' : 'oluşturdu';
                channel.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${webhookName} adlı webhooku ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Webhook Delete Error:', error);
        }
    },
};

export default WebhookCreate;
