import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, EmbedBuilder, Events, bold, codeBlock, inlineCode, roleMention } from 'discord.js';

const WebhookDelete: Guard.IEvent = {
    name: Events.WebhooksUpdate,
    execute: async (client, [webhook]: Guard.ArgsOf<Events.WebhooksUpdate>) => {
        try {
            const guildData = client.servers.get(webhook.guildId);
            if (!guildData || !guildData.settings.webhook) return;

            const entry = await webhook.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookDelete })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = webhook.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const embed = new EmbedBuilder({ color: client.utils.getRandomColor() });

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
            if (limit) {
                if (webhook.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('webhook')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    webhook.guild.publicUpdatesChannel.send({ embeds: [embed.setDescription(content)] });
                }
                return;
            }

            await webhook.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(webhook.guildId, true);

            if (webhook.guild.publicUpdatesChannel) {
                const authorName = `${entry.executor} (${inlineCode(entry.executorId)})`;
                const webhookName = `${webhook} (${inlineCode(webhook.id)})`;
                const action = safe.length ? 'silerek limite ulaştı' : 'sildi';
                webhook.guild.publicUpdatesChannel.send({
                    content: roleMention(webhook.guildId),
                    embeds: [
                        embed.setDescription(
                            [
                                `${authorName} adlı kullanıcı ${webhookName} adlı webhooku ${action} ve yasaklandı.`,
                                safe.includes(SafeFlags.General)
                                    ? [
                                          '# Limite Yakalanmadan Önceki İşlemleri',
                                          codeBlock('yaml', limit.operations.map((o, i) => `${i++}. ${o}`).join('\n')),
                                      ].join('\n')
                                    : undefined,
                            ].join('\n'),
                        ),
                    ],
                });
            }
        } catch (error) {
            console.error('Webhook Delete Error:', error);
        }
    },
};

export default WebhookDelete;
