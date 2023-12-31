import { LimitFlags, OperationFlags, SafeFlags } from '@/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const WebhookCreate: Guard.IEvent<Events.WebhooksUpdate> = {
    name: Events.WebhooksUpdate,
    execute: async (client, channel) => {
        try {
            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.channel) return;

            const entry = await channel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = channel.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
                ...(client.safes.get(entry.executorId) || []),
            ].flat(1);
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.General,
                limit: guildData.generalLimitCount,
                time: guildData.generalLimitTime,
                canCheck: safe.includes(SafeFlags.General),
                operation: OperationFlags.WebhookCreate,
            });
            if (limit && limit.isWarn) {
                client.utils.sendLimitWarning({
                    guild: channel.guild,
                    authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                    currentCount: limit.currentCount,
                    maxCount: limit.maxCount,
                    type: 'webhook',
                });
                return;
            }

            await channel.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions(channel.guild);
            // await client.utils.setDanger(channel.guildId, true);

            const webhook = entry.target;
            await webhook.delete();

            client.utils.sendPunishLog({
                guild: channel.guild,
                action: safe.length ? 'oluşturarak limite ulaştı' : 'oluşturdu',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${webhook} (${inlineCode(webhook.id)})`,
                targetType: 'webhooku',
                isSafe: safe.length > 0,
                operations: limit ? limit.operations : [],
            });
        } catch (error) {
            console.error('Webhook Delete Error:', error);
        }
    },
};

export default WebhookCreate;
