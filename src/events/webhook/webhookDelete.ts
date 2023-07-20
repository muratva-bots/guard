import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, inlineCode } from 'discord.js';

const WebhookDelete: Guard.IEvent = {
    name: Events.WebhooksUpdate,
    execute: async (client, [channel]: Guard.ArgsOf<Events.WebhooksUpdate>) => {
        try {
            const guildData = client.servers.get(channel.guildId);
            if (!guildData || !guildData.settings.webhook) return;

            const entry = await channel.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookDelete })
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
                limit: guildData.settings.generalLimitCount,
                time: guildData.settings.generalLimitTime,
                canCheck: safe.includes(SafeFlags.General),
                operation: `${new Date().toLocaleDateString('tr-TR', {
                    hour: 'numeric',
                    minute: 'numeric',
                })} -> Webhook Silme`,
            });
            if (limit.isWarn) {
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
            await client.utils.closePermissions();
            await client.utils.setDanger(channel.guildId, true);

            client.utils.sendPunishLog({
                guild: channel.guild,
                action: safe.length ? 'silerek limite ulaştı' : 'sildi',
                authorName: `${entry.executor} (${inlineCode(entry.executorId)})`,
                targetName: `${entry.target.name} (${inlineCode(entry.targetId)})`,
                targetType: 'webhooku',
                isSafe: safe.length > 0,
                operations: limit.operations || [],
            });
        } catch (error) {
            console.error('Webhook Delete Error:', error);
        }
    },
};

export default WebhookDelete;
